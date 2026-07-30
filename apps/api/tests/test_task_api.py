from collections.abc import AsyncIterator

from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from weavance_api.database import get_session
from weavance_api.main import app


async def test_confirmation_materializes_tasks_and_supports_explicit_lifecycle(
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
            capture_response = await client.post(
                "/captures",
                json={"raw_text": "Update my resume"},
            )
            capture_id = capture_response.json()["id"]
            proposal_response = await client.post(
                f"/captures/{capture_id}/interpretations",
                json={
                    "reference_time": "2026-07-28T10:00:00-04:00",
                    "time_zone": "America/Detroit",
                },
            )
            proposal = proposal_response.json()
            proposed_task = proposal["proposal"]["tasks"][0]
            proposed_action = proposed_task["actions"][0]

            confirmation_response = await client.post(
                (
                    f"/captures/{capture_id}/interpretations/"
                    f"{proposal['id']}/confirm"
                ),
                json={
                    "tasks": [
                        {
                            "id": proposed_task["id"],
                            "title": "Update backend resume bullets",
                            "action_id": proposed_action["id"],
                            "action_description": "Revise one backend resume bullet",
                        }
                    ]
                },
            )
            confirmed_interpretation = confirmation_response.json()

            list_response = await client.get("/tasks")
            materialized = [
                task
                for task in list_response.json()
                if task["source_capture_id"] == capture_id
            ]
            assert len(materialized) == 1
            task = materialized[0]
            action = task["actions"][0]

            task_update_response = await client.patch(
                f"/tasks/{task['id']}",
                json={
                    "title": "Update resume for backend roles",
                    "status": "completed",
                },
            )
            action_update_response = await client.patch(
                f"/tasks/{task['id']}/actions/{action['id']}",
                json={"description": "Open the resume and revise one backend bullet"},
            )
            archive_response = await client.patch(
                f"/tasks/{task['id']}",
                json={"status": "archived"},
            )
            active_list_response = await client.get("/tasks")
            complete_list_response = await client.get(
                "/tasks",
                params={"include_archived": "true"},
            )
    finally:
        await engine.dispose()

    assert confirmation_response.status_code == 201
    assert list_response.status_code == 200
    assert task["id"] == proposed_task["id"]
    assert task["source_interpretation_id"] == confirmed_interpretation["id"]
    assert task["title"] == "Update backend resume bullets"
    assert task["status"] == "active"
    assert task["provenance"]["evidence_source"] == "user_correction"
    assert action["id"] == proposed_action["id"]
    assert action["task_id"] == task["id"]
    assert action["source_interpretation_id"] == confirmed_interpretation["id"]
    assert action["description"] == "Revise one backend resume bullet"

    assert task_update_response.status_code == 200
    assert task_update_response.json()["title"] == "Update resume for backend roles"
    assert task_update_response.json()["status"] == "completed"
    assert (
        task_update_response.json()["provenance"]["evidence_source"]
        == "user_correction"
    )
    assert action_update_response.status_code == 200
    assert (
        action_update_response.json()["actions"][0]["description"]
        == "Open the resume and revise one backend bullet"
    )
    assert (
        action_update_response.json()["actions"][0]["provenance"]["evidence_source"]
        == "user_correction"
    )
    assert archive_response.status_code == 200
    assert archive_response.json()["status"] == "archived"
    assert task["id"] not in {item["id"] for item in active_list_response.json()}
    assert task["id"] in {item["id"] for item in complete_list_response.json()}


async def test_reconfirmation_archives_superseded_tasks_and_actions(
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
            capture_response = await client.post(
                "/captures",
                json={"raw_text": "Update my resume"},
            )
            capture_id = capture_response.json()["id"]

            first_proposal_response = await client.post(
                f"/captures/{capture_id}/interpretations",
                json={
                    "reference_time": "2026-07-28T10:00:00-04:00",
                    "time_zone": "America/Detroit",
                },
            )
            first_proposal = first_proposal_response.json()
            first_task = first_proposal["proposal"]["tasks"][0]
            first_confirmation_response = await client.post(
                (
                    f"/captures/{capture_id}/interpretations/"
                    f"{first_proposal['id']}/confirm"
                ),
                json={
                    "tasks": [
                        {
                            "id": first_task["id"],
                            "title": first_task["title"],
                            "action_id": first_task["actions"][0]["id"],
                            "action_description": first_task["actions"][0]["description"],
                        }
                    ]
                },
            )

            second_proposal_response = await client.post(
                f"/captures/{capture_id}/interpretations",
                json={
                    "reference_time": "2026-07-28T10:05:00-04:00",
                    "time_zone": "America/Detroit",
                },
            )
            second_proposal = second_proposal_response.json()
            second_task = second_proposal["proposal"]["tasks"][0]
            second_confirmation_response = await client.post(
                (
                    f"/captures/{capture_id}/interpretations/"
                    f"{second_proposal['id']}/confirm"
                ),
                json={
                    "tasks": [
                        {
                            "id": second_task["id"],
                            "title": "Update my backend resume",
                            "action_id": second_task["actions"][0]["id"],
                            "action_description": "Revise one backend bullet",
                        }
                    ]
                },
            )
            all_tasks_response = await client.get(
                "/tasks",
                params={"include_archived": "true"},
            )
    finally:
        await engine.dispose()

    assert first_confirmation_response.status_code == 201
    assert second_confirmation_response.status_code == 201
    capture_tasks = [
        task
        for task in all_tasks_response.json()
        if task["source_capture_id"] == capture_id
    ]
    assert len(capture_tasks) == 2
    superseded_task = next(
        task for task in capture_tasks if task["id"] == first_task["id"]
    )
    current_task = next(
        task for task in capture_tasks if task["id"] == second_task["id"]
    )
    assert superseded_task["status"] == "archived"
    assert {action["status"] for action in superseded_task["actions"]} == {"archived"}
    assert current_task["status"] == "active"
    assert {action["status"] for action in current_task["actions"]} == {"active"}
