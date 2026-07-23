import os
from collections.abc import Iterator
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config

API_ROOT = Path(__file__).parents[1]


@pytest.fixture(scope="session")
def test_database_url() -> Iterator[str]:
    database_url = os.getenv("WEAVANCE_TEST_DATABASE_URL")
    if database_url is None:
        pytest.skip("WEAVANCE_TEST_DATABASE_URL is required for PostgreSQL integration tests")

    alembic_config = Config(API_ROOT / "alembic.ini")
    alembic_config.attributes["database_url"] = database_url
    command.upgrade(alembic_config, "head")

    yield database_url

    command.downgrade(alembic_config, "base")
