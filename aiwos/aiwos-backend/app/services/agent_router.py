"""
Agent Router — priority-tiered intent classification for user prompts.

Algorithm
---------
Each routing rule carries a `priority` level (1 = highest, 7 = lowest).

1. Score every rule independently (phrase matches + keyword matches).
2. Collect only rules with score > 0.
3. Select the *lowest* priority number among those rules — that tier wins.
4. Within the winning tier, pick the rule with the highest score.
5. Locate the matching Agent row in the DB by name/role substring.
6. If no DB row matches, try the next best scored rule (any tier).
7. Final fallback: first Active agent in the list (logged as "General").

Priority tiers (from spec):
  1 — HR / Recruitment   (hire, recruit, interview, candidate …)
  2 — Research / Analysis (research, market, industry, trends …)
  3 — Sales / Revenue    (sales, lead, crm, outbound, pipeline …)
  4 — Finance / Budgeting (budget, forecast, finance, expense …)
  5 — Marketing / Brand  (marketing, campaign, brand, seo …)
  6 — Customer Support   (support, ticket, complaint …)
  7 — Engineering        (react, python, code, build … lowest, must not
                          override intent signals from tiers 1-6)

Scoring per rule:
  - exact phrase match (case-insensitive substring) → 3 pts each
  - single keyword match (word-boundary regex)      → 1 pt each
  - rule's agent_name explicitly in prompt          → +4 bonus
"""
import logging
import re
from typing import Optional

from app.models.agent import Agent

log = logging.getLogger(__name__)


# ── Routing table ─────────────────────────────────────────────────────────────
# Rules are evaluated purely by score within their tier.
# agent_name: substring matched against Agent.name and Agent.role (case-insensitive).

ROUTING_TABLE: list[dict] = [

    # ── Priority 1 · HR / Recruitment (highest) ───────────────────────────────
    {
        "priority": 1,
        "intent": "HR / Recruitment",
        "agent_name": "HR",
        "phrases": [
            "hire a", "hire an", "hire react", "hire python", "hire senior",
            "hire junior", "hire 5", "hire 10", "hire 3", "hire 20",
            "hiring plan", "hiring engineers", "hiring developers",
            "hiring manager", "job posting", "job description", "job offer",
            "offer letter", "interview questions", "interview process",
            "interview candidates", "interview frontend", "interview backend",
            "onboarding plan", "onboarding process",
            "performance review", "employee handbook", "recruitment strategy",
            "talent acquisition", "headcount plan", "people ops",
            "recruit engineers", "recruit developers", "recruit python",
            "recruit react", "find developers", "find engineers",
            "frontend developers", "backend developers", "react developer",
            "python engineer", "software developer hiring",
        ],
        "keywords": [
            "hire", "hiring", "recruit", "recruiter", "recruitment",
            "interview", "candidate", "candidates", "onboard", "onboarding",
            "employee", "employees", "talent", "staff", "staffing",
            "headcount", "culture", "retention", "compensation",
            "benefits", "payroll", "hr", "human resources",
            "job description", "jd", "workforce planning",
        ],
    },

    # ── Priority 2 · Research / Analysis ─────────────────────────────────────
    {
        "priority": 2,
        "intent": "Market Research / Analysis",
        "agent_name": "Research",
        "phrases": [
            "market research", "competitive analysis", "industry analysis",
            "industry trends", "generate research", "market analysis",
            "competitor landscape", "market sizing", "trend analysis",
            "generate market", "research report", "analyst report",
            "market study", "landscape analysis", "research for",
            "analyze the market", "research the",
        ],
        "keywords": [
            "research", "analyze", "analysis", "insights", "trends",
            "industry", "competitors", "competitor", "benchmark", "survey",
            "findings", "landscape", "sector", "study", "whitepaper",
            "investigate", "data-driven", "ev", "saas market",
        ],
    },

    # ── Priority 3 · Sales / Revenue ──────────────────────────────────────────
    {
        "priority": 3,
        "intent": "Sales / Revenue",
        "agent_name": "Sales",
        "phrases": [
            "sales campaign", "outbound sales", "inbound sales",
            "lead generation", "sales script", "cold outreach", "cold email",
            "sales pipeline", "crm strategy", "sales forecast",
            "create outbound", "sales playbook", "sales strategy",
            "outreach campaign", "generate leads", "sales funnel",
            "close deals", "prospect list",
        ],
        "keywords": [
            "sales", "lead", "leads", "crm", "outbound", "inbound",
            "pipeline", "prospect", "prospects", "quota", "conversion",
            "deal", "deals", "outreach", "b2b", "sdr", "bdr",
            "account executive", "upsell", "cross-sell", "closing",
        ],
    },

    # ── Priority 4 · Finance / Budgeting ─────────────────────────────────────
    {
        "priority": 4,
        "intent": "Finance / Budgeting",
        "agent_name": "Finance",
        "phrases": [
            "budget forecast", "financial model", "revenue forecast",
            "cost analysis", "profit and loss", "cash flow", "roi analysis",
            "financial planning", "expense report", "financial projection",
            "burn rate", "runway analysis", "financial statement",
            "income statement", "balance sheet", "prepare budget",
            "build a budget", "quarterly budget", "annual budget",
        ],
        "keywords": [
            "finance", "budget", "forecast", "financial", "accounting",
            "expense", "expenses", "profit", "roi", "investment",
            "capex", "opex", "ebitda", "cashflow", "runway",
            "funding", "valuation", "p&l", "unit economics",
        ],
    },

    # ── Priority 5 · Marketing / Brand ───────────────────────────────────────
    {
        "priority": 5,
        "intent": "Marketing / Brand",
        "agent_name": "Marketing",
        "phrases": [
            "marketing campaign", "content calendar", "social media strategy",
            "email campaign", "seo strategy", "brand awareness",
            "growth strategy", "ad campaign", "content strategy",
            "influencer campaign", "product launch", "go-to-market",
            "brand positioning",
        ],
        "keywords": [
            "marketing", "brand", "content", "seo", "social media",
            "email marketing", "growth", "ads", "audience", "engagement",
            "influencer", "copywriting", "newsletter", "pr", "publicity",
        ],
    },

    # ── Priority 6 · Customer Support ────────────────────────────────────────
    {
        "priority": 6,
        "intent": "Customer Support",
        "agent_name": "Support",
        "phrases": [
            "customer issue", "support ticket", "customer complaint",
            "customer is complaining", "customer complaining",
            "resolve issue", "help desk", "bug report",
            "customer support", "refund request", "escalate ticket",
            "user reported", "user is having", "client is having",
        ],
        "keywords": [
            "support", "ticket", "complaint", "complaining",
            "troubleshoot", "resolve", "escalate", "refund",
            "helpdesk", "frustrated", "unhappy",
        ],
    },

    # ── Priority 7 · Engineering / Full Stack (lowest) ───────────────────────
    # Tech keywords live here so they never override HR/Research/Sales/Finance
    # when those intent signals are also present in the prompt.
    {
        "priority": 7,
        "intent": "Engineering / Full Stack",
        "agent_name": "Full Stack",
        "phrases": [
            "write a react", "react component", "react login", "react page",
            "react app", "login page", "sign in page", "sign up page",
            "python script", "build a web", "web application", "web app",
            "write code", "typescript component", "next.js", "nextjs",
            "full stack", "fullstack", "software engineer",
            "write a function", "implement a feature", "write a class",
            "build an api", "build fastapi", "fastapi authentication",
            "rest api", "graphql api", "build a backend", "build a frontend",
            "build a database", "database schema",
        ],
        "keywords": [
            "react", "vue", "angular", "javascript", "typescript",
            "nodejs", "node", "css", "html", "tailwind",
            "python", "fastapi", "flask", "django", "rails",
            "software", "code", "coding", "programming", "implement",
            "debug", "refactor", "git", "github", "feature",
            "build", "mobile", "function", "script", "component",
            "redux", "graphql", "webpack", "vite", "docker",
            "kubernetes", "microservice", "endpoint", "database",
            "sql", "postgres", "mongodb", "redis",
        ],
    },
]


