import uuid
from typing import List

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.organization import Organization
from app.models.user import User
from app.schemas.organization import OrganizationCreate, OrganizationResponse, OrganizationUpdate
from app.services.organization_service import (
    create_organization,
    delete_organization,
    get_organization,
    list_organizations,
    update_organization,
)
from app.services.provisioning_service import provision_organization

router = APIRouter(prefix="/organizations", tags=["organizations"])


@router.post("", response_model=OrganizationResponse, status_code=status.HTTP_201_CREATED)
async def create(
    body: OrganizationCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> Organization:
    return await create_organization(db, body)


@router.get("", response_model=List[OrganizationResponse])
async def list_all(
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> List[Organization]:
    return await list_organizations(db, skip=skip, limit=limit)


@router.get("/{org_id}", response_model=OrganizationResponse)
async def get_one(
    org_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> Organization:
    return await get_organization(db, org_id)


@router.patch("/{org_id}", response_model=OrganizationResponse)
async def update_one(
    org_id: uuid.UUID,
    body: OrganizationUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> Organization:
    return await update_organization(db, org_id, body)


@router.post("/{org_id}/provision", status_code=status.HTTP_204_NO_CONTENT)
async def provision_one(
    org_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> None:
    await provision_organization(db, org_id)


@router.delete("/{org_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_one(
    org_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> None:
    await delete_organization(db, org_id)
