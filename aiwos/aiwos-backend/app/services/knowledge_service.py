import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.knowledge_file import KnowledgeFile

_UPLOADS_ROOT = Path("uploads/knowledge")
_ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt", ".md", ".csv"}


async def list_knowledge_files(
    db: AsyncSession,
    organization_id: uuid.UUID,
) -> list[KnowledgeFile]:
    result = await db.execute(
        select(KnowledgeFile)
        .where(
            KnowledgeFile.organization_id == organization_id,
            KnowledgeFile.deleted_at.is_(None),
        )
        .order_by(KnowledgeFile.created_at.desc())
    )
    return list(result.scalars().all())


async def upload_knowledge_file(
    db: AsyncSession,
    organization_id: uuid.UUID,
    user_id: uuid.UUID,
    file: UploadFile,
) -> KnowledgeFile:
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in _ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"File type '{suffix}' not supported. Allowed: {', '.join(sorted(_ALLOWED_EXTENSIONS))}",
        )

    file_id = uuid.uuid4()
    dest = _UPLOADS_ROOT / str(organization_id) / f"{file_id}{suffix}"
    dest.parent.mkdir(parents=True, exist_ok=True)

    content = await file.read()
    dest.write_bytes(content)

    kf = KnowledgeFile(
        id=file_id,
        organization_id=organization_id,
        name=file.filename or dest.name,
        file_path=str(dest),
        file_type=suffix.lstrip("."),
        file_size=len(content),
        created_by=user_id,
    )
    db.add(kf)
    await db.commit()
    await db.refresh(kf)
    return kf


async def delete_knowledge_file(
    db: AsyncSession,
    file_id: uuid.UUID,
) -> None:
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
    if path.exists():
        path.unlink()

    kf.delete()
    await db.commit()
