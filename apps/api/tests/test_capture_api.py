from collections.abc import AsyncIterator
from unittest.mock import AsyncMock
from uuid import UUID

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from weavance_api.database import get_session
from weavance_api.main import app
from weavance_api.models import Capture


async def test_create_capture_persists_original_text(
    monkeypatch: pytest.MonkeyPatch,
    test_database_url: str,
) -> None:
    engine = create_async_engine(test_database_url)
    test_session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async def override_get_session() -> AsyncIterator[AsyncSession]:
        async with test_session_factory() as session:
            yield session

    monkeypatch.setitem(
        app.dependency_overrides,
        get_session,
        override_get_session,
    )
    raw_text = "  Renew my license before Friday\nCall the dentist  "

    try:
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test",
        ) as client:
            response = await client.post("/captures", json={"raw_text": raw_text})

        assert response.status_code == 201
        response_body = response.json()
        capture_id = UUID(response_body["id"])

        async with test_session_factory() as session:
            stored_capture = await session.scalar(
                select(Capture).where(Capture.id == capture_id)
            )
    finally:
        await engine.dispose()

    assert response_body["raw_text"] == raw_text
    assert response_body["created_at"] is not None
    assert stored_capture is not None
    assert stored_capture.raw_text == raw_text


async def test_create_capture_rejects_blank_text(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    mock_session = AsyncMock(spec=AsyncSession)

    async def override_get_session() -> AsyncIterator[AsyncSession]:
        yield mock_session

    monkeypatch.setitem(
        app.dependency_overrides,
        get_session,
        override_get_session,
    )

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        response = await client.post("/captures", json={"raw_text": " \n\t "})

    assert response.status_code == 422
