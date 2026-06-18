import uuid
from typing import List

from fastapi import APIRouter, Depends, File, Form, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.knowledge import KnowledgeFileResponse
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
