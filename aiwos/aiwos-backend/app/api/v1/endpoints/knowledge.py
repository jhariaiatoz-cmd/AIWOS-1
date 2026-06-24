import uuid
from pathlib import Path
from typing import List

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse, PlainTextResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.knowledge_chunk import KnowledgeChunk
from app.models.knowledge_file import KnowledgeFile
from app.models.user import User
from app.schemas.knowledge import KnowledgeChunkSearchResult, KnowledgeFileResponse
from app.services.knowledge_retrieval_service import search_knowledge
from app.services.knowledge_service import (
    delete_knowledge_file,
    list_knowledge_files,
    upload_knowledge_file,
)

router = APIRouter(prefix="/knowledge", tags=["knowledge"])


@router.get("", response_model=List[KnowledgeFileResponse])
async def list_files(
    organization_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> List:
    return await list_knowledge_files(db, organization_id)


@router.get("/search", response_model=List[KnowledgeChunkSearchResult])
async def search_files(
    organization_id: uuid.UUID,
    task_title: str,
    task_description: str = Query(default=""),
    agent_role: str = Query(default=""),
    limit: int = Query(default=5, ge=1, le=20),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> List:
    """
    Return the most relevant knowledge chunks for a given task context.
    Useful for previewing which document sections an agent will reference.
    """
    chunks = await search_knowledge(
        db, organization_id, task_title, task_description, agent_role, limit
    )
    return [
        KnowledgeChunkSearchResult(
            file_id=c.file_id,
            file_name=c.file_name,
            chunk_index=c.chunk_index,
            content=c.content,
            relevance_score=c.relevance_score,
        )
        for c in chunks
    ]


@router.post("/upload", response_model=KnowledgeFileResponse, status_code=status.HTTP_201_CREATED)
async def upload_file(
    organization_id: uuid.UUID = Form(...),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await upload_knowledge_file(db, organization_id, current_user.id, file)


@router.delete("/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_file(
    file_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> None:
    await delete_knowledge_file(db, file_id)


_MEDIA_TYPES: dict[str, str] = {
    "pdf": "application/pdf",
    "txt": "text/plain",
    "md": "text/markdown",
    "csv": "text/csv",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


@router.get("/{file_id}/content")
async def view_file_content(
    file_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> FileResponse:
    result = await db.execute(
        select(KnowledgeFile).where(
            KnowledgeFile.id == file_id,
            KnowledgeFile.deleted_at.is_(None),
        )
    )
    kf = result.scalar_one_or_none()
    if kf is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found.")
    path = Path(kf.file_path)
    if not path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found on disk.")
    media_type = _MEDIA_TYPES.get(kf.file_type, "application/octet-stream")
    return FileResponse(path, media_type=media_type, filename=kf.name)


@router.get("/{file_id}/text")
async def get_file_text(
    file_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> PlainTextResponse:
    result = await db.execute(
        select(KnowledgeFile).where(
            KnowledgeFile.id == file_id,
            KnowledgeFile.deleted_at.is_(None),
        )
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found.")
    chunk_result = await db.execute(
        select(KnowledgeChunk.content)
        .where(KnowledgeChunk.knowledge_file_id == file_id)
        .order_by(KnowledgeChunk.chunk_index)
    )
    text = "\n\n".join(chunk_result.scalars().all())
    return PlainTextResponse(text or "(No text extracted from this document.)")
