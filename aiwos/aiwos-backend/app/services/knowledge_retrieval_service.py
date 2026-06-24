"""
Keyword-based knowledge retrieval for agent task execution.

Splits knowledge files into overlapping chunks and ranks them by
term-frequency overlap with the task context. No embedding API required.
"""
import re
import uuid
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.knowledge_file import KnowledgeFile

# ── Chunking parameters ───────────────────────────────────────────────────────

_CHUNK_SIZE = 800       # characters per chunk
_CHUNK_OVERLAP = 150    # overlap between adjacent chunks
_MAX_CHUNKS = 5         # top-k chunks to return per retrieval call
_MAX_CONTEXT_CHARS = 8_000  # total chars injected into prompt

# ── Stop-word list for scoring ────────────────────────────────────────────────

_STOP_WORDS = {
    "the", "and", "for", "with", "this", "that", "are", "was", "has", "have",
    "will", "can", "all", "not", "but", "they", "you", "from", "each", "its",
    "our", "any", "your", "their", "been", "also", "more", "into", "than",
    "then", "over", "only", "both", "must", "such", "when", "where", "which",
    "who", "how", "what", "should", "would", "could", "may", "might", "she",
    "him", "her", "his", "they", "them", "these", "those", "being", "were",
    "does", "did", "had", "let", "get", "put", "set", "via", "per",
}


# ── Data structures ───────────────────────────────────────────────────────────

@dataclass
class KnowledgeChunkResult:
    file_id: uuid.UUID
    file_name: str
    chunk_index: int
    content: str
    relevance_score: float  # 0.0 – 1.0


# ── File text extraction ──────────────────────────────────────────────────────

def extract_file_text(file_path: str, file_type: str) -> str:
    """Return plain text from a knowledge file on disk. Returns '' on any failure."""
    from pathlib import Path
    path = Path(file_path)
    if not path.exists():
        return ""
    try:
        if file_type in ("txt", "md", "csv"):
            return path.read_text(errors="replace")
        if file_type == "pdf":
            import pypdf
            reader = pypdf.PdfReader(str(path))
            return "\n".join(page.extract_text() or "" for page in reader.pages)
        if file_type == "docx":
            import docx
            doc = docx.Document(str(path))
            return "\n".join(p.text for p in doc.paragraphs)
    except Exception:
        pass
    return ""


# ── Chunking ──────────────────────────────────────────────────────────────────

def split_chunks(text: str) -> list[str]:
    """Sliding-window split into overlapping character chunks."""
    chunks: list[str] = []
    start = 0
    while start < len(text):
        end = min(start + _CHUNK_SIZE, len(text))
        chunks.append(text[start:end])
        if end == len(text):
            break
        start += _CHUNK_SIZE - _CHUNK_OVERLAP
    return chunks


# Keep the private alias for backward compatibility within this module
_split_chunks = split_chunks


# ── Scoring ───────────────────────────────────────────────────────────────────

def _tokenize(text: str) -> set[str]:
    """Lowercase alpha tokens of length >= 3, excluding stop words."""
    return {w for w in re.findall(r"[a-z]{3,}", text.lower())} - _STOP_WORDS


def _score(chunk: str, query_tokens: set[str]) -> float:
    """Proportion of query tokens found in the chunk (0.0 – 1.0)."""
    if not query_tokens:
        return 0.0
    return len(query_tokens & _tokenize(chunk)) / len(query_tokens)


# ── Public API ────────────────────────────────────────────────────────────────

