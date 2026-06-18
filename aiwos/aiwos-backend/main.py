import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse

from app.api.v1.router import api_router
from app.core.config import settings

logger = logging.getLogger(__name__)

_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
]

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Catch-all for unhandled exceptions.

    Without this, Starlette's ServerErrorMiddleware generates the 500 response
    *outside* CORSMiddleware's send-wrapper, so no CORS headers are emitted and
    the browser incorrectly reports the failure as a CORS policy violation.
    Registering a handler here keeps the response inside ExceptionMiddleware
    (which sits inside CORSMiddleware), so CORS headers flow normally.
    """
    logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal server error."})


app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": settings.PROJECT_NAME}


@app.get("/", include_in_schema=False)
def root():
    return RedirectResponse(url="/api/v1/docs")