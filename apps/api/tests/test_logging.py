import json
import logging
from datetime import UTC, datetime
from importlib.metadata import version
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from weavance_api import PACKAGE_NAME, __version__
from weavance_api.config import Settings
from weavance_api.main import app
from weavance_api.observability import REQUEST_ID_HEADER, configure_logging
from weavance_api.observability.logging import JsonEventFormatter
from weavance_api.services.captures import create_capture


def test_runtime_version_comes_from_package_metadata() -> None:
    assert __version__ == version(PACKAGE_NAME)
    assert app.version == __version__


async def test_request_log_uses_and_returns_correlation_id(
    caplog: pytest.LogCaptureFixture,
) -> None:
    request_id = "browser-request-42"

    with caplog.at_level(logging.INFO):
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test",
        ) as client:
            response = await client.get(
                "/health",
                headers={REQUEST_ID_HEADER: request_id},
            )

    request_record = next(
        record
        for record in caplog.records
        if getattr(record, "event_name", None) == "http.request.completed"
    )
    request_record_data = vars(request_record)
    request_fields = request_record_data["event_fields"]

    assert response.headers[REQUEST_ID_HEADER] == request_id
    assert request_record_data["request_id"] == request_id
    assert request_fields == {
        "method": "GET",
        "route": "/health",
        "status_code": 200,
        "duration_ms": request_fields["duration_ms"],
    }


async def test_invalid_request_id_is_replaced() -> None:
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        response = await client.get(
            "/health",
            headers={REQUEST_ID_HEADER: "unsafe\nrequest-id"},
        )

    assert response.headers[REQUEST_ID_HEADER] != "unsafe\nrequest-id"


def test_json_logging_redacts_sensitive_fields() -> None:
    formatter = JsonEventFormatter(environment="test")
    record = logging.LogRecord(
        name="weavance_api.test",
        level=logging.INFO,
        pathname=__file__,
        lineno=1,
        msg="capture.created",
        args=(),
        exc_info=None,
    )
    record.event_name = "capture.created"  # type: ignore[attr-defined]
    record.event_fields = {  # type: ignore[attr-defined]
        "capture_id": "capture-123",
        "character_count": 24,
        "raw_text": "Call the dentist tomorrow",
        "headers": {
            "authorization": "Bearer very-secret",
            "content_type": "application/json",
        },
    }

    payload = json.loads(formatter.format(record))

    assert payload["capture_id"] == "capture-123"
    assert payload["character_count"] == 24
    assert payload["raw_text"] == "[REDACTED]"
    assert payload["headers"] == {
        "authorization": "[REDACTED]",
        "content_type": "application/json",
    }
    assert "Call the dentist" not in formatter.format(record)
    assert "very-secret" not in formatter.format(record)


def test_json_logging_uses_record_creation_time() -> None:
    formatter = JsonEventFormatter(environment="test")
    record = logging.LogRecord(
        name="weavance_api.test",
        level=logging.INFO,
        pathname=__file__,
        lineno=1,
        msg="capture.created",
        args=(),
        exc_info=None,
    )
    record.created = 1_735_689_600.125

    payload = json.loads(formatter.format(record))

    assert payload["timestamp"] == datetime.fromtimestamp(record.created, UTC).isoformat()


def test_configure_logging_normalizes_uvicorn_loggers() -> None:
    configure_logging(Settings(environment="test", log_format="json"))

    uvicorn_logger = logging.getLogger("uvicorn")
    uvicorn_error_logger = logging.getLogger("uvicorn.error")
    uvicorn_access_logger = logging.getLogger("uvicorn.access")

    assert uvicorn_logger.handlers == []
    assert uvicorn_logger.propagate is True
    assert uvicorn_error_logger.handlers == []
    assert uvicorn_error_logger.propagate is True
    assert uvicorn_access_logger.handlers == []
    assert uvicorn_access_logger.propagate is False
    assert uvicorn_access_logger.disabled is True


async def test_capture_event_contains_metadata_without_original_text(
    caplog: pytest.LogCaptureFixture,
) -> None:
    session = AsyncMock(spec=AsyncSession)
    capture_id = uuid4()

    async def assign_database_values(capture: object) -> None:
        capture.id = capture_id  # type: ignore[attr-defined]

    session.refresh.side_effect = assign_database_values
    raw_text = "  Renew my license before Friday  "

    with caplog.at_level(logging.INFO):
        await create_capture(session, raw_text=raw_text)

    capture_record = next(
        record
        for record in caplog.records
        if getattr(record, "event_name", None) == "capture.created"
    )

    assert vars(capture_record)["event_fields"] == {
        "capture_id": capture_id,
        "character_count": len(raw_text),
    }
    assert raw_text not in capture_record.getMessage()
