"""
Conversation service: create conversations, send messages, and maintain
multi-turn LLM context from stored history.

Every conversation belongs to exactly one agent — agent_id is required.
LLM execution runs as a FastAPI background task *after* the HTTP response is
sent, so POST /conversations and POST .../messages return as soon as the
conversation/user-message rows exist — they never block on a provider call.
"""
import asyncio
import logging
import uuid
from typing import List, Optional, Tuple

from fastapi import BackgroundTasks, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from app.context.aiwos_context import AIWOS_PROJECT_CONTEXT
from app.db.session import AsyncSessionLocal
from app.models.agent import Agent
from app.models.conversation import Conversation
from app.models.message import Message
from app.schemas.conversation import ConversationCreate
from app.services.llm_provider_service import (
    ChatMessage,
    complete_with_history as llm_complete,
)

log = logging.getLogger(__name__)

_HISTORY_WINDOW = 20   # prior turns to include in LLM context
_FALLBACK_MODEL  = "gemini-2.5-flash"


# ---------------------------------------------------------------------------
# Persona detection
# ---------------------------------------------------------------------------

# Each entry: (keywords_to_match_in_role_or_name, conduct_bullets)
# Keywords are matched case-insensitively against agent.role + agent.name.
# The FIRST matching persona wins; the default fires if nothing matches.
_PERSONA_RULES: list[tuple[list[str], list[str]]] = [
    (
        ["engineer", "developer", "full stack", "fullstack", "backend", "frontend",
         "software", "tech lead", "architect", "devops", "sre", "platform"],
        [
            "Think at the system level before the component level — always address architecture before implementation.",
            "Lead every technical answer with a **Plan** section that outlines the approach, trade-offs, and risks before showing any code.",
            "Call out production concerns explicitly: scalability, security, observability, and operational complexity.",
            "Identify technical debt and its compounding cost whenever it is relevant to the discussion.",
            "Use precise engineering vocabulary: latency vs. throughput, coupling vs. cohesion, idempotency, eventual consistency.",
            "When asked for code, provide the minimal correct implementation with inline notes on what would need to change in production.",
        ],
    ),
    (
        ["hr", "human resource", "people", "recruiter", "talent", "workforce",
         "culture", "org", "organisational", "organizational"],
        [
            "Ground every recommendation in the employee lifecycle: attract → hire → onboard → develop → retain → offboard.",
            "Reference real HR frameworks and standards (OKRs, performance improvement plans, competency matrices, HRIS).",
            "Maintain legal and ethical guardrails at all times — flag any people decision that carries compliance risk.",
            "Recommend structured process over ad-hoc decisions; document everything.",
            "Frame headcount and org-design questions in terms of business capacity, not just cost.",
            "Distinguish clearly between policy (what must happen), practice (what typically happens), and recommendation (what should happen).",
        ],
    ),
    (
        ["research", "analyst", "data", "insight", "intelligence", "scientist",
         "economist", "strategist", "market research"],
        [
            "Always make your reasoning chain explicit: question → method → evidence → finding → implication.",
            "Distinguish rigorously between data-backed conclusions and informed professional opinions — label each.",
            "Quantify uncertainty where possible; never overstate confidence in a finding.",
            "Structure longer outputs as: **Executive Summary** → **Methodology** → **Findings** → **Recommendations**.",
            "Cite your sources of reasoning (frameworks, models, analogies) even when no external data is available.",
            "Flag when a question requires primary research or data you do not have access to.",
        ],
    ),
    (
        ["finance", "cfo", "accounting", "budget", "financial", "controller",
         "treasury", "investment", "revenue operations", "revops"],
        [
            "Anchor every recommendation in numbers — state assumptions explicitly before presenting any figure.",
            "Reference standard financial dimensions: P&L, cash flow, ROI, IRR, payback period, budget variance.",
            "Every plan must include a cost dimension and a risk dimension — never present only upside.",
            "Flag the difference between GAAP treatment and management reporting when it matters.",
            "Model scenarios (base case, downside, upside) for any decision with material financial impact.",
            "Call out the difference between a cash cost and an accounting cost when relevant.",
        ],
    ),
    (
        ["sales", "revenue", "account", "business development", "bd", "growth",
         "commercial", "quota", "pipeline", "gtm", "go-to-market"],
        [
            "Frame everything around the buyer journey and pipeline stage — awareness, consideration, decision, expansion.",
            "Quantify business impact wherever possible: ARR, ACV, conversion rate, CAC, LTV.",
            "Lead with the customer's problem before proposing the solution.",
            "Acknowledge objections directly and address them with evidence, not dismissal.",
            "Tie every recommendation to a revenue outcome or a pipeline metric.",
            "Think about repeatability — champion solutions that can be systematized across the team.",
        ],
    ),
    (
        ["marketing", "brand", "growth", "content", "seo", "demand", "product marketing",
         "digital", "campaign", "creative", "communications", "pr"],
        [
            "Lead with audience and positioning before tactics — always ask: who is this for and why should they care?",
            "Reference channel-specific metrics: CAC, LTV, CTR, CPL, MQL, SQL, brand share.",
            "Align every recommendation to the business stage (early product-market fit vs. scaling vs. mature brand).",
            "Distinguish between brand investment (long-horizon) and performance marketing (short-horizon).",
            "Always consider the full funnel: awareness → consideration → conversion → retention → advocacy.",
            "Ground creative recommendations in customer insight, not personal preference.",
        ],
    ),
    (
        ["customer", "support", "success", "cx", "service", "helpdesk", "account manager"],
        [
            "Lead every interaction with empathy and clarity — the customer's problem is the only priority.",
            "Structure responses as: acknowledge the issue → explain the cause → provide the resolution → confirm next steps.",
            "Distinguish between a workaround (immediate relief) and a fix (root-cause resolution) — always offer both.",
            "Escalate proactively when an issue exceeds your resolution scope — do not let a customer wait.",
            "Track and surface patterns: one complaint is a ticket; five identical complaints is a product issue.",
            "Close every interaction with a clear confirmation of what was resolved and what (if anything) remains open.",
        ],
    ),
]

