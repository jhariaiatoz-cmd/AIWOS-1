"""
Agent Router — priority-tiered intent classification for user prompts.

Algorithm
---------
Each routing rule carries a `priority` level (1 = highest, 14 = lowest).

1. Score every rule independently (phrase matches + keyword matches).
2. Collect only rules with score > 0.
3. Select the *lowest* priority number among those rules — that tier wins.
4. Within the winning tier, pick the rule with the highest score.
5. Locate the matching Agent row in the DB by name/role substring.
6. If no DB row matches, try the next best scored rule (any tier).
7. Final fallback: first Active agent in the list (logged as "General").

Priority tiers:
   1 — HR / Recruitment        (hire, recruit, interview, candidate …)
   2 — Research / Analysis     (research, market, industry, trends …)
   3 — Sales / Revenue         (sales, lead, crm, outbound, pipeline …)
   4 — Finance / Budgeting     (budget, forecast, finance, expense …)
   5 — Marketing / Brand       (marketing, campaign, brand, seo …)
   6 — Customer Support        (support, ticket, complaint …)
   7 — Legal                   (contract, nda, legal, ip, liability …)
   8 — Compliance              (gdpr, soc2, audit, regulation …)
   9 — Cybersecurity           (security, threat, owasp, pentest …)
  10 — Product Management      (roadmap, prd, backlog, prioritization …)
  11 — Project Management      (milestone, gantt, wbs, stakeholder …)
  12 — Data Analysis           (dashboard, kpi, cohort, sql analytics …)
  13 — AI Architecture         (llm, rag, mlops, vector database …)
  14 — Engineering / Full Stack (react, python, code, build … lowest, must
                                 not override intent signals from tiers 1-13)

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

    # ── Priority 1a · Technical Recruiting (Recruiter specialist) ───────────────
    # Same priority as HR Manager tier; higher score on sourcing-specific prompts
    # wins the tie-break so Recruiter is selected over HR Manager for those tasks.
    {
        "priority": 1,
        "intent": "Technical Recruiting",
        "agent_name": "Recruiter",
        "phrases": [
            "candidate sourcing", "linkedin sourcing", "sourcing candidates",
            "outreach template", "recruiter screen", "resume review",
            "technical screening", "sourcing strategy", "boolean search",
            "passive candidates",
        ],
        "keywords": [
            "sourcing", "applicant", "ats", "job board", "recruiter",
            "technical screen", "cold linkedin", "inmail", "job posting site",
        ],
    },

    # ── Priority 1b · HR / Recruitment (HR Manager — manager-level tasks) ────
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
            "interview", "candidate", "candidates", "onboard",
            "employee", "employees", "talent", "staff", "staffing",
            "headcount", "culture", "compensation",
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
            "research", "analyze", "insights", "trends",
            "industry", "competitors", "competitor", "benchmark", "survey",
            "findings", "landscape", "sector", "study", "whitepaper",
            "investigate", "data-driven", "ev", "saas market",
        ],
    },

    # ── Priority 3a · Sales Agent (IC execution tasks) ───────────────────────
    # Same priority as Sales Manager tier. "outreach" and "prospecting" are kept
    # out of the Sales Manager keywords so IC prompts score higher here.
    {
        "priority": 3,
        "intent": "Sales Execution",
        "agent_name": "Sales Agent",
        "phrases": [
            "cold email", "cold outreach", "cold call", "outreach script",
            "prospecting email", "book a demo", "schedule a demo",
            "sales call script", "follow-up email", "linkedin message",
        ],
        "keywords": [
            "outreach", "prospecting", "cold calling", "cold emailing",
            "sales development", "sdr script", "bdr script", "demo request",
        ],
    },

    # ── Priority 3b · Sales / Revenue (Sales Manager — strategy tasks) ───────
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
            "prospect", "prospects", "quota", "conversion",
            "deal", "deals", "b2b", "sdr", "bdr",
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

    # ── Priority 5a · Content Strategy (Content Strategist specialist) ──────
    # Same priority as Marketing Manager tier; agent_name "Content" scores a
    # +4 bonus when "content" appears in the prompt, winning over Marketing Manager.
    {
        "priority": 5,
        "intent": "Content Strategy",
        "agent_name": "Content",
        "phrases": [
            "content calendar", "editorial calendar", "content strategy",
            "content plan", "content creation", "brand voice", "brand guidelines",
            "thought leadership", "content audit", "content brief",
        ],
        "keywords": [
            "editorial", "copywriting", "blog post", "newsletter content",
            "content writer", "content creation", "brand storytelling",
        ],
    },

    # ── Priority 5b · Marketing / Brand (Marketing Manager — strategy tasks) ─
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

    # ── Priority 6a · Customer Success (CSM) ─────────────────────────────────
    # Dedicated tier for CSM-specific intents. Placed above Technical Support
    # so "customer success" prompts reach Customer Success Manager, not Support Specialist.
    {
        "priority": 6,
        "intent": "Customer Success",
        "agent_name": "Customer Success",
        "phrases": [
            "customer success", "customer onboarding", "customer retention",
            "churn prevention", "quarterly business review", "customer health score",
            "success plan", "expansion opportunity", "customer expansion",
            "customer lifecycle", "customer adoption",
        ],
        "keywords": [
            "churn", "qbr", "csm", "health score", "time-to-value",
            "customer success manager", "success plan", "customer journey",
        ],
    },

    # ── Priority 6b · Technical Support ──────────────────────────────────────
    # Same priority tier as Customer Success; higher-scoring rule wins when both fire.
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

    # ── Priority 7 · Legal ────────────────────────────────────────────────────
    {
        "priority": 7,
        "intent": "Legal",
        "agent_name": "Legal",
        "phrases": [
            "contract review", "review this contract", "legal review",
            "nda review", "draft an nda", "terms of service",
            "privacy policy", "legal advice", "legal guidance", "legal risk",
            "employment contract", "vendor agreement", "intellectual property",
            "legal compliance", "offer letter legal", "licensing agreement",
        ],
        "keywords": [
            "legal", "contract", "nda", "lawsuit", "litigation", "clause",
            "attorney", "counsel", "ip", "trademark", "copyright", "patent",
            "liability", "indemnity", "warranty", "jurisdiction", "arbitration",
            "terms", "agreement", "legal opinion",
        ],
    },

    # ── Priority 8 · Compliance ───────────────────────────────────────────────
    {
        "priority": 8,
        "intent": "Risk & Compliance",
        "agent_name": "Compliance",
        "phrases": [
            "compliance framework", "soc2 compliance", "iso 27001",
            "gdpr compliance", "hipaa compliance", "audit preparation",
            "compliance audit", "risk assessment", "risk management",
            "control framework", "compliance policy", "regulatory audit",
        ],
        "keywords": [
            "compliance", "regulatory", "audit", "soc2", "iso27001",
            "hipaa", "controls", "governance", "regulation", "certify",
            "certifications", "regulatory risk", "compliance officer",
        ],
    },

    # ── Priority 9 · Cybersecurity ────────────────────────────────────────────
    {
        "priority": 9,
        "intent": "Cybersecurity",
        "agent_name": "Cybersecurity",
        "phrases": [
            "security review", "threat model", "vulnerability scan",
            "penetration test", "security audit", "owasp review",
            "security architecture", "incident response", "data breach",
            "security assessment", "secure my", "harden the",
        ],
        "keywords": [
            "cybersecurity", "vulnerability", "exploit", "threat",
            "owasp", "pentest", "firewall", "encryption",
            "zero trust", "siem", "xdr", "malware", "phishing",
            "ransomware", "intrusion", "cve", "security posture",
        ],
    },

    # ── Priority 10 · Product Management ─────────────────────────────────────
    {
        "priority": 10,
        "intent": "Product Management",
        "agent_name": "Product",
        "phrases": [
            "product roadmap", "product strategy", "feature prioritization",
            "product requirements", "write a prd", "product backlog",
            "go-to-market strategy", "product launch", "okr planning",
            "product vision", "prd document", "product spec",
            "user stories for", "acceptance criteria",
        ],
        "keywords": [
            "roadmap", "prd", "backlog", "epics", "persona",
            "mvp", "product-market fit", "prioritization",
            "product manager", "product owner", "rice score",
            "moscow", "jobs to be done",
        ],
    },

    # ── Priority 11 · Project Management ─────────────────────────────────────
    {
        "priority": 11,
        "intent": "Project Management",
        "agent_name": "Project",
        "phrases": [
            "project plan", "project timeline", "project schedule",
            "gantt chart", "project kickoff", "project status report",
            "milestone plan", "project delivery", "risk register",
            "stakeholder map", "project retrospective", "work breakdown",
        ],
        "keywords": [
            "milestone", "deliverable", "gantt", "wbs",
            "stakeholder", "scope", "dependencies", "blockers",
            "retrospective", "velocity", "project manager",
            "program manager", "delivery plan",
        ],
    },

    # ── Priority 12 · Data Analysis ───────────────────────────────────────────
    {
        "priority": 12,
        "intent": "Data Analysis",
        "agent_name": "Data",
        "phrases": [
            "data analysis", "data visualization", "analyze this data",
            "sql query for", "data pipeline", "dashboard design",
            "kpi dashboard", "cohort analysis", "data report",
            "analytics report", "data insights", "metric analysis",
            "build a dashboard", "data-driven report",
        ],
        "keywords": [
            "dashboard", "cohort", "funnel", "attribution",
            "pandas", "dataframe", "matplotlib", "tableau", "looker",
            "bigquery", "analytics", "etl", "data warehouse",
            "data analyst", "business intelligence", "bi report",
        ],
    },

    # ── Priority 13 · AI Architecture ────────────────────────────────────────
    {
        "priority": 13,
        "intent": "AI Architecture",
        "agent_name": "AI Solution",
        "phrases": [
            "ai architecture", "llm integration", "ai strategy",
            "rag pipeline", "ai solution", "vector database",
            "ai system design", "mlops pipeline", "multi-agent system",
            "ai pipeline", "prompt engineering", "fine-tune a model",
        ],
        "keywords": [
            "llm", "embeddings", "rag", "mlops", "fine-tuning",
            "ai model", "langchain", "inference", "context window",
            "ai architect", "foundation model", "ai governance",
        ],
    },

    # ── Priority 14 · Engineering / Full Stack (lowest) ──────────────────────
    # Tech keywords live here so they never override higher-tier intent signals.
    {
        "priority": 14,
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
    # Use word-boundary check so "hr" in "threat" does not trigger the HR bonus.
    if re.search(r"\b" + re.escape(rule["agent_name"].lower()) + r"\b", prompt_lower):
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
