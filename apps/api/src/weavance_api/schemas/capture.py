from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, field_validator


class CaptureCreate(BaseModel):
    model_config = ConfigDict(frozen=True)

    raw_text: str

    @field_validator("raw_text")
    @classmethod
    def raw_text_must_not_be_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("raw_text must not be blank")
        return value


class CaptureResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, frozen=True)

    id: UUID
    raw_text: str
    created_at: datetime

    @field_validator("created_at")
    @classmethod
    def created_at_must_include_timezone(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("created_at must include a timezone")
        return value