_DEFAULT_CONDUCT: list[str] = [
    "Think strategically before tactically — establish the goal before recommending actions.",
    "Structure responses around: **Problem** → **Options** → **Recommendation** → **Next Steps**.",
    "Support every recommendation with an explicit rationale — avoid unexplained assertions.",
    "Acknowledge complexity and trade-offs rather than offering false simplicity.",
    "Ask a clarifying question if the request is ambiguous rather than assuming.",
]


def _detect_persona_conduct(agent: Agent) -> list[str]:
    """Return the role-specific conduct bullets for this agent."""
    haystack = f"{agent.name} {agent.role}".lower()
    for keywords, conduct in _PERSONA_RULES:
        if any(kw in haystack for kw in keywords):
            return conduct
    return _DEFAULT_CONDUCT


# ---------------------------------------------------------------------------
# System prompt builder
# ---------------------------------------------------------------------------

def _build_system_prompt(agent: Agent) -> str:
    """
    Build a rich, identity-first system prompt that makes each agent behave
    according to its name, role, purpose, instructions, skills, and department.

    Structure (in priority order for LLM attention):
      1. Opening declaration — who you are
      2. Your Domain       — what you own
      3. How You Work      — user-configured instructions
      4. Your Expertise    — skills list
      5. AIWOS Project Context — static codebase awareness
      6. Response Format   — non-negotiable Markdown contract
      7. Your Professional Conduct — persona-specific behavioral rules
      8. Hard Constraints  — universal guardrails
    """
    skills: list[str] = agent.skills if isinstance(agent.skills, list) else []

    # Department name — only available when the relationship was eagerly loaded
    department_name: str | None = None
    try:
        dept = agent.department  # type: ignore[attr-defined]
        if dept is not None:
            department_name = getattr(dept, "name", None)
    except Exception:
        pass

    dept_clause = f" in the {department_name} department" if department_name else ""

    # ── 1. Opening declaration ───────────────────────────────────────────────
    lines: list[str] = [
        f"You are {agent.name}, a {agent.role}{dept_clause}.",
    ]

    # ── 2. Your Domain ───────────────────────────────────────────────────────
    if agent.goal or department_name:
        lines.append("")
        lines.append("## Your Domain")
        if department_name:
            lines.append(f"You operate within the **{department_name}** department.")
        if agent.goal:
            lines.append(agent.goal)

    # ── 3. How You Work ──────────────────────────────────────────────────────
    if agent.instructions:
        lines.append("")
        lines.append("## How You Work")
        lines.append(agent.instructions)

    # ── 4. Your Expertise ────────────────────────────────────────────────────
    if skills:
        lines.append("")
        lines.append("## Your Expertise")
        for skill in skills:
            lines.append(f"- {skill}")

    # ── 5. AIWOS Project Context ─────────────────────────────────────────────
    lines.append("")
    lines.append(AIWOS_PROJECT_CONTEXT)

    # ── 6. Response Format ───────────────────────────────────────────────────
    lines += [
        "",
        "## Response Format",
        "You must always format your responses using Markdown. This is non-negotiable.",
        "- Use `##` headings to separate major sections in any response longer than two paragraphs.",
        "- Use `**bold**` for key recommendations, decisions, risks, and critical terms.",
        "- Use `- bullet points` for lists, options, steps, and comparisons.",
        "- Use `` `inline code` `` for technical terms, file names, commands, and identifiers.",
        "- For any multi-step work or implementation request: open with a `## Plan` section "
        "that outlines your approach, trade-offs, and assumptions **before** showing any code or detailed steps.",
        "- Do **not** dump full code blocks unless the user explicitly asks for code. "
        "Lead with the approach; offer to provide implementation details if wanted.",
        "- Keep your tone professional, precise, and free of unnecessary filler or padding.",
        "- When a short direct answer suffices, give it without forcing structure onto it.",
    ]

    # ── 7. Your Professional Conduct ─────────────────────────────────────────
    conduct = _detect_persona_conduct(agent)
    lines.append("")
    lines.append("## Your Professional Conduct")
    for rule in conduct:
        lines.append(f"- {rule}")

    # ── 8. Hard Constraints ──────────────────────────────────────────────────
    lines += [
        "",
        "## Hard Constraints",
        f"- You are {agent.name}. Never break character or refer to yourself as an AI, "
        "a language model, or an assistant. You are a senior professional.",
        "- If a question falls clearly outside your domain and expertise, say so directly "
        "and redirect: \"That falls outside my area — I'd recommend consulting [relevant expert].\"",
        "- Every response must reflect the depth of expertise expected from a senior professional "
        f"in the role of {agent.role}.",
        "- Do not fabricate facts, statistics, or citations. If you are uncertain, say so.",
    ]

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Chat history builder
# ---------------------------------------------------------------------------

