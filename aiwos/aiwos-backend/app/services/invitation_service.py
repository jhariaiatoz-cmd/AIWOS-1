import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import create_access_token, hash_password
from app.models.organization import Organization
from app.models.organization_invitation import OrganizationInvitation
from app.models.organization_member import OrganizationMember
from app.models.user import User
from app.schemas.organization import InvitationAccept, InvitationCreate
from app.services import notification_service
from app.services.email_service import email_service


async def create_invitation(
    db: AsyncSession,
    org_id: uuid.UUID,
    body: InvitationCreate,
    inviter: User,
) -> OrganizationInvitation:
    # Inviter must be an admin of the org
    membership_result = await db.execute(
        select(OrganizationMember).where(
            OrganizationMember.organization_id == org_id,
            OrganizationMember.user_id == inviter.id,
        )
    )
    membership = membership_result.scalar_one_or_none()
    if membership is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")
    if membership.role.lower() != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can invite users.",
        )

    org_result = await db.execute(
        select(Organization).where(
            Organization.id == org_id,
            Organization.deleted_at.is_(None),
        )
    )
    org = org_result.scalar_one_or_none()
    if org is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")

    # Check if email is already a member
    existing_member = await db.execute(
        select(OrganizationMember)
        .join(User, User.id == OrganizationMember.user_id)
        .where(
            OrganizationMember.organization_id == org_id,
            User.email == body.email.lower(),
            User.deleted_at.is_(None),
        )
    )
    if existing_member.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This email address is already a member of the organization.",
        )

    # Expire any previous pending invitations for this email+org
    prev_result = await db.execute(
        select(OrganizationInvitation).where(
            OrganizationInvitation.organization_id == org_id,
            OrganizationInvitation.email == body.email.lower(),
            OrganizationInvitation.status == "pending",
        )
    )
    for prev in prev_result.scalars().all():
        prev.status = "expired"

    token = secrets.token_urlsafe(48)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=settings.INVITATION_EXPIRE_HOURS)

    invitation = OrganizationInvitation(
        id=uuid.uuid4(),
        organization_id=org_id,
        email=body.email.lower(),
        role=body.role,
        token=token,
        status="pending",
        invited_by=inviter.id,
        expires_at=expires_at,
    )
    db.add(invitation)
    await db.commit()
    await db.refresh(invitation)

    invite_url = f"{settings.FRONTEND_URL}/accept-invite?token={token}"
    inviter_name = inviter.full_name or inviter.email
    await email_service.send_invitation(
        to_email=body.email,
        org_name=org.name,
        role=body.role,
        invite_url=invite_url,
        invited_by_name=inviter_name,
    )

    try:
        await notification_service.create_notification(
            db,
            organization_id=org_id,
            type="user_invited",
            title=f"Invitation sent to {body.email}",
            body=f"{inviter_name} invited {body.email} as {body.role} to {org.name}",
            entity_id=invitation.id,
            entity_type="invitation",
            user_id=inviter.id,
        )
    except Exception:
        pass

    return invitation


async def get_invitation_by_token(
    db: AsyncSession,
    token: str,
) -> Dict[str, Any]:
    result = await db.execute(
        select(OrganizationInvitation, Organization)
        .join(Organization, Organization.id == OrganizationInvitation.organization_id)
        .where(OrganizationInvitation.token == token)
    )
    row = result.first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invitation not found.")

    invitation, org = row

    if invitation.status == "accepted":
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="This invitation has already been accepted.",
        )

    now = datetime.now(timezone.utc)
    if invitation.expires_at < now or invitation.status == "expired":
        invitation.status = "expired"
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="This invitation has expired.",
        )

    return {
        "id": invitation.id,
        "organization_id": invitation.organization_id,
        "organization_name": org.name,
        "email": invitation.email,
        "role": invitation.role,
        "status": invitation.status,
        "expires_at": invitation.expires_at,
    }


async def accept_invitation(
    db: AsyncSession,
    token: str,
    body: InvitationAccept,
) -> Dict[str, Any]:
    result = await db.execute(
        select(OrganizationInvitation).where(OrganizationInvitation.token == token)
    )
    invitation = result.scalar_one_or_none()
    if invitation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invitation not found.")

    if invitation.status == "accepted":
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="This invitation has already been accepted.",
        )

    now = datetime.now(timezone.utc)
    if invitation.expires_at < now or invitation.status == "expired":
        invitation.status = "expired"
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="This invitation has expired.",
        )

    # Find or create user by email
    user_result = await db.execute(
        select(User).where(User.email == invitation.email, User.deleted_at.is_(None))
    )
    user = user_result.scalar_one_or_none()

    if user is None:
        if not body.password:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="A password is required to create your account.",
            )
        user = User(
            id=uuid.uuid4(),
            email=invitation.email,
            hashed_password=hash_password(body.password),
            full_name=body.full_name,
        )
        db.add(user)
        await db.flush()

    # Prevent duplicate membership
    existing_member = await db.execute(
        select(OrganizationMember).where(
            OrganizationMember.organization_id == invitation.organization_id,
            OrganizationMember.user_id == user.id,
        )
    )
    if existing_member.scalar_one_or_none() is not None:
        invitation.status = "accepted"
        await db.commit()
        access_token = create_access_token(str(user.id))
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "organization_id": invitation.organization_id,
        }

    membership = OrganizationMember(
        id=uuid.uuid4(),
        organization_id=invitation.organization_id,
        user_id=user.id,
        role=invitation.role,
    )
    db.add(membership)

    invitation.status = "accepted"
    await db.commit()

    if invitation.invited_by:
        try:
            await notification_service.create_notification(
                db,
                organization_id=invitation.organization_id,
                type="invitation_accepted",
                title=f"{user.full_name or invitation.email} accepted your invitation",
                body=f"{invitation.email} joined the organization as {invitation.role}",
                entity_id=invitation.id,
                entity_type="invitation",
                user_id=invitation.invited_by,
            )
        except Exception:
            pass

    access_token = create_access_token(str(user.id))
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "organization_id": invitation.organization_id,
    }
