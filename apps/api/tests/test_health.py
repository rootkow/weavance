from unittest.mock import AsyncMock

import pytest
from httpx import ASGITransport, AsyncClient

from weavance_api import main as main_module
from weavance_api.main import app


async def test_health() -> None:
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        response = await client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "environment": "local"}


async def test_application_disposes_database_engine_on_shutdown(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    test_engine = AsyncMock()
    monkeypatch.setattr(main_module, "engine", test_engine)

    async with app.router.lifespan_context(app):
        pass

    test_engine.dispose.assert_awaited_once()
