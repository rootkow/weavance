from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from weavance_api.api.captures import router as captures_router
from weavance_api.config import get_settings
from weavance_api.observability import configure_logging
from weavance_api.observability.http import RequestLoggingMiddleware


class HealthResponse(BaseModel):
    status: str
    environment: str


settings = get_settings()
configure_logging(settings)
app = FastAPI(title="Weavance API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RequestLoggingMiddleware)
app.include_router(captures_router)


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok", environment=settings.environment)