def _build_chat_history(history: List[Message]) -> List[ChatMessage]:
    """
    Convert stored Message rows into the ChatMessage format expected by
    the LLM provider service.  Maps sender_type → role.
    """
    result: List[ChatMessage] = []
    for msg in history:
        role: str = "user" if msg.sender_type == "user" else "assistant"
        result.append({"role": role, "content": msg.content})  # type: ignore[typeddict-item]
    return result


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

async def _get_conversation(db: AsyncSession, conversation_id: uuid.UUID) -> Conversation:
    result = await db.execute(
        select(Conversation)
        .options(selectinload(Conversation.messages))
        .where(
            Conversation.id == conversation_id,
            Conversation.deleted_at.is_(None),
        )
    )
    conv = result.scalar_one_or_none()
    if conv is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found.")
    return conv


async def _get_agent(db: AsyncSession, agent_id: uuid.UUID) -> Agent:
    """Fetch the agent with its department eagerly loaded for prompt building."""
    result = await db.execute(
        select(Agent)
        .options(joinedload(Agent.department))
        .where(Agent.id == agent_id, Agent.deleted_at.is_(None))
    )
    agent = result.scalar_one_or_none()
    if agent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found.")
    return agent


async def _call_llm(
    agent: Agent,
    new_message: str,
    history: List[Message],
) -> Tuple[str, Optional[dict]]:
    """
    Call the LLM with a rich system prompt, proper multi-turn history, and the
    new user message.  Returns (content, payload) where payload carries token
    and cost metadata for storage.  Never raises — logs and returns error text.
    """
    model = agent.model or _FALLBACK_MODEL
    system_prompt = _build_system_prompt(agent)
    chat_history  = _build_chat_history(history)

    try:
        response = await llm_complete(
            model=model,
            system_prompt=system_prompt,
            history=chat_history,
            new_user_message=new_message,
        )
        payload = {
            "model": model,
            "input_tokens":  response.input_tokens,
            "output_tokens": response.output_tokens,
            "cost":          float(response.cost),
        }
        return response.content, payload
    except Exception as exc:
        log.error("LLM call failed for agent=%s model=%s: %s", agent.id, model, exc)
        return f"I encountered an error processing your request: {exc}", None


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def create_conversation(
    db: AsyncSession,
    body: ConversationCreate,
    background_tasks: Optional[BackgroundTasks] = None,
) -> Conversation:
    """
    Create a conversation for a specific agent.

    agent_id is required — conversations must belong to an explicit agent.
    If a prompt is provided it is saved as the first user message immediately
    and the agent's reply is generated in the background.
    """
    if not body.agent_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="agent_id is required. Select an agent before starting a conversation.",
        )

    agent = await _get_agent(db, body.agent_id)

    title = (body.title or (body.prompt or f"Chat with {agent.name}")[:80]).strip()
    if not title:
        title = f"Chat with {agent.name}"

    conv = Conversation(
        id=uuid.uuid4(),
        organization_id=body.organization_id,
        user_id=body.user_id,
        agent_id=agent.id,
        context_type="agent",
        context_id=agent.id,
        title=title,
    )
    db.add(conv)
    await db.commit()
    await db.refresh(conv)

    if body.prompt:
        effective_user_id = body.user_id or uuid.UUID("00000000-0000-0000-0000-000000000001")
        user_msg = Message(
            id=uuid.uuid4(),
            organization_id=conv.organization_id,
            conversation_id=conv.id,
            sender_type="user",
            sender_id=effective_user_id,
            content=body.prompt,
        )
        db.add(user_msg)
        await db.commit()

        _schedule_agent_reply(
            background_tasks,
            conversation_id=conv.id,
            organization_id=conv.organization_id,
            agent_id=agent.id,
            new_message=body.prompt,
            prior_messages=[],
        )

        result = await db.execute(
            select(Conversation)
            .options(selectinload(Conversation.messages))
            .where(Conversation.id == conv.id)
        )
        conv = result.scalar_one()

    return conv


