import uuid
from typing import Any

from sqlalchemy import extract, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.agent import Agent
from app.models.task_execution import TaskExecution
from app.models.workflow_execution import WorkflowExecution


class AnalyticsService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_execution_metrics(self, organization_id: uuid.UUID) -> dict[str, Any]:
        row = (
            await self.db.execute(
                select(
                    func.count(TaskExecution.id).label("total"),
                    func.count(TaskExecution.id)
                    .filter(TaskExecution.status == "completed")
                    .label("successful"),
                    func.count(TaskExecution.id)
                    .filter(TaskExecution.status == "failed")
                    .label("failed"),
                    func.count(TaskExecution.id)
                    .filter(TaskExecution.retry_count > 0)
                    .label("retried"),
                    func.coalesce(
                        func.avg(TaskExecution.execution_time_ms).filter(
                            TaskExecution.status == "completed",
                            TaskExecution.execution_time_ms.is_not(None),
                        ),
                        0,
                    ).label("avg_duration_ms"),
                ).where(
                    TaskExecution.organization_id == organization_id,
                    TaskExecution.deleted_at.is_(None),
                )
            )
        ).one()

        total = int(row.total or 0)
        successful = int(row.successful or 0)
        return {
            "total": total,
            "successful": successful,
            "failed": int(row.failed or 0),
            "retried": int(row.retried or 0),
            "avg_duration_ms": round(float(row.avg_duration_ms or 0), 2),
            "success_rate": round((successful / total * 100) if total > 0 else 0.0, 1),
        }

    async def get_workflow_metrics(self, organization_id: uuid.UUID) -> dict[str, Any]:
        row = (
            await self.db.execute(
                select(
                    func.count(WorkflowExecution.id).label("total"),
                    func.count(WorkflowExecution.id)
                    .filter(WorkflowExecution.status == "completed")
                    .label("completed"),
                    func.count(WorkflowExecution.id)
                    .filter(WorkflowExecution.status == "failed")
                    .label("failed"),
                    func.count(WorkflowExecution.id)
                    .filter(WorkflowExecution.status == "running")
                    .label("running"),
                    func.coalesce(
                        func.avg(
                            extract(
                                "epoch",
                                WorkflowExecution.completed_at - WorkflowExecution.started_at,
                            )
                        ).filter(
                            WorkflowExecution.status == "completed",
                            WorkflowExecution.completed_at.is_not(None),
                            WorkflowExecution.started_at.is_not(None),
                        ),
                        0,
                    ).label("avg_duration_seconds"),
                ).where(
                    WorkflowExecution.organization_id == organization_id,
                    WorkflowExecution.deleted_at.is_(None),
                )
            )
        ).one()

        total = int(row.total or 0)
        completed = int(row.completed or 0)
        return {
            "total_executions": total,
            "completed": completed,
            "failed": int(row.failed or 0),
            "running": int(row.running or 0),
            "success_rate": round((completed / total * 100) if total > 0 else 0.0, 1),
            "avg_duration_seconds": round(float(row.avg_duration_seconds or 0), 2),
        }

    async def get_provider_usage(self, organization_id: uuid.UUID) -> list[dict[str, Any]]:
        provider_col = TaskExecution.output_data["provider_used"].astext
        rows = (
            await self.db.execute(
                select(
                    provider_col.label("provider"),
                    func.count(TaskExecution.id).label("count"),
                ).where(
                    TaskExecution.organization_id == organization_id,
                    provider_col.is_not(None),
                    TaskExecution.deleted_at.is_(None),
                ).group_by(provider_col)
                .order_by(func.count(TaskExecution.id).desc())
            )
        ).all()

        total = sum(r.count for r in rows) or 1
        return [
            {
                "provider": r.provider,
                "count": int(r.count),
                "percentage": round(r.count / total * 100, 1),
            }
            for r in rows
        ]

    async def get_agent_utilization(self, organization_id: uuid.UUID) -> list[dict[str, Any]]:
        rows = (
            await self.db.execute(
                select(
                    TaskExecution.agent_id,
                    Agent.name.label("agent_name"),
                    func.count(TaskExecution.id).label("total"),
                    func.count(TaskExecution.id)
                    .filter(TaskExecution.status == "completed")
                    .label("successful"),
                    func.count(TaskExecution.id)
                    .filter(TaskExecution.status == "failed")
                    .label("failed"),
                    func.coalesce(
                        func.avg(TaskExecution.execution_time_ms).filter(
                            TaskExecution.status == "completed",
                            TaskExecution.execution_time_ms.is_not(None),
                        ),
                        0,
                    ).label("avg_duration_ms"),
                ).join(Agent, TaskExecution.agent_id == Agent.id)
                .where(
                    TaskExecution.organization_id == organization_id,
                    TaskExecution.agent_id.is_not(None),
                    TaskExecution.deleted_at.is_(None),
                    Agent.deleted_at.is_(None),
                ).group_by(TaskExecution.agent_id, Agent.name)
                .order_by(func.count(TaskExecution.id).desc())
                .limit(20)
            )
        ).all()

        return [
            {
                "agent_id": str(r.agent_id),
                "agent_name": r.agent_name,
                "total_executions": int(r.total),
                "successful": int(r.successful or 0),
                "failed": int(r.failed or 0),
                "success_rate": round(
                    (int(r.successful or 0) / int(r.total) * 100) if int(r.total) > 0 else 0.0,
                    1,
                ),
                "avg_duration_ms": round(float(r.avg_duration_ms or 0), 2),
            }
            for r in rows
        ]
