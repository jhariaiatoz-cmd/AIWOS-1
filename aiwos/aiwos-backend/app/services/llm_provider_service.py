"""
LLM provider service — OpenAI only.

All LLM requests are routed through OpenAI. OPENAI_API_KEY must be set in the
environment; OPENAI_MODEL selects the default model (falls back to gpt-4o-mini).

Two entry points:
  complete(model, system_prompt, user_prompt)
      Single-turn convenience wrapper — equivalent to a conversation
      with no prior history.

  complete_with_history(model, system_prompt, history, new_user_message)
      Multi-turn entry point.  history is a list of ChatMessage dicts
      (role "user" | "assistant", content str) representing the prior
      turns of the conversation.
"""

import asyncio
from enum import Enum
from typing import Literal, TypedDict

from pydantic import BaseModel
from openai import (
    AsyncOpenAI,
    RateLimitError as _OAIRateLimitError,
    APIStatusError as _OAIAPIStatusError,
    APITimeoutError as _OAIAPITimeoutError,
)

from app.core.config import settings


class ChatMessage(TypedDict):
    """A single turn in a multi-turn conversation."""
    role: Literal["user", "assistant"]
    content: str


class LLMResponse(BaseModel):
    content: str
    input_tokens: int
    output_tokens: int
    cost: float


# ---------------------------------------------------------------------------
# Transient-error detection
# ---------------------------------------------------------------------------

def is_retryable_error(exc: Exception) -> bool:
    """Return True for transient OpenAI errors that should trigger a retry."""
    if isinstance(exc, (_OAIRateLimitError, _OAIAPITimeoutError)):
        return True
    if isinstance(exc, _OAIAPIStatusError) and exc.status_code in {500, 502, 503, 504}:
        return True
    if isinstance(exc, (asyncio.TimeoutError, TimeoutError)):
        return True
    return False


# ---------------------------------------------------------------------------
# Structured error classification
# ---------------------------------------------------------------------------

class ProviderErrorType(str, Enum):
    QUOTA_EXCEEDED = "quota_exceeded"
    RATE_LIMITED = "rate_limited"
    SERVICE_UNAVAILABLE = "service_unavailable"
    AUTH_ERROR = "auth_error"
    UNKNOWN = "unknown"


def classify_provider_error(exc: Exception) -> ProviderErrorType:
    """Classify an OpenAI exception into a structured, machine-readable error type."""
    if isinstance(exc, _OAIRateLimitError):
        return ProviderErrorType.RATE_LIMITED
    if isinstance(exc, _OAIAPIStatusError):
        if exc.status_code == 429:
            return ProviderErrorType.QUOTA_EXCEEDED
        if exc.status_code in {500, 502, 503, 504}:
            return ProviderErrorType.SERVICE_UNAVAILABLE
    if isinstance(exc, (asyncio.TimeoutError, TimeoutError, _OAIAPITimeoutError)):
        return ProviderErrorType.SERVICE_UNAVAILABLE
    return ProviderErrorType.UNKNOWN


# ---------------------------------------------------------------------------
# Provider helpers (OpenAI-only — kept for interface compatibility)
# ---------------------------------------------------------------------------

def get_provider_for_model(model: str) -> str:
    """All models are served through OpenAI — always returns 'openai'."""
    return "openai"


def get_fallback_models(original_model: str) -> list[tuple[str, str]]:
    """No alternative providers configured — returns an empty list."""
    return []


# ---------------------------------------------------------------------------
# Pricing table  (USD per 1 million tokens: input, output)
# ---------------------------------------------------------------------------

_OPENAI_PRICING: dict[str, tuple[float, float]] = {
    "gpt-4o":               (2.50,  10.00),
    "gpt-4o-mini":          (0.15,   0.60),
    "gpt-4-turbo":         (10.00,  30.00),
    "gpt-4-turbo-preview": (10.00,  30.00),
    "gpt-4":               (30.00,  60.00),
    "gpt-3.5-turbo":        (0.50,   1.50),
}


def _compute_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    prices = _OPENAI_PRICING.get(model)
    if not prices:
        return 0.0
    input_price, output_price = prices
    return round(
        (input_tokens * input_price + output_tokens * output_price) / 1_000_000,
        6,
    )


# ---------------------------------------------------------------------------
# OpenAI implementation — multi-turn
# ---------------------------------------------------------------------------

async def _complete_openai(
    model: str,
    system_prompt: str,
    history: list[ChatMessage],
    new_user_message: str,
) -> LLMResponse:
    if not settings.OPENAI_API_KEY:
        raise ValueError(
            "OPENAI_API_KEY is not configured. "
            "Set the OPENAI_API_KEY environment variable and restart the server."
        )

    messages: list[dict] = [{"role": "system", "content": system_prompt}]
    for turn in history:
        messages.append({"role": turn["role"], "content": turn["content"]})
    messages.append({"role": "user", "content": new_user_message})

    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    response = await client.chat.completions.create(model=model, messages=messages)

    choice = response.choices[0]
    usage = response.usage
    return LLMResponse(
        content=choice.message.content or "",
        input_tokens=usage.prompt_tokens,
        output_tokens=usage.completion_tokens,
        cost=_compute_cost(model, usage.prompt_tokens, usage.completion_tokens),
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def complete_with_history(
    model: str,
    system_prompt: str,
    history: list[ChatMessage],
    new_user_message: str,
) -> LLMResponse:
    """Multi-turn LLM call via OpenAI."""
    return await _complete_openai(model, system_prompt, history, new_user_message)


async def complete(model: str, system_prompt: str, user_prompt: str) -> LLMResponse:
    """Single-turn convenience wrapper — no prior history."""
    return await complete_with_history(model, system_prompt, [], user_prompt)


# ---------------------------------------------------------------------------
# Smoke-test entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import asyncio
    import sys

    async def _smoke_test() -> None:
        model = sys.argv[1] if len(sys.argv) > 1 else settings.OPENAI_MODEL
        print(f"Smoke-testing model: {model}")
        resp = await complete(
            model=model,
            system_prompt="You are a helpful assistant. Be concise.",
            user_prompt="Say hello in exactly five words.",
        )
        print(f"Content      : {resp.content!r}")
        print(f"Input tokens : {resp.input_tokens}")
        print(f"Output tokens: {resp.output_tokens}")
        print(f"Cost (USD)   : ${resp.cost:.6f}")

    asyncio.run(_smoke_test())
