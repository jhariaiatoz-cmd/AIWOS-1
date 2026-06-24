"""
Executive Command Center service.

Detects project-creation commands (build / create / plan <name>) and
orchestrates the full project lifecycle in a single call:

  1. Duplicate guard
  2. LLM-generated project plan (phases + tasks) + blueprint (parallel)
  3. Project row creation with blueprint stored
  4. Bulk task creation with best-fit agent assignment
  5. Workflow creation with one step per phase
  6. Structured result returned to the API caller

Non-project prompts return is_project_command=False so the caller can
fall through to normal conversation handling.
"""

import asyncio
import json
import logging
import re
import uuid
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.agent import Agent
from app.models.project import Project
from app.schemas.project import ProjectCreate
from app.schemas.workflow import WorkflowCreate, WorkflowStepCreate
from app.services import project_service, workflow_service
from app.services.llm_provider_service import complete as llm_complete
from app.services.task_service import PHASE_ROLE_MAP, create_tasks_from_project

log = logging.getLogger(__name__)

_COMMAND_RE = re.compile(
    r"^\s*(?:build|create|plan)\s+(.+?)\s*$",
    re.IGNORECASE,
)

_PLAN_MODEL = "gemini-2.5-flash"
_PHASES = ["Research", "Design", "Development", "Testing", "Deployment"]


# ---------------------------------------------------------------------------
# Public result types
# ---------------------------------------------------------------------------

@dataclass
class AssignedAgentResult:
    id: str
    name: str
    role: str
    phase: str


@dataclass
class CommandResult:
    is_project_command: bool
    project_id: Optional[str] = None
    project_name: Optional[str] = None
    task_count: int = 0
    workflow_id: Optional[str] = None
    workflow_name: Optional[str] = None
    assigned_agents: List[AssignedAgentResult] = field(default_factory=list)
    duplicate: bool = False
    blueprint: Optional[Dict[str, Any]] = None
    prompt_pack: Optional[Dict[str, Any]] = None


# ---------------------------------------------------------------------------
# Command detection
# ---------------------------------------------------------------------------

def detect_project_command(prompt: str) -> Optional[str]:
    """Return the project name from a build/create/plan prompt, else None."""
    m = _COMMAND_RE.match(prompt.strip())
    return m.group(1).strip() if m else None


# ---------------------------------------------------------------------------
# LLM-based plan generation
# ---------------------------------------------------------------------------

_PLAN_SYSTEM = (
    "You are a senior project planner. Given a project name, output a structured "
    "project plan as a single JSON object — no markdown fences, no prose, ONLY the JSON.\n\n"
    "Required format:\n"
    "{\n"
    '  "description": "<2-3 sentence project overview>",\n'
    '  "phases": [\n'
    '    { "name": "Research",     "tasks": [{"title": "...", "description": "..."}, ...] },\n'
    '    { "name": "Design",       "tasks": [...] },\n'
    '    { "name": "Development",  "tasks": [...] },\n'
    '    { "name": "Testing",      "tasks": [...] },\n'
    '    { "name": "Deployment",   "tasks": [...] }\n'
    "  ]\n"
    "}\n\n"
    "Rules:\n"
    "- Exactly these 5 phases in this order: Research, Design, Development, Testing, Deployment\n"
    "- 3-5 tasks per phase, specific to the given project\n"
    "- Output ONLY the JSON object"
)


async def _generate_project_plan(project_name: str) -> Dict[str, Any]:
    """Call the LLM for a structured project plan; fall back to a static default."""
    try:
        response = await llm_complete(
            model=_PLAN_MODEL,
            system_prompt=_PLAN_SYSTEM,
            user_prompt=f"Project: {project_name}",
        )
        raw = response.content.strip()
        if raw.startswith("```"):
            raw = re.sub(r"^```[^\n]*\n?", "", raw)
            raw = re.sub(r"\n?```$", "", raw.strip())
        return json.loads(raw)
    except Exception as exc:
        log.warning("Plan LLM call failed (%s); using static default.", exc)
        return _static_plan(project_name)


