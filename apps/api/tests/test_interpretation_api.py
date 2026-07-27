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
from weavance_api.models import Interpretation


async def test_interpretation_review_is_persisted_as_a_new_version(
    monkeypatch: pytest.MonkeyPatch,
    test_database_url: str,
) -> None:
    engine = create_async_engine(test_database_url)
    test_session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async def override_get_session() -> AsyncIterator[AsyncSession]:
        async with test_session_factory() as session:
            yield session

    monkeypatch.setitem(app.dependency_overrides, get_session, override_get_session)

    try:
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test",
        ) as client:
            capture_response = await client.post(
                "/captures",
                json={"raw_text": "- Reply to the recruiter\n- Schedule the dentist"},
            )
            capture_id = capture_response.json()["id"]

            proposal_response = await client.post(
                f"/captures/{capture_id}/interpretations",
                json={
                    "reference_time": "2026-07-27T10:00:00-04:00",
                    "time_zone": "America/Detroit",
                },
            )
            proposal_body = proposal_response.json()
            first_task = proposal_body["proposal"]["tasks"][0]
            added_task_id = "573719dc-ff51-49e8-953e-d1ec479caafc"
            added_action_id = "83ed36fb-6f4f-4ca3-9bb5-6e0856723e92"
            confirmation_payload = {
                "tasks": [
                    {
                        "id": first_task["id"],
                        "title": "Reply to Jake",
                        "action_id": first_task["actions"][0]["id"],
                        "action_description": "Open Jake's message and draft a reply",
                    },
                    {
                        "id": added_task_id,
                        "title": "Pick up a prescription",
                        "action_id": added_action_id,
                        "action_description": "Check when the pharmacy closes",
                    },
                ]
            }

            confirmation_response = await client.post(
                (
                    f"/captures/{capture_id}/interpretations/"
                    f"{proposal_body['id']}/confirm"
                ),
                json=confirmation_payload,
            )
            retry_response = await client.post(
                (
                    f"/captures/{capture_id}/interpretations/"
                    f"{proposal_body['id']}/confirm"
                ),
                json=confirmation_payload,
            )

        assert proposal_response.status_code == 201
        assert proposal_body["version"] == 1
        assert proposal_body["status"] == "proposed"
        assert len(proposal_body["proposal"]["tasks"]) == 2

        assert confirmation_response.status_code == 201
        confirmation_body = confirmation_response.json()
        assert confirmation_body["version"] == 2
        assert confirmation_body["status"] == "confirmed"
        assert confirmation_body["parent_interpretation_id"] == proposal_body["id"]
        assert confirmation_body["proposal"]["interpreter"]["name"] == "user-review"
        assert confirmation_body["proposal"]["tasks"][0]["title"] == "Reply to Jake"
        assert (
            confirmation_body["proposal"]["tasks"][0]["provenance"]["evidence_source"]
            == "user_correction"
        )
        assert confirmation_body["proposal"]["tasks"][1]["title"] == "Pick up a prescription"
        assert (
            confirmation_body["proposal"]["tasks"][1]["provenance"]["evidence_source"]
            == "user_correction"
        )
        assert retry_response.status_code == 201
        assert retry_response.json()["id"] == confirmation_body["id"]
        assert retry_response.json()["version"] == 2

        async with test_session_factory() as session:
            records = list(
                await session.scalars(
                    select(Interpretation)
                    .where(Interpretation.capture_id == UUID(capture_id))
                    .order_by(Interpretation.version)
                )
            )
    finally:
        await engine.dispose()

    assert [record.version for record in records] == [1, 2]
    assert [record.status for record in records] == ["proposed", "confirmed"]
    assert len(records[0].proposal["tasks"]) == 2
    assert len(records[1].proposal["tasks"]) == 2
    assert records[1].parent_interpretation_id == records[0].id


async def test_latest_confirmed_interpretations_include_each_capture_once(
    monkeypatch: pytest.MonkeyPatch,
    test_database_url: str,
) -> None:
    engine = create_async_engine(test_database_url)
    test_session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async def override_get_session() -> AsyncIterator[AsyncSession]:
        async with test_session_factory() as session:
            yield session

    monkeypatch.setitem(app.dependency_overrides, get_session, override_get_session)

    try:
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test",
        ) as client:
            initial_response = await client.get("/interpretations/confirmed")
            initial_ids = {
                interpretation["id"] for interpretation in initial_response.json()
            }
            confirmed_ids: list[str] = []
            for raw_text in ("Update my resume", "Schedule the dentist"):
                capture_response = await client.post(
                    "/captures",
                    json={"raw_text": raw_text},
                )
                capture_id = capture_response.json()["id"]
                proposal_response = await client.post(
                    f"/captures/{capture_id}/interpretations",
                    json={
                        "reference_time": "2026-07-27T10:00:00-04:00",
                        "time_zone": "America/Detroit",
                    },
                )
                proposal = proposal_response.json()
                task = proposal["proposal"]["tasks"][0]
                confirmation_response = await client.post(
                    (
                        f"/captures/{capture_id}/interpretations/"
                        f"{proposal['id']}/confirm"
                    ),
                    json={
                        "tasks": [
                            {
                                "id": task["id"],
                                "title": task["title"],
                                "action_id": task["actions"][0]["id"],
                                "action_description": task["actions"][0]["description"],
                            }
                        ]
                    },
                )
                confirmed_ids.append(confirmation_response.json()["id"])

            list_response = await client.get("/interpretations/confirmed")
    finally:
        await engine.dispose()

    assert list_response.status_code == 200
    response_body = list_response.json()
    new_interpretations = [
        interpretation
        for interpretation in response_body
        if interpretation["id"] not in initial_ids
    ]
    assert [interpretation["id"] for interpretation in new_interpretations] == confirmed_ids
    assert [
        interpretation["proposal"]["tasks"][0]["title"]
        for interpretation in new_interpretations
    ] == ["Update my resume", "Schedule the dentist"]


async def test_create_interpretation_rejects_unknown_capture(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    mock_session = AsyncMock(spec=AsyncSession)
    mock_session.get.return_value = None

    async def override_get_session() -> AsyncIterator[AsyncSession]:
        yield mock_session

    monkeypatch.setitem(app.dependency_overrides, get_session, override_get_session)

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        response = await client.post(
            f"/captures/{UUID(int=0)}/interpretations",
            json={
                "reference_time": "2026-07-27T10:00:00-04:00",
                "time_zone": "America/Detroit",
            },
        )

    assert response.status_code == 404


async def test_create_interpretation_rejects_mismatched_timezone_offset() -> None:
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        response = await client.post(
            f"/captures/{UUID(int=0)}/interpretations",
            json={
                "reference_time": "2026-07-27T10:00:00Z",
                "time_zone": "America/Detroit",
            },
        )

    assert response.status_code == 422
