"""
LLM provider service — supports OpenAI, Anthropic, and Gemini.

Provider is selected automatically from the model name prefix:
  gpt-*        → OpenAI
  claude-*     → Anthropic
  gemini-*     → Gemini
"""

from pydantic import BaseModel
from openai import AsyncOpenAI
import anthropic
from google import genai as google_genai
from google.genai import types as genai_types

from app.core.config import settings


class LLMResponse(BaseModel):
    content: str
    input_tokens: int
    output_tokens: int
    cost: float


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
    "claude-opus-4-8":          (15.00,  75.00),
    "claude-sonnet-4-6":         (3.00,  15.00),
    "claude-haiku-4-5-20251001": (0.80,   4.00),
    "claude-3-5-sonnet-20241022":(3.00,  15.00),
    "claude-3-5-haiku-20241022": (0.80,   4.00),
    "claude-3-opus-20240229":   (15.00,  75.00),
    "claude-3-haiku-20240307":   (0.25,   1.25),
}

# Gemini 2.5 pricing (prompts ≤200k tokens)
_GEMINI_PRICING: dict[str, tuple[float, float]] = {
    "gemini-2.5-flash": (0.15,  0.60),
    "gemini-2.5-pro":   (1.25,  10.00),
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
# Provider implementations
# ---------------------------------------------------------------------------

async def _complete_openai(model: str, system_prompt: str, user_prompt: str) -> LLMResponse:
    if not settings.OPENAI_API_KEY:
        raise ValueError("OPENAI_API_KEY is not configured")

    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    response = await client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": user_prompt},
        ],
    )

    choice = response.choices[0]
    usage  = response.usage
    return LLMResponse(
        content=choice.message.content or "",
        input_tokens=usage.prompt_tokens,
        output_tokens=usage.completion_tokens,
        cost=_compute_cost(_OPENAI_PRICING, model, usage.prompt_tokens, usage.completion_tokens),
    )


async def _complete_anthropic(model: str, system_prompt: str, user_prompt: str) -> LLMResponse:
    if not settings.ANTHROPIC_API_KEY:
        raise ValueError("ANTHROPIC_API_KEY is not configured")

    client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
    response = await client.messages.create(
        model=model,
        max_tokens=8096,
        system=system_prompt,
        messages=[{"role": "user", "content": user_prompt}],
    )

    content = response.content[0].text if response.content else ""
    usage   = response.usage
    return LLMResponse(
        content=content,
        input_tokens=usage.input_tokens,
        output_tokens=usage.output_tokens,
        cost=_compute_cost(_ANTHROPIC_PRICING, model, usage.input_tokens, usage.output_tokens),
    )


async def _complete_gemini(model: str, system_prompt: str, user_prompt: str) -> LLMResponse:
    if not settings.GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY is not configured")

    client = google_genai.Client(api_key=settings.GEMINI_API_KEY)

    response = await client.aio.models.generate_content(
        model=model,
        contents=user_prompt,
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

async def complete(model: str, system_prompt: str, user_prompt: str) -> LLMResponse:
    """Route to the correct provider based on the model name prefix."""
    if model.startswith("gpt-"):
        return await _complete_openai(model, system_prompt, user_prompt)
    if model.startswith("claude-"):
        return await _complete_anthropic(model, system_prompt, user_prompt)
    if model.startswith("gemini-"):
        return await _complete_gemini(model, system_prompt, user_prompt)
    raise ValueError(
        f"Unknown model '{model}'. Expected a prefix of gpt-*, claude-*, or gemini-*."
    )


# ---------------------------------------------------------------------------
# Example / smoke-test entry point
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
