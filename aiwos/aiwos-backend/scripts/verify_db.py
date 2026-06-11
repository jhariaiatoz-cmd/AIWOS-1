import sys
import os
import asyncio

# Add project root to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.config import settings
from app.db.session import async_engine, sync_engine
from sqlalchemy import text

async def verify_async():
    print("Testing async connection...")
    try:
        async with async_engine.connect() as conn:
            result = await conn.execute(text("SELECT 1"))
            val = result.scalar()
            print(f"  Async Connection Successful! SELECT 1 returned: {val}")
            return True
    except Exception as e:
        print(f"  Async Connection Failed: {e}")
        return False

def verify_sync():
    print("Testing sync connection...")
    try:
        with sync_engine.connect() as conn:
            result = conn.execute(text("SELECT 1"))
            val = result.scalar()
            print(f"  Sync Connection Successful! SELECT 1 returned: {val}")
            return True
    except Exception as e:
        print(f"  Sync Connection Failed: {e}")
        return False

async def main():
    print("==================================================")
    print("Database Settings Resolution:")
    # Mask password for safety
    sync_url = settings.sync_database_url
    async_url = settings.async_database_url
    
    print(f"  Sync URL:  {sync_url}")
    print(f"  Async URL: {async_url}")
    print("==================================================")
    
    sync_ok = verify_sync()
    async_ok = await verify_async()
    
    print("==================================================")
    if sync_ok and async_ok:
        print("SUCCESS: Both sync and async database engines connected cleanly!")
        sys.exit(0)
    else:
        print("WARNING: One or both database connections failed.")
        print("Please check your .env configuration or make sure PostgreSQL is running.")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