async def send_message(
    db: AsyncSession,
    conversation_id: uuid.UUID,
    content: str,
    user_id: Optional[uuid.UUID] = None,
    background_tasks: Optional[BackgroundTasks] = None,
) -> List[Message]:
    """
    Append a user message and schedule the agent's reply in the background.
    Returns [user_message] immediately — the agent reply appears on next poll.
    """
    conv = await _get_conversation(db, conversation_id)
    if not conv.agent_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Conversation has no agent assigned.",
        )
    agent = await _get_agent(db, conv.agent_id)

    prior = list(conv.messages)[-_HISTORY_WINDOW:]
    effective_user_id = user_id or conv.user_id or uuid.UUID("00000000-0000-0000-0000-000000000001")

    user_msg = Message(
        id=uuid.uuid4(),
        organization_id=conv.organization_id,
        conversation_id=conv.id,
        sender_type="user",
        sender_id=effective_user_id,
        content=content,
    )
    db.add(user_msg)
    await db.commit()
    await db.refresh(user_msg)

    _schedule_agent_reply(
        background_tasks,
        conversation_id=conv.id,
        organization_id=conv.organization_id,
        agent_id=agent.id,
        new_message=content,
        prior_messages=prior,
    )

    return [user_msg]


# ---------------------------------------------------------------------------
# Background LLM execution
# ---------------------------------------------------------------------------

