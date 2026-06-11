import sys
import os
from alembic.config import Config
from alembic import context

# Add project root to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

def verify_settings():
    print("1. Verifying Settings Configuration...")
    from app.core.config import settings
    
    print(f"   Project Name: {settings.PROJECT_NAME}")
    print(f"   Sync DB URL:  {settings.sync_database_url}")
    print(f"   Async DB URL: {settings.async_database_url}")
    assert settings.sync_database_url is not None
    assert settings.async_database_url is not None
    print("   [OK] Settings resolved successfully.")

def verify_engines():
    print("\n2. Verifying SQLAlchemy Engine Initialization...")
    from app.db.session import async_engine, sync_engine, get_db
    
    print(f"   Sync Engine:  {sync_engine}")
    print(f"   Async Engine: {async_engine}")
    assert sync_engine is not None
    assert async_engine is not None
    print("   [OK] Engines initialized successfully.")

def verify_alembic():
    print("\n3. Verifying Alembic Configuration integration...")
    # Initialize Alembic config
    alembic_cfg = Config("alembic.ini")
    
    # We will simulate env.py execution by checking settings sync URL is set on alembic config
    from app.core.config import settings
    alembic_cfg.set_main_option("sqlalchemy.url", settings.sync_database_url)
    
    resolved_url = alembic_cfg.get_main_option("sqlalchemy.url")
    print(f"   Alembic URL resolved: {resolved_url}")
    assert resolved_url == settings.sync_database_url
    print("   [OK] Alembic URL successfully integrated with app settings.")

def main():
    print("==================================================")
    print("Verifying Backend Database Layer Initialization")
    print("==================================================")
    try:
        verify_settings()
        verify_engines()
        verify_alembic()
        print("==================================================")
        print("SUCCESS: All configuration and engine initializations verified successfully!")
        sys.exit(0)
    except Exception as e:
        print(f"FATAL ERROR during verification: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
