import uuid
from typing import List

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.department import Department
from app.models.user import User
from app.schemas.department import DepartmentCreate, DepartmentResponse, DepartmentUpdate
from app.services.department_service import (
    create_department,
    delete_department,
    get_department,
    list_departments,
    update_department,
)

router = APIRouter(prefix="/departments", tags=["departments"])


@router.post("", response_model=DepartmentResponse, status_code=status.HTTP_201_CREATED)
async def create(
    body: DepartmentCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> Department:
    return await create_department(db, body)


@router.get("", response_model=List[DepartmentResponse])
async def list_all(
    organization_id: uuid.UUID,
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> List[Department]:
    return await list_departments(db, organization_id, skip=skip, limit=limit)


@router.get("/{dept_id}", response_model=DepartmentResponse)
async def get_one(
    dept_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> Department:
    return await get_department(db, dept_id)


@router.patch("/{dept_id}", response_model=DepartmentResponse)
async def update_one(
    dept_id: uuid.UUID,
    body: DepartmentUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> Department:
    return await update_department(db, dept_id, body)


@router.delete("/{dept_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_one(
    dept_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> None:
    await delete_department(db, dept_id)
