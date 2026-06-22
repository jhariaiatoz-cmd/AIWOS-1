from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.organization import (
    InvitationAccept,
    InvitationAcceptResponse,
    InvitationPublicResponse,
)
from app.services.invitation_service import accept_invitation, get_invitation_by_token

router = APIRouter(prefix="/invitations", tags=["invitations"])


@router.get("/{token}", response_model=InvitationPublicResponse)
async def get_invitation(
    token: str,
    db: AsyncSession = Depends(get_db),
) -> dict:
    return await get_invitation_by_token(db, token)


@router.post("/{token}/accept", response_model=InvitationAcceptResponse)
async def accept_invite(
    token: str,
    body: InvitationAccept,
    db: AsyncSession = Depends(get_db),
) -> dict:
    return await accept_invitation(db, token, body)
