import re
import uuid
from typing import Optional, List, TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.agent import Agent

# ---------------------------------------------------------------------------
# Domain table
# ---------------------------------------------------------------------------
# Each domain maps task-side keywords to agent role-side keywords.
# Scoring: task_hits * role_hits per domain, summed across all domains.
# Role keywords are deliberately specific so specialist agents (QA Engineer,
# DevOps Engineer, Full Stack Engineer) don't cross-match via "engineer" alone.
# ---------------------------------------------------------------------------
_DOMAINS = [
    # Research Analyst  →  research, requirements, analysis
    {
        "task": {
            "research", "requirements", "analysis", "market", "survey",
            "competitive", "insight", "benchmark", "intelligence", "study",
            "findings", "discovery", "feasibility", "stakeholder",
        },
        "role": {"research", "analyst"},
    },

    # UI/UX Designer  →  UI, UX, wireframe, design, accessibility
    {
        "task": {
            "ui", "ux", "wireframe", "design", "figma", "prototype", "mockup",
            "interface", "accessibility", "visual", "branding", "typography",
            "layout", "color", "theme", "responsive", "usability",
        },
        "role": {"designer", "ui", "ux", "creative"},
    },

    # Full Stack Engineer  →  frontend keywords (React, Next.js, component…)
    {
        "task": {
            "frontend", "react", "nextjs", "component", "css", "html",
            "javascript", "typescript", "client", "spa", "jsx", "tsx",
            "tailwind", "animation", "rendering",
        },
        "role": {"full", "stack", "frontend", "developer", "software"},
    },

    # Full Stack Engineer  →  backend keywords (API, database, auth…)
    {
        "task": {
            "backend", "api", "database", "authentication", "integration",
            "server", "sql", "endpoint", "schema", "microservice", "rest",
            "graphql", "middleware", "orm", "migration", "cache", "queue",
        },
        "role": {"full", "stack", "backend", "developer", "software"},
    },

    # QA Engineer  →  testing, QA, validation, bug, regression, performance
    {
        "task": {
            "testing", "qa", "quality", "validation", "bug", "regression",
            "performance", "test", "automated", "coverage", "selenium",
            "cypress", "jest", "unittest", "e2e", "smoke", "load",
        },
        "role": {"qa", "quality", "tester"},
    },

    # DevOps Engineer  →  deployment, Docker, CI/CD, infrastructure, AWS, monitoring
    {
        "task": {
            "deployment", "docker", "ci", "cd", "infrastructure", "aws",
            "monitoring", "devops", "kubernetes", "k8s", "pipeline", "deploy",
            "cloud", "terraform", "ansible", "helm", "nginx", "logging",
            "alerting", "scaling", "container", "registry",
        },
        "role": {"devops", "operations", "infrastructure", "sre", "reliability"},
    },

    # Product Manager  →  charter, vision, roadmap, requirements, product strategy
    {
        "task": {
            "charter", "vision", "roadmap", "product", "strategy", "backlog",
            "prioritization", "feature", "epics", "user story", "stories",
            "acceptance", "kpi", "okr", "launch", "go-to-market",
        },
        "role": {"product", "strategy", "manager"},
    },

    # Project Manager  →  WBS, schedule, resource, milestones, project plan
    {
        "task": {
            "wbs", "schedule", "resource", "milestone", "gantt", "project",
            "planning", "kickoff", "stakeholder", "risk", "scope", "timeline",
            "delivery", "dependency", "project plan", "status report",
        },
        "role": {"program", "delivery", "project", "coordinator", "pmo"},
    },

    # AI Solution Architect  →  architecture, system design, tech stack
    {
        "task": {
            "architecture", "system", "design", "solution", "stack", "technical",
            "scalability", "patterns", "microservices", "integration", "blueprint",
        },
        "role": {"architect", "systems", "solution", "ai", "technical"},
    },

    # Cybersecurity Specialist  →  security, compliance, vulnerability
    {
        "task": {
            "security", "penetration", "vulnerability", "compliance", "threat",
            "audit", "firewall", "encryption", "access", "identity", "siem",
        },
        "role": {"security", "operations", "cybersecurity", "compliance"},
    },

    # HR Manager  →  recruitment, hiring, onboarding
    {
        "task": {
            "recruitment", "hiring", "onboarding", "hr", "candidate",
            "interview", "talent", "employee", "workforce", "payroll",
            "benefits", "culture", "training", "offboarding",
        },
        "role": {"hr", "human", "resources", "recruitment", "talent", "people", "personnel"},
    },

    # Finance Manager  →  budget, finance, pricing, revenue
    {
        "task": {
            "budget", "finance", "pricing", "cost", "accounting", "invoice",
            "financial", "forecast", "profit", "loss", "expense", "audit",
            "revenue", "cash", "funding", "roi",
        },
        "role": {"finance", "financial", "accounting", "cfo", "controller", "treasurer"},
    },

    # Sales Manager  →  sales, leads, outreach, pipeline
    {
        "task": {
            "sales", "leads", "outreach", "crm", "prospect", "deal",
            "close", "customer", "client", "account", "quota", "partnership",
            "b2b", "b2c", "upsell", "conversion",
        },
        "role": {"sales", "commercial", "account", "business"},
    },
]


def _tokenize(text: str) -> set[str]:
    return set(re.findall(r"[a-z]+", text.lower()))


def assign_task(
    title: str,
    description: Optional[str],
    agents: "List[Agent]",
) -> Optional[uuid.UUID]:
    """Return the best-matching agent_id using deterministic keyword scoring.

    Each domain contributes task_hits * role_hits to an agent's score.
    Returns None when no agent scores above zero (caller falls back to the
    project owner agent).
    """
    if not agents:
        return None

    text_tokens = _tokenize(f"{title} {description or ''}")
    scores: dict[uuid.UUID, int] = {a.id: 0 for a in agents}

    for domain in _DOMAINS:
        task_hits = sum(1 for kw in domain["task"] if kw in text_tokens)
        if task_hits == 0:
            continue
        for agent in agents:
            role_tokens = _tokenize(f"{agent.role} {agent.name}")
            role_hits = sum(1 for kw in domain["role"] if kw in role_tokens)
            if role_hits > 0:
                scores[agent.id] += task_hits * role_hits

    best_id = max(scores, key=lambda aid: scores[aid])
    return best_id if scores[best_id] > 0 else None
