"""
LLM provider service — supports OpenAI, Anthropic, and Gemini.

Provider is selected automatically from the model name prefix:
  gpt-*        → OpenAI
  claude-*     → Anthropic
  gemini-*     → Gemini

Two entry points:
  complete(model, system_prompt, user_prompt)
      Single-turn convenience wrapper — equivalent to a conversation
      with no prior history.

  complete_with_history(model, system_prompt, history, new_user_message)
      Multi-turn entry point.  history is a list of ChatMessage dicts
      (role "user" | "assistant", content str) representing the prior
      turns of the conversation.  Each provider receives the history in
      its native message-array format so role semantics are preserved.
"""

import asyncio
from enum import Enum
from typing import Literal, TypedDict

from pydantic import BaseModel
from openai import AsyncOpenAI, RateLimitError as _OAIRateLimitError, APIStatusError as _OAIAPIStatusError, APITimeoutError as _OAIAPITimeoutError
import anthropic
from anthropic import RateLimitError as _AnthRateLimitError, APIStatusError as _AnthAPIStatusError, APITimeoutError as _AnthAPITimeoutError
from google import genai as google_genai
from google.genai import types as genai_types
from google.api_core import exceptions as _google_exceptions

from app.core.config import settings

# Maximum tokens the assistant may generate per turn.
# Anthropic Sonnet/Haiku support up to 8 192; Opus supports 32 768.
# The OpenAI and Gemini limits are model-specific and enforced server-side.
_ANTHROPIC_MAX_TOKENS = 8_192


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
    """Return True for transient provider errors that should trigger a retry."""
    # OpenAI: rate-limit (429) and timeout are always retryable;
    # other 5xx status codes are retryable too.
    if isinstance(exc, (_OAIRateLimitError, _OAIAPITimeoutError)):
        return True
    if isinstance(exc, _OAIAPIStatusError) and exc.status_code in {500, 502, 503, 504}:
        return True
    # Anthropic: same logic
    if isinstance(exc, (_AnthRateLimitError, _AnthAPITimeoutError)):
        return True
    if isinstance(exc, _AnthAPIStatusError) and exc.status_code in {500, 502, 503, 504}:
        return True
    # Gemini / Google API Core
    if isinstance(exc, (
        _google_exceptions.ResourceExhausted,   # 429
        _google_exceptions.InternalServerError,  # 500
        _google_exceptions.ServiceUnavailable,   # 503
        _google_exceptions.DeadlineExceeded,     # timeout / 504
    )):
        return True
    # Generic Python timeout
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
    """Classify a provider exception into a structured, machine-readable error type."""
    # Gemini: RESOURCE_EXHAUSTED covers both quota and rate-limit signals
    if isinstance(exc, _google_exceptions.ResourceExhausted):
        return ProviderErrorType.QUOTA_EXCEEDED
    if isinstance(exc, (_google_exceptions.ServiceUnavailable, _google_exceptions.InternalServerError, _google_exceptions.DeadlineExceeded)):
        return ProviderErrorType.SERVICE_UNAVAILABLE
    # OpenAI
    if isinstance(exc, _OAIRateLimitError):
        return ProviderErrorType.RATE_LIMITED
    if isinstance(exc, _OAIAPIStatusError):
        if exc.status_code == 429:
            return ProviderErrorType.QUOTA_EXCEEDED
        if exc.status_code in {500, 502, 503, 504}:
            return ProviderErrorType.SERVICE_UNAVAILABLE
    # Anthropic
    if isinstance(exc, _AnthRateLimitError):
        return ProviderErrorType.RATE_LIMITED
    if isinstance(exc, _AnthAPIStatusError):
        if exc.status_code == 429:
            return ProviderErrorType.QUOTA_EXCEEDED
        if exc.status_code in {500, 502, 503, 504}:
            return ProviderErrorType.SERVICE_UNAVAILABLE
    if isinstance(exc, (asyncio.TimeoutError, TimeoutError, _OAIAPITimeoutError, _AnthAPITimeoutError)):
        return ProviderErrorType.SERVICE_UNAVAILABLE
    return ProviderErrorType.UNKNOWN


# ---------------------------------------------------------------------------
# Provider fallback helpers
# ---------------------------------------------------------------------------

# Priority order to try when a provider fails
_FALLBACK_CHAINS: dict[str, list[str]] = {
    "gemini":    ["openai", "anthropic"],
    "openai":    ["anthropic", "gemini"],
    "anthropic": ["openai", "gemini"],
}

# Cheapest/fastest model to use when falling back to a provider
_CHEAPEST_MODELS: dict[str, str] = {
    "openai":    "gpt-4o-mini",
    "anthropic": "claude-haiku-4-5-20251001",
    "gemini":    "gemini-2.5-flash",
}


def get_provider_for_model(model: str) -> str:
    """Derive the provider name from a model string prefix."""
    if model.startswith("gpt-"):
        return "openai"
    if model.startswith("claude-"):
        return "anthropic"
    if model.startswith("gemini-"):
        return "gemini"
    return "unknown"


def get_fallback_models(original_model: str) -> list[tuple[str, str]]:
    """
    Return (provider, model) pairs to try after the original model fails,
    filtered to only those with a configured API key.
    """
    original_provider = get_provider_for_model(original_model)
    candidates = _FALLBACK_CHAINS.get(original_provider, [])
    key_map = {
        "openai":    bool(settings.OPENAI_API_KEY),
        "anthropic": bool(settings.ANTHROPIC_API_KEY),
        "gemini":    bool(settings.GEMINI_API_KEY),
    }
    return [
        (provider, _CHEAPEST_MODELS[provider])
        for provider in candidates
        if key_map.get(provider, False)
    ]


