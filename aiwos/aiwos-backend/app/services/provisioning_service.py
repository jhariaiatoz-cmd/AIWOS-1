"""
Auto-provision default departments, agents, and a Workspace project for a new
organization.  Called exactly once from organization_service.create_organization.
All errors are caught so that provisioning failure never blocks org creation.
"""
import uuid
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.agent import Agent
from app.models.department import Department
from app.models.project import Project

# ── Keyword lists used by the agent-matching heuristic ───────────────────────
# Exposed so conversation_service can import them without re-defining.
AGENT_KEYWORDS: dict[str, list[str]] = {
    "Full Stack Engineer": [
        "code", "app", "application", "build", "develop", "feature",
        "bug", "fix", "deploy", "full stack", "fullstack", "web", "software",
    ],
    "Backend Engineer": [
        "api", "server", "database", "backend", "microservice", "endpoint",
        "service", "query", "sql", "cache", "performance",
    ],
    "UI/UX Designer": [
        "design", "ui", "ux", "interface", "wireframe", "mockup",
        "user experience", "prototype", "layout", "visual", "figma",
    ],
    "HR Manager": [
        "hire", "recruit", "employee", "hr", "onboard", "interview",
        "talent", "people", "team", "culture", "performance review",
    ],
    "Sales Manager": [
        "sales", "revenue", "deal", "prospect", "pipeline",
        "crm", "quota", "close", "lead", "conversion", "customer",
    ],
    "Marketing Strategist": [
        "marketing", "campaign", "brand", "content", "social",
        "seo", "email", "growth", "ads", "audience", "engagement",
    ],
    "Research Analyst": [
        "research", "analyze", "analysis", "report", "data", "insights",
        "market", "study", "investigate", "findings", "competitive",
    ],
    "Support Specialist": [
        "support", "help", "issue", "ticket", "problem",
        "troubleshoot", "assist", "resolve", "complaint",
    ],
}

_DEPARTMENTS = [
    {"name": "Engineering",  "description": "Software development and technical infrastructure"},
    {"name": "HR",           "description": "Human resources, recruitment, and employee management"},
    {"name": "Sales",        "description": "Revenue generation and customer acquisition"},
    {"name": "Marketing",    "description": "Brand awareness, content, and growth"},
    {"name": "Research",     "description": "Data analysis, market research, and insights"},
    {"name": "Support",      "description": "Customer support and issue resolution"},
]

_AGENTS = [
    {
        "name": "Full Stack Engineer",
        "role": "Full Stack Software Engineer",
        "department": "Engineering",
        "goal": (
            "Design, build, and maintain full-stack web applications with clean code "
            "and modern architectures."
        ),
        "instructions": (
            "You are a senior full stack engineer. Help users with frontend (React, "
            "Next.js, TypeScript) and backend (Node.js, Python, FastAPI) development "
            "tasks. Write clean, production-ready code with proper error handling and "
            "tests. Ask clarifying questions about requirements before starting."
        ),
        "provider": "gemini",
        "model": "gemini-2.5-flash",
    },
    {
        "name": "Backend Engineer",
        "role": "Backend Software Engineer",
        "department": "Engineering",
        "goal": "Build robust, scalable server-side systems, APIs, and database architectures.",
        "instructions": (
            "You are a senior backend engineer specializing in API design, database "
            "optimization, and scalable system architecture. Help with REST/GraphQL APIs, "
            "database queries, microservices, caching strategies, and performance tuning. "
            "Always consider security, observability, and maintainability."
        ),
        "provider": "gemini",
        "model": "gemini-2.5-flash",
    },
    {
        "name": "UI/UX Designer",
        "role": "UI/UX Designer",
        "department": "Engineering",
        "goal": "Create intuitive, beautiful user interfaces and exceptional user experiences.",
        "instructions": (
            "You are a UI/UX designer with expertise in design systems, wireframing, and "
            "user research. Help with interface design, component architecture, "
            "accessibility, color systems, typography, and user flow optimization. "
            "Provide actionable, specific design feedback."
        ),
        "provider": "gemini",
        "model": "gemini-2.5-flash",
    },
    {
        "name": "HR Manager",
        "role": "Human Resources Manager",
        "department": "HR",
        "goal": "Manage talent acquisition, employee development, and organizational culture.",
        "instructions": (
            "You are an experienced HR manager. Help with job descriptions, interview "
            "question frameworks, onboarding plans, performance review structures, HR "
            "policies, and employee relations. Always maintain confidentiality and "
            "approach sensitive topics with empathy and professionalism."
        ),
        "provider": "gemini",
        "model": "gemini-2.5-flash",
    },
    {
        "name": "Sales Manager",
        "role": "Sales Manager",
        "department": "Sales",
        "goal": "Drive revenue growth through effective sales strategies and customer relationship management.",
        "instructions": (
            "You are a results-driven sales manager. Help with sales scripts, objection "
            "handling, pipeline analysis, forecasting, customer segmentation, and CRM "
            "strategies. Provide data-driven recommendations and actionable playbooks."
        ),
        "provider": "gemini",
        "model": "gemini-2.5-flash",
    },
    {
        "name": "Marketing Strategist",
        "role": "Marketing Strategist",
        "department": "Marketing",
        "goal": "Develop and execute marketing strategies that drive brand awareness and customer acquisition.",
        "instructions": (
            "You are a marketing strategist specializing in digital marketing, content "
            "strategy, and growth. Help with campaign planning, content calendars, SEO "
            "strategies, email marketing, social media, and analytics interpretation. "
            "Ground recommendations in measurable outcomes."
        ),
        "provider": "gemini",
        "model": "gemini-2.5-flash",
    },
    {
        "name": "Research Analyst",
        "role": "Research Analyst",
        "department": "Research",
        "goal": "Provide data-driven insights through rigorous research, analysis, and reporting.",
        "instructions": (
            "You are a research analyst with expertise in market research, competitive "
            "analysis, and data interpretation. Help with research frameworks, competitor "
            "analysis, market sizing, survey design, and executive reporting. Present "
            "findings clearly with supporting evidence."
        ),
        "provider": "gemini",
        "model": "gemini-2.5-flash",
    },
    {
        "name": "Support Specialist",
        "role": "Customer Support Specialist",
        "department": "Support",
        "goal": "Resolve customer issues efficiently and ensure exceptional customer satisfaction.",
        "instructions": (
            "You are a customer support specialist focused on problem resolution, empathy, "
            "and satisfaction. Help with troubleshooting guides, support scripts, "
            "escalation procedures, knowledge base articles, and customer communication "
            "templates. Always be calm, clear, and solution-oriented."
        ),
        "provider": "gemini",
        "model": "gemini-2.5-flash",
    },
]


