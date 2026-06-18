from typing import AsyncGenerator
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.pool import NullPool
from app.core.config import settings

# Supabase uses PgBouncer in transaction mode (port 6543). PgBouncer doesn't clean
# up asyncpg's server-side prepared statements between transactions, causing
# DuplicatePreparedStatementError on connection reuse. NullPool makes SQLAlchemy
# open/close connections per-request so PgBouncer owns all pooling; statement_cache_size=0
# tells asyncpg not to prepare statements at all.
async_engine = create_async_engine(
    settings.async_database_url,
    poolclass=NullPool,
    connect_args={"statement_cache_size": 0},
)

AsyncSessionLocal = async_sessionmaker(
    bind=async_engine,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
)

# Create sync engine and sessionmaker (useful for sync scripting / Alembic migrations context)
sync_engine = create_engine(
    settings.sync_database_url,
    pool_pre_ping=True,
    future=True
)

SyncSessionLocal = sessionmaker(
    bind=sync_engine,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
)

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency to retrieve database session in FastAPI routers."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