# ---------------------------------------------------------------------------
# Pricing tables  (USD per 1 million tokens: input, output)
# ---------------------------------------------------------------------------

_OPENAI_PRICING: dict[str, tuple[float, float]] = {
    "gpt-4o":               (2.50,  10.00),
    "gpt-4o-mini":          (0.15,   0.60),
    "gpt-4-turbo":         (10.00,  30.00),
    "gpt-4-turbo-preview": (10.00,  30.00),
    "gpt-4":               (30.00,  60.00),
    "gpt-3.5-turbo":        (0.50,   1.50),
}

_ANTHROPIC_PRICING: dict[str, tuple[float, float]] = {
    "claude-opus-4-8":           (15.00,  75.00),
    "claude-sonnet-4-6":          (3.00,  15.00),
    "claude-haiku-4-5-20251001":  (0.80,   4.00),
    "claude-3-5-sonnet-20241022": (3.00,  15.00),
    "claude-3-5-haiku-20241022":  (0.80,   4.00),
    "claude-3-opus-20240229":    (15.00,  75.00),
    "claude-3-haiku-20240307":    (0.25,   1.25),
}

# Gemini 2.5 pricing (prompts ≤ 200 k tokens)
_GEMINI_PRICING: dict[str, tuple[float, float]] = {
    "gemini-2.5-flash": (0.15,  0.60),
    "gemini-2.5-pro":   (1.25, 10.00),
}


def _compute_cost(
    pricing_table: dict[str, tuple[float, float]],
    model: str,
    input_tokens: int,
    output_tokens: int,
) -> float:
    prices = pricing_table.get(model)
    if not prices:
        return 0.0
    input_price, output_price = prices
    return round(
        (input_tokens * input_price + output_tokens * output_price) / 1_000_000,
        6,
    )


# ---------------------------------------------------------------------------
# Provider implementations — multi-turn
# ---------------------------------------------------------------------------

async def _complete_openai(
    model: str,
    system_prompt: str,
    history: list[ChatMessage],
    new_user_message: str,
) -> LLMResponse:
    if not settings.OPENAI_API_KEY:
        raise ValueError("OPENAI_API_KEY is not configured")

    messages: list[dict] = [{"role": "system", "content": system_prompt}]
    for turn in history:
        messages.append({"role": turn["role"], "content": turn["content"]})
    messages.append({"role": "user", "content": new_user_message})

    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    response = await client.chat.completions.create(model=model, messages=messages)

    choice = response.choices[0]
    usage  = response.usage
    return LLMResponse(
        content=choice.message.content or "",
        input_tokens=usage.prompt_tokens,
        output_tokens=usage.completion_tokens,
        cost=_compute_cost(_OPENAI_PRICING, model, usage.prompt_tokens, usage.completion_tokens),
    )


async def _complete_anthropic(
    model: str,
    system_prompt: str,
    history: list[ChatMessage],
    new_user_message: str,
) -> LLMResponse:
    if not settings.ANTHROPIC_API_KEY:
        raise ValueError("ANTHROPIC_API_KEY is not configured")

    messages: list[dict] = []
    for turn in history:
        messages.append({"role": turn["role"], "content": turn["content"]})
    messages.append({"role": "user", "content": new_user_message})

    client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
    response = await client.messages.create(
        model=model,
        max_tokens=_ANTHROPIC_MAX_TOKENS,
        system=system_prompt,
        messages=messages,
    )

    content = response.content[0].text if response.content else ""
    usage   = response.usage
    return LLMResponse(
        content=content,
        input_tokens=usage.input_tokens,
        output_tokens=usage.output_tokens,
        cost=_compute_cost(_ANTHROPIC_PRICING, model, usage.input_tokens, usage.output_tokens),
    )


async def _complete_gemini(
    model: str,
    system_prompt: str,
    history: list[ChatMessage],
    new_user_message: str,
) -> LLMResponse:
    if not settings.GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY is not configured")

    # Build alternating user / model Content objects for multi-turn context.
    # Gemini uses "model" for assistant turns (not "assistant").
    contents: list[genai_types.Content] = []
    for turn in history:
        gemini_role = "model" if turn["role"] == "assistant" else "user"
        contents.append(
            genai_types.Content(
                role=gemini_role,
                parts=[genai_types.Part(text=turn["content"])],
            )
        )
    contents.append(
        genai_types.Content(
            role="user",
            parts=[genai_types.Part(text=new_user_message)],
        )
    )

    client = google_genai.Client(api_key=settings.GEMINI_API_KEY)
    response = await client.aio.models.generate_content(
        model=model,
        contents=contents,
        config=genai_types.GenerateContentConfig(
            system_instruction=system_prompt,
        ),
    )

    content       = response.text or ""
    input_tokens  = response.usage_metadata.prompt_token_count or 0
    output_tokens = response.usage_metadata.candidates_token_count or 0

    return LLMResponse(
        content=content,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        cost=_compute_cost(_GEMINI_PRICING, model, input_tokens, output_tokens),
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
    """
    Multi-turn LLM call.  Route to the correct provider based on model prefix.
    history contains all prior turns; new_user_message is the current input.
    Each provider receives history in its native message-array format.
    """
    if model.startswith("gpt-"):
        return await _complete_openai(model, system_prompt, history, new_user_message)
    if model.startswith("claude-"):
        return await _complete_anthropic(model, system_prompt, history, new_user_message)
    if model.startswith("gemini-"):
        return await _complete_gemini(model, system_prompt, history, new_user_message)
    raise ValueError(
        f"Unknown model '{model}'. Expected a prefix of gpt-*, claude-*, or gemini-*."
    )


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
        model = sys.argv[1] if len(sys.argv) > 1 else "gemini-2.5-flash"
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