async def provision_organization(db: AsyncSession, org_id: uuid.UUID) -> None:
    """
    Idempotent: skips any department/agent/project that already exists.
    Safe to call multiple times on the same org.
    """
    # 1. Departments
    dept_map: dict[str, uuid.UUID] = {}
    for d in _DEPARTMENTS:
        existing = await db.execute(
            select(Department).where(
                Department.organization_id == org_id,
                Department.name == d["name"],
                Department.deleted_at.is_(None),
            )
        )
        dept = existing.scalar_one_or_none()
        if dept is None:
            dept = Department(
                id=uuid.uuid4(),
                organization_id=org_id,
                name=d["name"],
                description=d["description"],
                is_custom=False,
            )
            db.add(dept)
            await db.flush()
        dept_map[d["name"]] = dept.id

    # 2. Agents
    for a in _AGENTS:
        existing = await db.execute(
            select(Agent).where(
                Agent.organization_id == org_id,
                Agent.name == a["name"],
                Agent.deleted_at.is_(None),
            )
        )
        if existing.scalar_one_or_none() is not None:
            continue
        agent = Agent(
            id=uuid.uuid4(),
            organization_id=org_id,
            department_id=dept_map.get(a["department"]),
            name=a["name"],
            role=a["role"],
            goal=a["goal"],
            instructions=a["instructions"],
            provider=a["provider"],
            model=a["model"],
            status="Active",
            is_manager=False,
            tools=[],
        )
        db.add(agent)

    # 3. Default Workspace project
    existing_proj = await db.execute(
        select(Project).where(
            Project.organization_id == org_id,
            Project.name == "Workspace",
            Project.deleted_at.is_(None),
        )
    )
    if existing_proj.scalar_one_or_none() is None:
        project = Project(
            id=uuid.uuid4(),
            organization_id=org_id,
            name="Workspace",
            description="Default project for ad-hoc tasks and workforce commands.",
            status="Active",
        )
        db.add(project)

    await db.commit()


def match_agent(agents: list[Agent], prompt: str) -> Optional[Agent]:
    """
    Score active agents against the prompt using keyword matching.
    Falls back to the first active agent if no keywords match.
    """
    prompt_lower = prompt.lower()
    active = [a for a in agents if a.status in ("Active", "Created")]
    if not active:
        return agents[0] if agents else None

    best: Optional[Agent] = None
    best_score = -1

    for agent in active:
        keywords = AGENT_KEYWORDS.get(agent.name, [])
        score = sum(1 for kw in keywords if kw in prompt_lower)
        # Bonus: agent's role or name mentioned explicitly
        if agent.role.lower() in prompt_lower or agent.name.lower() in prompt_lower:
            score += 3
        if score > best_score:
            best_score = score
            best = agent

    return best if best is not None else active[0]