def _static_plan(project_name: str) -> Dict[str, Any]:
    return {
        "description": (
            f"A comprehensive {project_name} built with modern architecture and best practices. "
            "The system will be developed iteratively across research, design, development, testing, "
            "and deployment phases."
        ),
        "phases": [
            {
                "name": "Research",
                "tasks": [
                    {"title": "Requirements gathering", "description": "Collect and document stakeholder requirements."},
                    {"title": "Market and competitor analysis", "description": "Research existing solutions and identify gaps."},
                    {"title": "Technology stack evaluation", "description": "Evaluate and select the appropriate tech stack."},
                ],
            },
            {
                "name": "Design",
                "tasks": [
                    {"title": "System architecture design", "description": "Design the overall system architecture."},
                    {"title": "Database schema design", "description": "Design data models and schema."},
                    {"title": "UI/UX wireframes", "description": "Create wireframes and interface mockups."},
                ],
            },
            {
                "name": "Development",
                "tasks": [
                    {"title": "Backend API development", "description": "Implement core backend services and APIs."},
                    {"title": "Frontend implementation", "description": "Build user interface components."},
                    {"title": "Database implementation", "description": "Set up the database and data access layer."},
                    {"title": "System integration", "description": "Integrate all components into a cohesive system."},
                ],
            },
            {
                "name": "Testing",
                "tasks": [
                    {"title": "Unit testing", "description": "Write and run unit tests for all components."},
                    {"title": "Integration testing", "description": "Test interactions between system components."},
                    {"title": "User acceptance testing", "description": "Conduct UAT with stakeholders."},
                ],
            },
            {
                "name": "Deployment",
                "tasks": [
                    {"title": "Infrastructure setup", "description": "Configure production infrastructure."},
                    {"title": "CI/CD pipeline configuration", "description": "Set up automated deployment pipelines."},
                    {"title": "Production deployment", "description": "Deploy the system to the production environment."},
                ],
            },
        ],
    }


# ---------------------------------------------------------------------------
# Blueprint + Prompt Pack generation
# ---------------------------------------------------------------------------

_BLUEPRINT_SYSTEM = (
    "You are a senior software architect and technical lead. Given a project name and description, "
    "produce a complete Project Blueprint and Prompt Pack as a single JSON object.\n\n"
    "Required format (output ONLY the JSON, no markdown fences, no prose):\n"
    "{\n"
    '  "requirements": "<functional and non-functional requirements, bullet list>",\n'
    '  "features": "<core feature list with brief descriptions>",\n'
    '  "user_roles": "<user types/personas and their access levels>",\n'
    '  "architecture": "<system architecture overview: layers, services, patterns>",\n'
    '  "database_design": "<key entities, relationships, and data model notes>",\n'
    '  "api_modules": "<REST API module groups with endpoint categories>",\n'
    '  "deployment_strategy": "<cloud/infra strategy, CI/CD, environments>",\n'
    '  "prompt_pack": {\n'
    '    "frontend": "<actionable prompt a developer gives to an AI to build the frontend (no code, only structured instructions)>",\n'
    '    "backend": "<actionable prompt for building the backend API layer>",\n'
    '    "database": "<actionable prompt for designing and implementing the database>",\n'
    '    "testing": "<actionable prompt for writing tests and QA strategies>",\n'
    '    "deployment": "<actionable prompt for setting up deployment and infrastructure>"\n'
    "  }\n"
    "}\n\n"
    "Rules:\n"
    "- Each blueprint section: 3-6 concise bullet points or short structured paragraphs\n"
    "- Each prompt in prompt_pack: 120-200 words, actionable engineering instructions, NO code\n"
    "- Be specific to the actual project domain — do not use placeholders\n"
    "- Output ONLY the JSON object"
)


