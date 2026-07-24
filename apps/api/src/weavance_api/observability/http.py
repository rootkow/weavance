import re
from time import perf_counter
from uuid import uuid4

from starlette.datastructures import Headers, MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from weavance_api.observability.logging import (
    REQUEST_ID_HEADER,
    bind_request_id,
    get_logger,
    reset_request_id,
)

_REQUEST_ID_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$")
logger = get_logger(__name__)


class RequestLoggingMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request_id = self._request_id(scope)
        request_id_token = bind_request_id(request_id)
        started_at = perf_counter()
        status_code = 500

        async def send_with_request_id(message: Message) -> None:
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = message["status"]
                headers = MutableHeaders(raw=message["headers"])
                headers[REQUEST_ID_HEADER] = request_id
                message["headers"] = headers.raw
            await send(message)

        try:
            await self.app(scope, receive, send_with_request_id)
        except Exception:
            logger.exception(
                "http.request.failed",
                method=scope["method"],
                route=self._route_template(scope),
                status_code=status_code,
                duration_ms=self._duration_ms(started_at),
            )
            raise
        else:
            logger.info(
                "http.request.completed",
                method=scope["method"],
                route=self._route_template(scope),
                status_code=status_code,
                duration_ms=self._duration_ms(started_at),
            )
        finally:
            reset_request_id(request_id_token)

    @staticmethod
    def _request_id(scope: Scope) -> str:
        supplied_request_id = Headers(scope=scope).get(REQUEST_ID_HEADER)
        if supplied_request_id is not None and _REQUEST_ID_PATTERN.fullmatch(
            supplied_request_id
        ):
            return supplied_request_id
        return str(uuid4())

    @staticmethod
    def _route_template(scope: Scope) -> str:
        route = scope.get("route")
        route_path = getattr(route, "path", None)
        return route_path if isinstance(route_path, str) else "<unmatched>"

    @staticmethod
    def _duration_ms(started_at: float) -> float:
        return round((perf_counter() - started_at) * 1000, 3)
