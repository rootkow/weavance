from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="WEAVANCE_", env_file=".env")

    environment: str = "local"
    database_url: str = "postgresql+asyncpg://weavance:weavance@localhost:5432/weavance"
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = "INFO"
    log_format: Literal["auto", "console", "json"] = "auto"


@lru_cache
def get_settings() -> Settings:
    return Settings()
