import uuid
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.services import command_center_service

router = APIRouter(tags=["command-center"])


class CommandCenterRequest(BaseModel):
    organization_id: uuid.UUID
    prompt: str


class AssignedAgentOut(BaseModel):
    id: str
    name: str
    role: str
    phase: str


class CommandCenterResponse(BaseModel):
    is_project_command: bool
    project_id: Optional[str] = None
    project_name: Optional[str] = None
    task_count: int = 0
    workflow_id: Optional[str] = None
    workflow_name: Optional[str] = None
    assigned_agents: List[AssignedAgentOut] = []
    duplicate: bool = False
    blueprint: Optional[Dict[str, Any]] = None
    prompt_pack: Optional[Dict[str, Any]] = None


@router.post("/command-center/execute", response_model=CommandCenterResponse)
async def execute_command(
    body: CommandCenterRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CommandCenterResponse:
    result = await command_center_service.execute_command(
        db,
        organization_id=body.organization_id,
        user_id=current_user.id,
        prompt=body.prompt,
    )
    return CommandCenterResponse(
        is_project_command=result.is_project_command,
        project_id=result.project_id,
        project_name=result.project_name,
        task_count=result.task_count,
        workflow_id=result.workflow_id,
        workflow_name=result.workflow_name,
        assigned_agents=[
            AssignedAgentOut(id=a.id, name=a.name, role=a.role, phase=a.phase)
            for a in result.assigned_agents
        ],
        duplicate=result.duplicate,
        blueprint=result.blueprint,
        prompt_pack=result.prompt_pack,
    )