async def search_knowledge(
    db: AsyncSession,
    organization_id: uuid.UUID,
    task_title: str,
    task_description: str,
    agent_role: str,
    limit: int = _MAX_CHUNKS,
) -> list[KnowledgeChunkResult]:
    """
    Return the top-k most relevant knowledge chunks for the given task context.
    Falls back to the first chunk of each file when there is no keyword overlap.
    """
    result = await db.execute(
        select(KnowledgeFile)
        .where(
            KnowledgeFile.organization_id == organization_id,
            KnowledgeFile.deleted_at.is_(None),
        )
        .order_by(KnowledgeFile.created_at.asc())
    )
    files = list(result.scalars().all())
    if not files:
        return []

    query_tokens = _tokenize(f"{task_title} {task_description} {agent_role}")

    candidates: list[KnowledgeChunkResult] = []
    for kf in files:
        text = extract_file_text(kf.file_path, kf.file_type).strip()
        if not text:
            continue
        for idx, chunk in enumerate(_split_chunks(text)):
            candidates.append(
                KnowledgeChunkResult(
                    file_id=kf.id,
                    file_name=kf.name,
                    chunk_index=idx,
                    content=chunk,
                    relevance_score=round(_score(chunk, query_tokens), 3),
                )
            )

    if not candidates:
        return []

    # Sort: highest score first; within equal scores, earlier chunks (lower index) first
    candidates.sort(key=lambda c: (-c.relevance_score, c.chunk_index))

    # If nothing matched, surface first chunk per file as foundational context
    top = candidates[:limit]
    if all(c.relevance_score == 0.0 for c in top):
        seen: set[uuid.UUID] = set()
        fallback: list[KnowledgeChunkResult] = []
        for c in candidates:
            if c.file_id not in seen and c.chunk_index == 0:
                c.relevance_score = 0.05  # low score signals "no specific match"
                fallback.append(c)
                seen.add(c.file_id)
            if len(fallback) >= limit:
                break
        return fallback

    return top


async def get_relevant_documents(
    db: AsyncSession,
    organization_id: uuid.UUID,
    task_title: str,
    task_description: str,
    agent_role: str,
) -> list[KnowledgeChunkResult]:
    """Alias for search_knowledge; entry point for the retrieval service contract."""
    return await search_knowledge(
        db, organization_id, task_title, task_description, agent_role
    )


async def get_document_context(
    db: AsyncSession,
    organization_id: uuid.UUID,
    task_title: str,
    task_description: str,
    agent_role: str,
) -> tuple[str, list[dict]]:
    """
    Return (prompt_text, chunks_metadata) for injection into agent prompts.

    prompt_text  – Markdown-formatted knowledge sections capped at _MAX_CONTEXT_CHARS.
    chunks_metadata – Serialisable list of {file_name, file_id, chunk_index,
                      relevance_score} for storage in output_data.
    """
    chunks = await search_knowledge(
        db, organization_id, task_title, task_description, agent_role
    )
    if not chunks:
        return "", []

    sections: list[str] = []
    metadata: list[dict] = []
    total_chars = 0

    for chunk in chunks:
        if total_chars >= _MAX_CONTEXT_CHARS:
            break
        snippet = chunk.content[: _MAX_CONTEXT_CHARS - total_chars]
        sections.append(
            f"### {chunk.file_name} (relevance: {chunk.relevance_score:.0%})\n\n{snippet}"
        )
        total_chars += len(snippet)
        metadata.append(
            {
                "file_name": chunk.file_name,
                "file_id": str(chunk.file_id),
                "chunk_index": chunk.chunk_index,
                "relevance_score": chunk.relevance_score,
            }
        )

    return "\n\n---\n\n".join(sections), metadata


# ── Chat-specific knowledge retrieval ─────────────────────────────────────────

_CHAT_KNOWLEDGE_TRIGGERS = frozenset({
    "use knowledge base",
    "search knowledge base",
    "from knowledge base",
    "from uploaded documents",
    "read document",
    "read the document",
    "uploaded document",
    "uploaded file",
})


async def get_org_filenames(
    db: AsyncSession,
    organization_id: uuid.UUID,
) -> list[str]:
    """Return file names for all non-deleted knowledge files in the organization."""
    result = await db.execute(
        select(KnowledgeFile.name)
        .where(
            KnowledgeFile.organization_id == organization_id,
            KnowledgeFile.deleted_at.is_(None),
        )
    )
    return [row[0] for row in result.all()]


