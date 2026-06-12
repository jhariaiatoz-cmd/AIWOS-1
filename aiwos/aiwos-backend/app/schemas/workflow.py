import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

WorkflowStatus = Literal["Draft", "Active", "Paused", "Archived"]


class WorkflowStepCreate(BaseModel):
    model_config = ConfigDict(json_schema_extra={
        "example": {
            "name": "Data Collection Step",
            "node_id": "node-collect-data",
            "step_order": 0,
            "agent_id": "<agent_uuid>",
            "config": None,
        }
    })

    name: str = Field(min_length=1, max_length=255)
    node_id: str = Field(min_length=1, max_length=100)
    step_order: int = Field(ge=0)
    agent_id: uuid.UUID | None = None
    config: Any | None = None


class WorkflowStepResponse(BaseModel):
    id: uuid.UUID
    workflow_id: uuid.UUID
    name: str
    node_id: str
    step_order: int
    agent_id: uuid.UUID | None
    config: Any | None

    model_config = {"from_attributes": True}


class WorkflowCreate(BaseModel):
    model_config = ConfigDict(json_schema_extra={
        "example": {
            "organization_id": "<organization_uuid>",
            "name": "Customer Onboarding Workflow",
            "description": "Automated workflow for new customer onboarding",
            "graph_definition": {"nodes": [], "edges": []},
            "status": "Draft",
            "steps": [],
        }
    })

    organization_id: uuid.UUID
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    graph_definition: Any
    status: WorkflowStatus = "Draft"
    steps: list[WorkflowStepCreate] = Field(default_factory=list)


class WorkflowUpdate(BaseModel):
    model_config = ConfigDict(json_schema_extra={
        "example": {
            "name": "Customer Onboarding Workflow (v2)",
            "description": "Updated onboarding workflow with additional steps",
            "graph_definition": {"nodes": [], "edges": []},
            "status": "Active",
        }
    })

    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    graph_definition: Any | None = None
    status: WorkflowStatus | None = None


class WorkflowResponse(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    name: str
    description: str | None
    graph_definition: Any
    status: str
    steps: list[WorkflowStepResponse]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
