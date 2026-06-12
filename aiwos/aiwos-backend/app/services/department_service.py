import uuid
from typing import List

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.department import Department
from app.schemas.department import DepartmentCreate, DepartmentUpdate


async def create_department(db: AsyncSession, body: DepartmentCreate) -> Department:
    dept = Department(
        id=uuid.uuid4(),
        organization_id=body.organization_id,
        name=body.name,
        description=body.description,
        is_custom=body.is_custom,
    )
    db.add(dept)
    try:
        await db.commit()
        await db.refresh(dept)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid organization_id or duplicate department name within the organization.",
        )
    return dept


async def get_department(db: AsyncSession, dept_id: uuid.UUID) -> Department:
    result = await db.execute(
        select(Department).where(Department.id == dept_id, Department.deleted_at.is_(None))
    )
    dept = result.scalar_one_or_none()
    if dept is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found.")
    return dept


async def list_departments(
    db: AsyncSession,
    organization_id: uuid.UUID,
    skip: int = 0,
    limit: int = 50,
) -> List[Department]:
    result = await db.execute(
        select(Department)
        .where(Department.organization_id == organization_id, Department.deleted_at.is_(None))
        .order_by(Department.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return list(result.scalars().all())


async def update_department(
    db: AsyncSession,
    dept_id: uuid.UUID,
    body: DepartmentUpdate,
) -> Department:
    dept = await get_department(db, dept_id)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(dept, field, value)
    try:
        await db.commit()
        await db.refresh(dept)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Duplicate department name within the organization.",
        )
    return dept


async def delete_department(db: AsyncSession, dept_id: uuid.UUID) -> None:
    dept = await get_department(db, dept_id)
    dept.delete()
    await db.commit()
