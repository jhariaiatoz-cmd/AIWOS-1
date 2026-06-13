import uuid
from typing import List

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.organization import Organization
from app.schemas.organization import OrganizationCreate, OrganizationUpdate


async def create_organization(db: AsyncSession, body: OrganizationCreate) -> Organization:
    existing = await db.execute(
        select(Organization).where(
            Organization.slug == body.slug,
            Organization.deleted_at.is_(None),
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An organization with this slug already exists.",
        )

    org = Organization(id=uuid.uuid4(), name=body.name, slug=body.slug)
    db.add(org)
    await db.commit()
    await db.refresh(org)

    try:
        from app.services.provisioning_service import provision_organization
        await provision_organization(db, org.id)
    except Exception:
        pass  # provisioning failure must not block org creation

    return org


async def get_organization(db: AsyncSession, org_id: uuid.UUID) -> Organization:
    result = await db.execute(
        select(Organization).where(
            Organization.id == org_id,
            Organization.deleted_at.is_(None),
        )
    )
    org = result.scalar_one_or_none()
    if org is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found.",
        )
    return org


async def list_organizations(
    db: AsyncSession,
    skip: int = 0,
    limit: int = 50,
) -> List[Organization]:
    result = await db.execute(
        select(Organization)
        .where(Organization.deleted_at.is_(None))
        .order_by(Organization.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return list(result.scalars().all())


async def update_organization(
    db: AsyncSession,
    org_id: uuid.UUID,
    body: OrganizationUpdate,
) -> Organization:
    org = await get_organization(db, org_id)
    update_data = body.model_dump(exclude_unset=True)

    if "slug" in update_data and update_data["slug"] != org.slug:
        conflict = await db.execute(
            select(Organization).where(
                Organization.slug == update_data["slug"],
                Organization.deleted_at.is_(None),
            )
        )
        if conflict.scalar_one_or_none() is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An organization with this slug already exists.",
            )

    for field, value in update_data.items():
        setattr(org, field, value)

    await db.commit()
    await db.refresh(org)
    return org


async def delete_organization(db: AsyncSession, org_id: uuid.UUID) -> None:
    org = await get_organization(db, org_id)
    org.delete()
    await db.commit()
