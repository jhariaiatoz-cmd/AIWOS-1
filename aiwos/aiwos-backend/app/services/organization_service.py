import uuid
from typing import Any, Dict, List, Optional

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.organization import Organization
from app.models.organization_member import OrganizationMember
from app.models.user import User
from app.schemas.organization import OrganizationCreate, OrganizationUpdate


async def create_organization(
    db: AsyncSession,
    body: OrganizationCreate,
    creator_id: Optional[uuid.UUID] = None,
) -> Organization:
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

    if creator_id is not None:
        membership = OrganizationMember(
            id=uuid.uuid4(),
            organization_id=org.id,
            user_id=creator_id,
            role="admin",
        )
        db.add(membership)
        await db.commit()

    try:
        from app.services.provisioning_service import provision_organization
        await provision_organization(db, org.id)
    except Exception:
        pass  # provisioning failure must not block org creation

    return org


async def _require_membership(
    db: AsyncSession, org_id: uuid.UUID, user_id: uuid.UUID
) -> None:
    """Raise 403 if user_id is not a member of org_id."""
    result = await db.execute(
        select(OrganizationMember).where(
            OrganizationMember.organization_id == org_id,
            OrganizationMember.user_id == user_id,
        )
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied.",
        )


async def get_organization(
    db: AsyncSession,
    org_id: uuid.UUID,
    user_id: Optional[uuid.UUID] = None,
) -> Organization:
    if user_id is not None:
        await _require_membership(db, org_id, user_id)
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
    user_id: uuid.UUID,
    skip: int = 0,
    limit: int = 50,
) -> List[Organization]:
    result = await db.execute(
        select(Organization)
        .join(OrganizationMember, OrganizationMember.organization_id == Organization.id)
        .where(
            Organization.deleted_at.is_(None),
            OrganizationMember.user_id == user_id,
        )
        .order_by(Organization.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return list(result.scalars().all())


async def update_organization(
    db: AsyncSession,
    org_id: uuid.UUID,
    body: OrganizationUpdate,
    user_id: Optional[uuid.UUID] = None,
) -> Organization:
    org = await get_organization(db, org_id, user_id=user_id)
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


async def delete_organization(
    db: AsyncSession,
    org_id: uuid.UUID,
    user_id: Optional[uuid.UUID] = None,
) -> None:
    org = await get_organization(db, org_id, user_id=user_id)
    org.delete()
    await db.commit()


async def list_organization_members(
    db: AsyncSession,
    org_id: uuid.UUID,
    user_id: Optional[uuid.UUID] = None,
) -> List[Dict[str, Any]]:
    if user_id is not None:
        await _require_membership(db, org_id, user_id)

    result = await db.execute(
        select(OrganizationMember, User)
        .join(User, User.id == OrganizationMember.user_id)
        .where(OrganizationMember.organization_id == org_id)
        .order_by(OrganizationMember.joined_at.asc())
    )
    return [
        {
            "id": m.id,
            "user_id": m.user_id,
            "email": u.email,
            "full_name": u.full_name,
            "role": m.role,
            "joined_at": m.joined_at,
        }
        for m, u in result.all()
    ]
