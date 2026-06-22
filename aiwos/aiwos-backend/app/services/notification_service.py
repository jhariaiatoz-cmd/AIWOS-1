import uuid
from typing import List, Optional

from sqlalchemy import or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification


async def create_notification(
    db: AsyncSession,
    organization_id: uuid.UUID,
    type: str,
    title: str,
    body: Optional[str] = None,
    entity_id: Optional[uuid.UUID] = None,
    entity_type: Optional[str] = None,
    user_id: Optional[uuid.UUID] = None,
) -> Notification:
    notification = Notification(
        id=uuid.uuid4(),
        organization_id=organization_id,
        user_id=user_id,
        type=type,
        title=title,
        body=body,
        entity_id=entity_id,
        entity_type=entity_type,
        is_read=False,
    )
    db.add(notification)
    await db.commit()
    await db.refresh(notification)
    return notification


async def list_notifications(
    db: AsyncSession,
    organization_id: uuid.UUID,
    user_id: uuid.UUID,
    skip: int = 0,
    limit: int = 50,
) -> List[Notification]:
    result = await db.execute(
        select(Notification)
        .where(
            Notification.organization_id == organization_id,
            or_(Notification.user_id == user_id, Notification.user_id.is_(None)),
        )
        .order_by(Notification.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return list(result.scalars().all())


async def mark_read(
    db: AsyncSession,
    notification_id: uuid.UUID,
) -> Optional[Notification]:
    result = await db.execute(
        select(Notification).where(Notification.id == notification_id)
    )
    notification = result.scalar_one_or_none()
    if notification is None:
        return None
    notification.is_read = True
    await db.commit()
    await db.refresh(notification)
    return notification


async def mark_all_read(
    db: AsyncSession,
    organization_id: uuid.UUID,
    user_id: uuid.UUID,
) -> int:
    stmt = (
        update(Notification)
        .where(
            Notification.organization_id == organization_id,
            or_(Notification.user_id == user_id, Notification.user_id.is_(None)),
            Notification.is_read.is_(False),
        )
        .values(is_read=True)
    )
    result = await db.execute(stmt)
    await db.commit()
    return result.rowcount