# ── Internal scorer ───────────────────────────────────────────────────────────

def _score_rule(prompt_lower: str, rule: dict) -> int:
    score = 0
    for phrase in rule["phrases"]:
        if phrase in prompt_lower:
            score += 3
    for kw in rule["keywords"]:
        if re.search(r"\b" + re.escape(kw) + r"\b", prompt_lower):
            score += 1
    if rule["agent_name"].lower() in prompt_lower:
        score += 4
    return score


def _find_db_agent(rule: dict, active: list[Agent]) -> Optional[Agent]:
    """Return the first active agent whose name or role contains rule's agent_name."""
    pattern = rule["agent_name"].lower()
    return next(
        (a for a in active
         if pattern in a.name.lower() or pattern in a.role.lower()),
        None,
    )


# ── Public API ────────────────────────────────────────────────────────────────

def route(
    agents: list[Agent], prompt: str
) -> tuple[Optional[Agent], str, str]:
    """
    Route *prompt* to the best-matching agent from *agents*.

    Returns:
        (agent, intent_label, reason_string)

    *agent* is None only if *agents* is completely empty.
    """
    prompt_lower = prompt.lower()
    active = [a for a in agents if a.status in ("Active", "Created")]

    # 1. Score every rule
    scored: list[tuple[int, int, dict]] = []   # (priority, score, rule)
    for rule in ROUTING_TABLE:
        s = _score_rule(prompt_lower, rule)
        scored.append((rule["priority"], s, rule))

    # 2. Keep only rules that matched at all
    matched = [(p, s, r) for p, s, r in scored if s > 0]

    if not matched:
        agent = active[0] if active else None
        return agent, "General", "no keyword match — general fallback"

    # 3. Sort: lowest priority number first (highest intent tier),
    #    then highest score to break ties within the same tier.
    matched.sort(key=lambda x: (x[0], -x[1]))

    # 4. Walk the ordered list and pick the first rule whose agent exists in DB
    for priority, score, rule in matched:
        agent = _find_db_agent(rule, active)
        if agent:
            intent = rule["intent"]
            reason = (
                f"priority={priority}, score={score}, "
                f"intent='{intent}', pattern='{rule['agent_name']}'"
            )
            return agent, intent, reason

    # 5. All matched intents had no DB agent — use first active as fallback
    agent = active[0] if active else None
    return agent, "General", "matched intents but no DB agents found — general fallback"


def log_routing(
    prompt: str,
    agent: Optional[Agent],
    intent: str,
    reason: str,
) -> None:
    """Emit a structured INFO log entry for every routing decision."""
    log.info(
        "[AgentRouter] prompt=%r | intent=%s | agent=%s | reason=%s",
        prompt[:140],
        intent,
        agent.name if agent else "None",
        reason,
    )