async def _generate_project_blueprint(
    project_name: str, description: str
) -> Dict[str, Any]:
    """Call LLM to generate the Project Blueprint + Prompt Pack. Returns empty dict on failure."""
    try:
        response = await llm_complete(
            model=_PLAN_MODEL,
            system_prompt=_BLUEPRINT_SYSTEM,
            user_prompt=f"Project: {project_name}\nDescription: {description}",
        )
        raw = response.content.strip()
        if raw.startswith("```"):
            raw = re.sub(r"^```[^\n]*\n?", "", raw)
            raw = re.sub(r"\n?```$", "", raw.strip())
        return json.loads(raw)
    except Exception as exc:
        log.warning("Blueprint LLM call failed (%s); returning empty blueprint.", exc)
        return {}


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

async def _find_existing_project(
    db: AsyncSession,
    organization_id: uuid.UUID,
    name: str,
) -> Optional[Project]:
    result = await db.execute(
        select(Project).where(
            Project.organization_id == organization_id,
            Project.name == name,
            Project.deleted_at.is_(None),
        )
    )
    return result.scalar_one_or_none()


async def _load_agents(db: AsyncSession, organization_id: uuid.UUID) -> List[Agent]:
    result = await db.execute(
        select(Agent).where(
            Agent.organization_id == organization_id,
            Agent.deleted_at.is_(None),
        )
    )
    return list(result.scalars().all())


def _find_agent_for_role(target_role: str, agents: List[Agent]) -> Optional[Agent]:
    """Return the first agent whose name or role contains the target role."""
    if not target_role or not agents:
        return None
    target_lower = target_role.lower()
    for agent in agents:
        if target_lower in (agent.name or "").lower():
            return agent
    for agent in agents:
        if target_lower in (agent.role or "").lower():
            return agent
    keywords = [w for w in target_lower.split() if len(w) >= 2]
    if keywords:
        for agent in agents:
            combined = f"{agent.name or ''} {agent.role or ''}".lower()
            if all(kw in combined for kw in keywords):
                return agent
    return None


def _best_owner_agent(agents: List[Agent]) -> Optional[uuid.UUID]:
    for role_name in ["Project Manager", "Senior Full Stack Engineer", "Product Manager"]:
        agent = _find_agent_for_role(role_name, agents)
        if agent:
            return agent.id
    return agents[0].id if agents else None


# ---------------------------------------------------------------------------
# Main orchestrator
# ---------------------------------------------------------------------------

