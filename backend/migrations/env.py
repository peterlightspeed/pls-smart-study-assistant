import asyncio

from alembic import context

import app.models  # noqa: F401  (registers models on Base.metadata)
from app.database.base import Base
from app.database.session import get_engine

target_metadata = Base.metadata


def _run(connection):
    context.configure(connection=connection, target_metadata=target_metadata, compare_type=True)
    with context.begin_transaction():
        context.run_migrations()


async def _run_online():
    async with get_engine().connect() as conn:
        await conn.run_sync(_run)


asyncio.run(_run_online())
