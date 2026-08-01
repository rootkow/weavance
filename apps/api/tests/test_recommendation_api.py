import asyncio
from collections.abc import AsyncIterator

from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from weavance_api.database import get_session
from weavance_api.main import app


async def _confirm_tasks(
    client: AsyncClient,
    *,
    raw_text: str,
) -> list[dict[str, object]]:
    capture_response = await client.post("/captures", json={"raw_text": raw_text})
    capture_id = capture_response.json()["id"]
    proposal_response = await client.post(
        f"/captures/{capture_id}/interpretations",
        json={
            "reference_time": "2026-07-30T10:00:00-04:00",
            "time_zone": "America/New_York",
        },
    )
    proposal = proposal_response.json()
    proposed_tasks = proposal["proposal"]["tasks"]
    confirmation_response = await client.post(
        f"/captures/{capture_id}/interpretations/{proposal['id']}/confirm",
        json={
            "tasks": [
                {
                    "id": task["id"],
                    "title": task["title"],
                    "action_id": task["actions"][0]["id"],
                    "action_description": task["actions"][0]["description"],
                }
                for task in proposed_tasks
            ]
        },
    )
    assert confirmation_response.status_code == 201
    return proposed_tasks


async def test_bounded_recommendation_lifecycle(
    monkeypatch,
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
            proposed_tasks = await _confirm_tasks(
                client,
                raw_text="Update my resume\nSchedule a dentist appointment",
            )

            current_response = await client.get("/recommendations/current")
            recommendation_response = await client.post(
                "/recommendations",
                json={"context": {}},
            )
            recommendation = recommendation_response.json()
            duplicate_response = await client.post(
                "/recommendations",
                json={"context": {}},
            )

            accepted_response = await client.post(
                f"/recommendations/{recommendation['id']}/events",
                json={"event_type": "accepted"},
            )
            accepted = accepted_response.json()
            active_response = await client.get("/recommendations/current")
            completed_boundary_response = await client.post(
                f"/recommendations/{recommendation['id']}/events",
                json={"event_type": "done_for_now"},
            )
            invalid_second_outcome_response = await client.post(
                f"/recommendations/{recommendation['id']}/events",
                json={"event_type": "progress_made"},
            )

            next_response = await client.post(
                "/recommendations",
                json={"context": {}},
            )
            next_recommendation = next_response.json()
            resized_response = await client.post(
                f"/recommendations/{next_recommendation['id']}/events",
                json={"event_type": "resized"},
            )
            resized = resized_response.json()

            resized_accept_response = await client.post(
                f"/recommendations/{resized['replacement']['id']}/events",
                json={"event_type": "accepted"},
            )
            progress_response = await client.post(
                f"/recommendations/{resized['replacement']['id']}/events",
                json={"event_type": "progress_made"},
            )
    finally:
        await engine.dispose()

    assert current_response.status_code == 200
    assert current_response.json() is None
    assert recommendation_response.status_code == 201
    assert recommendation["state"] == "proposed"
    assert len(proposed_tasks) == 2
    assert recommendation["entry_point"]
    assert recommendation["stopping_condition"]
    assert recommendation["reason"]
    assert recommendation["strategy_name"] == "transparent-bounded-action"
    assert duplicate_response.json()["id"] == recommendation["id"]

    assert accepted_response.status_code == 201
    assert accepted["event"]["event_type"] == "accepted"
    assert accepted["episode"]["state"] == "accepted"
    assert accepted["replacement"] is None
    assert active_response.json()["id"] == recommendation["id"]
    assert active_response.json()["state"] == "accepted"

    assert completed_boundary_response.status_code == 201
    assert completed_boundary_response.json()["episode"]["state"] == "closed"
    assert completed_boundary_response.json()["replacement"] is None
    assert invalid_second_outcome_response.status_code == 409

    assert next_response.status_code == 201
    assert next_recommendation["id"] != recommendation["id"]
    assert resized_response.status_code == 201
    assert resized["event"]["event_type"] == "resized"
    assert resized["episode"]["state"] == "closed"
    assert resized["replacement"]["parent_episode_id"] == next_recommendation["id"]
    assert "setup step" in resized["replacement"]["entry_point"]
    assert resized_accept_response.json()["episode"]["state"] == "accepted"
    assert progress_response.json()["event"]["event_type"] == "progress_made"
    assert progress_response.json()["episode"]["state"] == "closed"


async def test_concurrent_duplicate_transitions_conflict(
    monkeypatch,
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
            await _confirm_tasks(
                client,
                raw_text="Prepare the quarterly planning notes",
            )
            recommendation_response = await client.post(
                "/recommendations",
                json={"context": {}},
            )
            recommendation = recommendation_response.json()
            event_url = f"/recommendations/{recommendation['id']}/events"

            accepted_responses = await asyncio.gather(
                client.post(event_url, json={"event_type": "accepted"}),
                client.post(event_url, json={"event_type": "accepted"}),
            )
            outcome_responses = await asyncio.gather(
                client.post(event_url, json={"event_type": "done_for_now"}),
                client.post(event_url, json={"event_type": "progress_made"}),
            )
    finally:
        await engine.dispose()

    assert recommendation_response.status_code == 201
    assert sorted(response.status_code for response in accepted_responses) == [
        201,
        409,
    ]
    assert sorted(response.status_code for response in outcome_responses) == [
        201,
        409,
    ]


async def test_progress_checkpoint_is_saved_and_prioritized(
    monkeypatch,
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
            await _confirm_tasks(
                client,
                raw_text="Update the project brief\nBook a dentist appointment",
            )
            recommendation_response = await client.post(
                "/recommendations",
                json={"context": {}},
            )
            recommendation = recommendation_response.json()
            event_url = f"/recommendations/{recommendation['id']}/events"
            await client.post(event_url, json={"event_type": "accepted"})

            progress_response = await client.post(
                event_url,
                json={
                    "event_type": "progress_made",
                    "reentry_point": "  Open the draft and revise the next paragraph  ",
                },
            )
            progress = progress_response.json()

            reentry_responses = await asyncio.gather(
                client.post("/recommendations", json={"context": {}}),
                client.post("/recommendations", json={"context": {}}),
            )
            reentry = reentry_responses[0].json()
            current_response = await client.get("/recommendations/current")

            await client.post(
                f"/recommendations/{reentry['id']}/events",
                json={"event_type": "accepted"},
            )
            await client.post(
                f"/recommendations/{reentry['id']}/events",
                json={"event_type": "done_for_now"},
            )
            next_response = await client.post(
                "/recommendations",
                json={"context": {}},
            )
            await client.post(
                f"/recommendations/{next_response.json()['id']}/events",
                json={"event_type": "deferred"},
            )

            invalid_checkpoint_response = await client.post(
                event_url,
                json={
                    "event_type": "done_for_now",
                    "reentry_point": "This should not be accepted",
                },
            )
    finally:
        await engine.dispose()

    checkpoint = progress["checkpoint"]
    assert progress_response.status_code == 201
    assert progress["event"]["event_type"] == "progress_made"
    assert progress["event"]["payload"]["reentry_checkpoint_id"] == checkpoint["id"]
    assert checkpoint["source_episode_id"] == recommendation["id"]
    assert checkpoint["task_id"] == recommendation["task_id"]
    assert checkpoint["action_id"] == recommendation["action_id"]
    assert checkpoint["reentry_episode_id"] is None
    assert checkpoint["entry_point"] == "Open the draft and revise the next paragraph"

    assert all(response.status_code == 201 for response in reentry_responses)
    assert reentry_responses[0].json()["id"] == reentry_responses[1].json()["id"]
    assert reentry["task_id"] == recommendation["task_id"]
    assert reentry["parent_episode_id"] == recommendation["id"]
    assert reentry["entry_point"] == checkpoint["entry_point"]
    assert reentry["explanation_factors"] == [
        {"kind": "reentry_checkpoint", "value": checkpoint["id"]}
    ]
    assert current_response.json()["id"] == reentry["id"]
    assert next_response.json()["task_id"] != recommendation["task_id"]
    assert invalid_checkpoint_response.status_code == 422


async def test_checkpoint_for_inactive_task_is_not_offered(
    monkeypatch,
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
            await _confirm_tasks(
                client,
                raw_text="Prepare a presentation\nOrder printer paper",
            )
            recommendation = (
                await client.post("/recommendations", json={"context": {}})
            ).json()
            event_url = f"/recommendations/{recommendation['id']}/events"
            await client.post(event_url, json={"event_type": "accepted"})
            progress_response = await client.post(
                event_url,
                json={
                    "event_type": "progress_made",
                    "reentry_point": "Add the next slide",
                },
            )
            completed_response = await client.patch(
                f"/tasks/{recommendation['task_id']}",
                json={"status": "completed"},
            )
            next_response = await client.post(
                "/recommendations",
                json={"context": {}},
            )
            await client.post(
                f"/recommendations/{next_response.json()['id']}/events",
                json={"event_type": "deferred"},
            )
    finally:
        await engine.dispose()

    assert progress_response.status_code == 201
    assert progress_response.json()["checkpoint"] is not None
    assert completed_response.status_code == 200
    assert next_response.status_code == 201
    assert next_response.json()["task_id"] != recommendation["task_id"]
    assert not any(
        factor["kind"] == "reentry_checkpoint"
        for factor in next_response.json()["explanation_factors"]
    )
