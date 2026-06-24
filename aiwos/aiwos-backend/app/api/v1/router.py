from fastapi import APIRouter

from app.api.v1.endpoints.agents import router as agents_router
from app.api.v1.endpoints.analytics import router as analytics_router
from app.api.v1.endpoints.auth import router as auth_router
from app.api.v1.endpoints.command_center import router as command_center_router
from app.api.v1.endpoints.conversations import router as conversations_router
from app.api.v1.endpoints.departments import router as departments_router
from app.api.v1.endpoints.executions import router as executions_router
from app.api.v1.endpoints.invitations import router as invitations_router
from app.api.v1.endpoints.knowledge import router as knowledge_router
from app.api.v1.endpoints.notifications import router as notifications_router
from app.api.v1.endpoints.organizations import router as organizations_router
from app.api.v1.endpoints.projects import router as projects_router
from app.api.v1.endpoints.search import router as search_router
from app.api.v1.endpoints.tasks import router as tasks_router
from app.api.v1.endpoints.workflows import router as workflows_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(organizations_router)
api_router.include_router(invitations_router)
api_router.include_router(departments_router)
api_router.include_router(projects_router)
api_router.include_router(tasks_router)
api_router.include_router(agents_router)
api_router.include_router(workflows_router)
api_router.include_router(executions_router)
api_router.include_router(conversations_router)
api_router.include_router(knowledge_router)
api_router.include_router(analytics_router)
api_router.include_router(notifications_router)
api_router.include_router(search_router)
api_router.include_router(command_center_router)
