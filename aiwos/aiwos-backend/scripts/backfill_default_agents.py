"""
Backfill default AIWOS agents and departments for all existing organizations.

Runs provision_organization (idempotent) for every active org. Safe to run
multiple times — only missing agents/departments are created, no duplicates.

Usage (from aiwos-backend/):
    python scripts/backfill_default_agents.py
    python scripts/backfill_default_agents.py --dry-run
"""
import asyncio
import sys
import os
import argparse
import logging

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import select

from app.db.session import AsyncSessionLocal
from app.models.organization import Organization
from app.services.provisioning_service import provision_organization, _AGENTS, _DEPARTMENTS

logging.basicConfig(level=logging.INFO, format="%(asctime)s  %(levelname)s  %(message)s")
log = logging.getLogger(__name__)


async def backfill(dry_run: bool = False) -> None:
    log.info("=== AIWOS Default Agent Backfill ===")
    log.info("Target agents : %d", len(_AGENTS))
    log.info("Target depts  : %d", len(_DEPARTMENTS))
    if dry_run:
        log.info("DRY RUN — no changes will be written")

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Organization).where(Organization.deleted_at.is_(None))
        )
        orgs = result.scalars().all()
        log.info("Found %d active organization(s)", len(orgs))

        for org in orgs:
            log.info("Provisioning org: %s (%s)", org.name, org.id)
            if not dry_run:
                try:
                    await provision_organization(db, org.id)
                    log.info("  [OK] %s", org.name)
                except Exception as exc:
                    log.error("  [FAIL] %s — %s", org.name, exc)
            else:
                log.info("  [DRY RUN] would provision %s", org.name)

    log.info("=== Backfill complete ===")


def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill default AIWOS agents for all orgs")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print which orgs would be provisioned without making any changes",
    )
    args = parser.parse_args()
    asyncio.run(backfill(dry_run=args.dry_run))


if __name__ == "__main__":
    main()