async def execute_command(
    db: AsyncSession,
    organization_id: uuid.UUID,
    user_id: uuid.UUID,
    prompt: str,
) -> CommandResult:
    """
    Parse the prompt. If it is a project command, orchestrate full project
    creation and return a populated CommandResult. Otherwise return
    is_project_command=False so the caller can route to a normal conversation.
    """
    project_name = detect_project_command(prompt)
    if not project_name:
        return CommandResult(is_project_command=False)

    # ── 1. Duplicate guard ───────────────────────────────────────────────────
    existing = await _find_existing_project(db, organization_id, project_name)
    if existing:
        log.info("Duplicate project '%s' for org=%s — returning existing.", project_name, organization_id)
        existing_full = await project_service.get_project(db, existing.id)
        return CommandResult(
            is_project_command=True,
            project_id=str(existing.id),
            project_name=existing.name,
            task_count=getattr(existing_full, "total_tasks", 0),
            duplicate=True,
        )

    # ── 2. LLM project plan + blueprint (parallel) ───────────────────────────
    log.info("Generating project plan and blueprint for '%s'", project_name)
    plan, blueprint_raw = await asyncio.gather(
        _generate_project_plan(project_name),
        _generate_project_blueprint(project_name, project_name),
    )
    description: str = plan.get("description", "")
    phases_data: List[Dict[str, Any]] = plan.get("phases", [])

    # ── 3. Load agents ───────────────────────────────────────────────────────
    agents = await _load_agents(db, organization_id)
    owner_agent_id = _best_owner_agent(agents)

    # ── 4. Create project ────────────────────────────────────────────────────
    project = await project_service.create_project(
        db,
        ProjectCreate(
            organization_id=organization_id,
            name=project_name,
            description=description,
            status="Planning",
            owner_agent_id=owner_agent_id,
        ),
        current_user_id=user_id,
    )
    log.info("Created project id=%s name='%s'", project.id, project.name)

    # ── 4b. Persist blueprint on the project row ─────────────────────────────
    blueprint_sections: Dict[str, Any] = {}
    prompt_pack_data: Dict[str, Any] = {}
    if blueprint_raw:
        prompt_pack_data = blueprint_raw.pop("prompt_pack", {})
        blueprint_sections = blueprint_raw
        stored_blueprint = {**blueprint_sections, "prompt_pack": prompt_pack_data}
        project.blueprint = stored_blueprint
        await db.commit()
        log.info("Stored blueprint for project id=%s", project.id)

    # ── 5. Build phase_tasks for bulk creation ───────────────────────────────
    phase_tasks: List[Dict[str, Any]] = []
    for phase_item in phases_data:
        phase_name = phase_item.get("name", "")
        suggested_role = PHASE_ROLE_MAP.get(phase_name, "")
        for task_item in phase_item.get("tasks", []):
            phase_tasks.append({
                "title": task_item.get("title", ""),
                "description": task_item.get("description", ""),
                "phase": phase_name,
                "suggested_role": suggested_role,
            })

    tasks = await create_tasks_from_project(
        db,
        project_id=project.id,
        organization_id=organization_id,
        milestones=[],
        tasks=[],
        phase_tasks=phase_tasks,
        agents=agents,
        owner_agent_id=owner_agent_id,
    )
    log.info("Created %d tasks for project id=%s", len(tasks), project.id)

    # ── 6. Build workflow steps (one per phase) ──────────────────────────────
    assigned_agents: List[AssignedAgentResult] = []
    seen_ids: set = set()
    steps: List[WorkflowStepCreate] = []

    for i, phase_name in enumerate(_PHASES):
        role = PHASE_ROLE_MAP.get(phase_name, "")
        agent = _find_agent_for_role(role, agents)
        steps.append(
            WorkflowStepCreate(
                name=f"{phase_name} Phase",
                node_id=f"node-{phase_name.lower()}",
                step_order=i,
                agent_id=agent.id if agent else None,
                config={"phase": phase_name, "role": role},
            )
        )
        if agent and str(agent.id) not in seen_ids:
            seen_ids.add(str(agent.id))
            assigned_agents.append(
                AssignedAgentResult(
                    id=str(agent.id),
                    name=agent.name,
                    role=agent.role,
                    phase=phase_name,
                )
            )

    workflow_name = f"{project_name} Workflow"
    workflow = await workflow_service.create_workflow(
        db,
        WorkflowCreate(
            organization_id=organization_id,
            name=workflow_name,
            description=f"Automated workflow for {project_name}",
            graph_definition={
                "nodes": [{"id": s.node_id, "phase": s.config["phase"]} for s in steps],
                "edges": [
                    {"source": steps[i].node_id, "target": steps[i + 1].node_id}
                    for i in range(len(steps) - 1)
                ],
            },
            status="Active",
            steps=steps,
        ),
    )
    log.info("Created workflow id=%s name='%s'", workflow.id, workflow.name)

    return CommandResult(
        is_project_command=True,
        project_id=str(project.id),
        project_name=project_name,
        task_count=len(tasks),
        workflow_id=str(workflow.id),
        workflow_name=workflow_name,
        assigned_agents=assigned_agents,
        blueprint=blueprint_sections if blueprint_sections else None,
        prompt_pack=prompt_pack_data if prompt_pack_data else None,
    )