def should_use_knowledge_for_chat(
    text: str,
    filenames: list[str] | None = None,
) -> bool:
    """
    Return True when the user message should trigger knowledge base retrieval.
    Matches explicit trigger phrases or a known document filename.
    """
    lower = text.lower()
    if any(trigger in lower for trigger in _CHAT_KNOWLEDGE_TRIGGERS):
        return True
    if filenames:
        for name in filenames:
            if name.lower() in lower:
                return True
    return False


async def search_knowledge_by_query(
    db: AsyncSession,
    organization_id: uuid.UUID,
    query: str,
    top_k: int = 5,
) -> list[KnowledgeChunkResult]:
    """Return the top-k most relevant chunks for a free-text query."""
    return await search_knowledge(
        db,
        organization_id,
        task_title=query,
        task_description="",
        agent_role="",
        limit=top_k,
    )


async def get_chat_document_context(
    db: AsyncSession,
    organization_id: uuid.UUID,
    query: str,
    top_k: int = 5,
    filenames: list[str] | None = None,
) -> tuple[str, str, list[dict]]:
    """
    Return (prompt_text, citations_block, chunks_metadata) for chat injection.

    When a filename is detected in the query, chunks from that specific file are
    fetched directly. Otherwise falls back to keyword-scored search across all files.
    """
    chunks: list[KnowledgeChunkResult] = []

    # Prefer targeted retrieval when the user explicitly names a file
    named_file: str | None = None
    if filenames:
        lower = query.lower()
        for name in filenames:
            if name.lower() in lower:
                named_file = name
                break

    if named_file:
        file_result = await db.execute(
            select(KnowledgeFile)
            .where(
                KnowledgeFile.organization_id == organization_id,
                KnowledgeFile.name == named_file,
                KnowledgeFile.deleted_at.is_(None),
            )
        )
        kf = file_result.scalar_one_or_none()
        if kf is not None:
            text = extract_file_text(kf.file_path, kf.file_type).strip()
            if text:
                for idx, chunk_text in enumerate(split_chunks(text)[:top_k]):
                    chunks.append(
                        KnowledgeChunkResult(
                            file_id=kf.id,
                            file_name=kf.name,
                            chunk_index=idx,
                            content=chunk_text,
                            relevance_score=1.0,
                        )
                    )

    if not chunks:
        chunks = await search_knowledge_by_query(db, organization_id, query, top_k)

    if not chunks:
        return "", "", []

    sections: list[str] = []
    metadata: list[dict] = []
    total_chars = 0

    for chunk in chunks:
        if total_chars >= _MAX_CONTEXT_CHARS:
            break
        snippet = chunk.content[: _MAX_CONTEXT_CHARS - total_chars]
        sections.append(
            f"### {chunk.file_name} (chunk {chunk.chunk_index + 1}, "
            f"relevance: {chunk.relevance_score:.0%})\n\n{snippet}"
        )
        total_chars += len(snippet)
        metadata.append(
            {
                "file_name": chunk.file_name,
                "file_id": str(chunk.file_id),
                "chunk_index": chunk.chunk_index,
                "relevance_score": chunk.relevance_score,
            }
        )

    prompt_text = "\n\n---\n\n".join(sections)

    # Build citations block
    seen_files: dict[str, list[int]] = {}
    for m in metadata:
        fname = m["file_name"]
        if fname not in seen_files:
            seen_files[fname] = []
        seen_files[fname].append(m["chunk_index"] + 1)

    citation_lines = ["Sources:"]
    for fname, chunk_nums in seen_files.items():
        citation_lines.append(f"- {fname}")
        for n in chunk_nums:
            citation_lines.append(f"- chunk {n}")
    citations_block = "\n".join(citation_lines)

    return prompt_text, citations_block, metadata
