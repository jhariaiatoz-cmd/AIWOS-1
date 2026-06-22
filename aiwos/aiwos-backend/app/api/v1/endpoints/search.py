import uuid
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.agent import Agent
from app.models.project import Project
from app.models.task import Task
from app.models.user import User
from app.models.workflow import Workflow

router = APIRouter(prefix="/search", tags=["search"])


class SearchResult(BaseModel):
    id: uuid.UUID
    type: Literal["agent", "task", "workflow", "project"]
    title: str
    subtitle: Optional[str] = None


class SearchResponse(BaseModel):
    results: List[SearchResult]
    total: int


@router.get("", response_model=SearchResponse)
async def search(
    organization_id: uuid.UUID,
    q: str,
    limit: int = 5,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> SearchResponse:
    q = q.strip()
    if not q:
        return SearchResponse(results=[], total=0)

    pattern = f"%{q}%"
    results: List[SearchResult] = []

    agents_rows = await db.execute(
        select(Agent.id, Agent.name, Agent.role)
        .where(
            Agent.organization_id == organization_id,
            Agent.deleted_at.is_(None),
            Agent.name.ilike(pattern),
        )
        .limit(limit)
    )
    for row in agents_rows.all():
        results.append(SearchResult(id=row.id, type="agent", title=row.name, subtitle=row.role))

    task_rows = await db.execute(
        select(Task.id, Task.title, Task.status)
        .where(
            Task.organization_id == organization_id,
            Task.deleted_at.is_(None),
            Task.title.ilike(pattern),
        )
        .limit(limit)
    )
    for row in task_rows.all():
        results.append(SearchResult(id=row.id, type="task", title=row.title, subtitle=row.status))

    workflow_rows = await db.execute(
        select(Workflow.id, Workflow.name, Workflow.status)
        .where(
            Workflow.organization_id == organization_id,
            Workflow.deleted_at.is_(None),
            Workflow.name.ilike(pattern),
        )
        .limit(limit)
    )
    for row in workflow_rows.all():
        results.append(
            SearchResult(id=row.id, type="workflow", title=row.name, subtitle=row.status)
        )

    project_rows = await db.execute(
        select(Project.id, Project.name, Project.status)
        .where(
            Project.organization_id == organization_id,
            Project.deleted_at.is_(None),
            Project.name.ilike(pattern),
        )
        .limit(limit)
    )
    for row in project_rows.all():
        results.append(
            SearchResult(id=row.id, type="project", title=row.name, subtitle=row.status)
        )

    return SearchResponse(results=results, total=len(results))
