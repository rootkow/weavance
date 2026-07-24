import json
import logging
from collections.abc import Mapping, Sequence
from contextvars import ContextVar, Token
from datetime import UTC, datetime

from weavance_api.config import Settings

SERVICE_NAME = "weavance-api"
SERVICE_VERSION = "0.1.0"
REQUEST_ID_HEADER = "X-Request-ID"

_request_id: ContextVar[str | None] = ContextVar("request_id", default=None)
_SENSITIVE_KEYS = frozenset(
    {
        "authorization",
        "calendar_text",
        "cookie",
        "email_body",
        "model_prompt",
        "model_response",
        "password",
        "prompt",
        "raw_text",
        "response",
        "secret",
        "set_cookie",
        "token",
    }
)
_RESERVED_KEYS = frozenset(
    {
        "environment",
        "event",
        "exception",
        "level",
        "logger",
        "request_id",
        "service",
        "timestamp",
        "version",
    }
)


def bind_request_id(request_id: str) -> Token[str | None]:
    return _request_id.set(request_id)


def reset_request_id(token: Token[str | None]) -> None:
    _request_id.reset(token)


def _is_sensitive_key(key: str) -> bool:
    normalized = key.lower().replace("-", "_")
    return (
        normalized in _SENSITIVE_KEYS
        or normalized.endswith("_password")
        or normalized.endswith("_secret")
        or normalized.endswith("_token")
    )


def redact_sensitive_data(value: object, *, field_name: str | None = None) -> object:
    if field_name is not None and _is_sensitive_key(field_name):
        return "[REDACTED]"
    if isinstance(value, Mapping):
        return {
            str(key): redact_sensitive_data(item, field_name=str(key))
            for key, item in value.items()
        }
    if isinstance(value, Sequence) and not isinstance(value, (str, bytes, bytearray)):
        return [redact_sensitive_data(item) for item in value]
    return value


class EventLogger:
    def __init__(self, logger: logging.Logger) -> None:
        self._logger = logger

    def debug(self, event: str, **fields: object) -> None:
        self._log(logging.DEBUG, event, fields)

    def info(self, event: str, **fields: object) -> None:
        self._log(logging.INFO, event, fields)

    def warning(self, event: str, **fields: object) -> None:
        self._log(logging.WARNING, event, fields)

    def error(self, event: str, **fields: object) -> None:
        self._log(logging.ERROR, event, fields)

    def exception(self, event: str, **fields: object) -> None:
        self._log(logging.ERROR, event, fields, exc_info=True)

    def _log(
        self,
        level: int,
        event: str,
        fields: Mapping[str, object],
        *,
        exc_info: bool = False,
    ) -> None:
        self._logger.log(
            level,
            event,
            extra={
                "event_name": event,
                "event_fields": dict(fields),
                "request_id": _request_id.get(),
            },
            exc_info=exc_info,
        )


def get_logger(name: str) -> EventLogger:
    return EventLogger(logging.getLogger(name))


class _EventFormatter(logging.Formatter):
    def __init__(self, *, environment: str) -> None:
        super().__init__()
        self._environment = environment

    def event_data(self, record: logging.LogRecord) -> dict[str, object]:
        event = getattr(record, "event_name", record.getMessage())
        raw_fields = getattr(record, "event_fields", {})
        fields = redact_sensitive_data(raw_fields)
        if not isinstance(fields, Mapping):
            fields = {}

        data: dict[str, object] = {
            "timestamp": datetime.now(UTC).isoformat(),
            "level": record.levelname.lower(),
            "event": event,
            "service": SERVICE_NAME,
            "version": SERVICE_VERSION,
            "environment": self._environment,
            "logger": record.name,
        }
        request_id = getattr(record, "request_id", None)
        if request_id is not None:
            data["request_id"] = request_id

        for key, value in fields.items():
            output_key = f"field_{key}" if key in _RESERVED_KEYS else key
            data[output_key] = value

        if record.exc_info is not None:
            data["exception"] = self.formatException(record.exc_info)
        return data


class JsonEventFormatter(_EventFormatter):
    def format(self, record: logging.LogRecord) -> str:
        return json.dumps(
            self.event_data(record),
            default=str,
            ensure_ascii=False,
            separators=(",", ":"),
        )


class ConsoleEventFormatter(_EventFormatter):
    def format(self, record: logging.LogRecord) -> str:
        data = self.event_data(record)
        timestamp = data.pop("timestamp")
        level = data.pop("level")
        event = data.pop("event")
        service = data.pop("service")
        data.pop("version")
        data.pop("environment")
        data.pop("logger")

        context = " ".join(
            f"{key}={json.dumps(value, default=str, ensure_ascii=False)}"
            for key, value in data.items()
            if key != "exception"
        )
        message = f"{timestamp} {str(level).upper():<8} {service} {event}"
        if context:
            message = f"{message} {context}"
        exception = data.get("exception")
        if exception is not None:
            message = f"{message}\n{exception}"
        return message


def configure_logging(settings: Settings) -> None:
    log_format = settings.log_format
    if log_format == "auto":
        log_format = "console" if settings.environment == "local" else "json"

    formatter: logging.Formatter
    if log_format == "json":
        formatter = JsonEventFormatter(environment=settings.environment)
    else:
        formatter = ConsoleEventFormatter(environment=settings.environment)

    handler = logging.StreamHandler()
    handler.setFormatter(formatter)

    root_logger = logging.getLogger()
    root_logger.handlers.clear()
    root_logger.addHandler(handler)
    root_logger.setLevel(settings.log_level)