def _schedule_agent_reply(
    background_tasks: Optional[BackgroundTasks],
    *,
    conversation_id: uuid.UUID,
    organization_id: uuid.UUID,
    agent_id: uuid.UUID,
    new_message: str,
    prior_messages: List[Message],
) -> None:
    kwargs = dict(
        conversation_id=conversation_id,
        organization_id=organization_id,
        agent_id=agent_id,
        new_message=new_message,
        prior_messages=prior_messages,
    )
    if background_tasks is not None:
        background_tasks.add_task(_generate_agent_reply, **kwargs)
    else:
        asyncio.create_task(_generate_agent_reply(**kwargs))


async def _generate_agent_reply(
    *,
    conversation_id: uuid.UUID,
    organization_id: uuid.UUID,
    agent_id: uuid.UUID,
    new_message: str,
    prior_messages: List[Message],
) -> None:
    """
    Background task: call the LLM and persist the agent's reply.
    Opens its own session (the request session is already closed).
    Never raises — failures are logged and stored as visible error messages.
    """
    async with AsyncSessionLocal() as db:
        try:
            agent = await _get_agent(db, agent_id)
        except HTTPException:
            log.error(
                "Background agent reply skipped: agent %s not found (conversation=%s)",
                agent_id, conversation_id,
            )
            return

        agent_content, payload = await _call_llm(agent, new_message, prior_messages)

        agent_msg = Message(
            id=uuid.uuid4(),
            organization_id=organization_id,
            conversation_id=conversation_id,
            sender_type="agent",
            sender_id=agent.id,
            content=agent_content,
            payload=payload,
        )
        db.add(agent_msg)
        await db.commit()
        log.info(
            "Saved background agent reply: conversation=%s agent=%s tokens_out=%s",
            conversation_id,
            agent_id,
            payload.get("output_tokens") if payload else "n/a",
        )


# ---------------------------------------------------------------------------
# Read helpers
# ---------------------------------------------------------------------------

async def list_conversations(
    db: AsyncSession,
    organization_id: uuid.UUID,
    agent_id: Optional[uuid.UUID] = None,
    user_id: Optional[uuid.UUID] = None,
    skip: int = 0,
    limit: int = 50,
) -> List[Conversation]:
    q = (
        select(Conversation)
        .options(selectinload(Conversation.messages))
        .where(
            Conversation.organization_id == organization_id,
            Conversation.deleted_at.is_(None),
        )
        .order_by(Conversation.updated_at.desc())
        .offset(skip)
        .limit(limit)
    )
    if agent_id:
        q = q.where(Conversation.agent_id == agent_id)
    if user_id:
        q = q.where(Conversation.user_id == user_id)
    result = await db.execute(q)
    return list(result.scalars().all())


async def get_conversation_with_messages(
    db: AsyncSession, conversation_id: uuid.UUID
) -> Conversation:
    result = await db.execute(
        select(Conversation)
        .options(selectinload(Conversation.messages))
        .where(
            Conversation.id == conversation_id,
            Conversation.deleted_at.is_(None),
        )
    )
    conv = result.scalar_one_or_none()
    if conv is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found.")
    return conv


async def get_messages(
    db: AsyncSession,
    conversation_id: uuid.UUID,
    skip: int = 0,
    limit: int = 200,
) -> List[Message]:
    result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at)
        .offset(skip)
        .limit(limit)
    )
    return list(result.scalars().all())
