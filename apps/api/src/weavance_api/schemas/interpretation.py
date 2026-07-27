from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    field_validator,
    model_validator,
)

from weavance_api.interpretation import InterpretationProposal

NonBlankString = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class InterpretationCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    reference_time: datetime
    time_zone: NonBlankString

    @field_validator("reference_time")
    @classmethod
    def reference_time_must_be_timezone_aware(cls, value: datetime) -> datetime:
        if value.utcoffset() is None:
            raise ValueError("reference_time must include a UTC offset")
        return value

    @field_validator("time_zone")
    @classmethod
    def time_zone_must_be_valid(cls, value: str) -> str:
        try:
            ZoneInfo(value)
        except ZoneInfoNotFoundError as exc:
            raise ValueError("time_zone must be a valid IANA time zone") from exc
        return value

    @model_validator(mode="after")
    def reference_time_must_match_time_zone(self) -> "InterpretationCreate":
        expected_offset = self.reference_time.astimezone(ZoneInfo(self.time_zone)).utcoffset()
        if self.reference_time.utcoffset() != expected_offset:
            raise ValueError("reference_time UTC offset must match time_zone")
        return self


class ReviewedTask(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    id: UUID
    title: NonBlankString
    action_id: UUID
    action_description: NonBlankString


class InterpretationConfirmation(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    tasks: tuple[ReviewedTask, ...]

    @field_validator("tasks")
    @classmethod
    def task_and_action_ids_must_be_unique(
        cls,
        value: tuple[ReviewedTask, ...],
    ) -> tuple[ReviewedTask, ...]:
        task_ids = [task.id for task in value]
        if len(task_ids) != len(set(task_ids)):
            raise ValueError("task IDs must be unique")
        action_ids = [task.action_id for task in value]
        if len(action_ids) != len(set(action_ids)):
            raise ValueError("action IDs must be unique")
        return value


class InterpretationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, frozen=True)

    id: UUID
    capture_id: UUID
    parent_interpretation_id: UUID | None
    version: int = Field(ge=1)
    status: Literal["proposed", "confirmed"]
    reference_time: datetime
    time_zone: str
    proposal: InterpretationProposal
    created_at: datetime

    @field_validator("reference_time", "created_at")
    @classmethod
    def timestamps_must_include_timezone(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("timestamps must include a timezone")
        return value

    @model_validator(mode="after")
    def proposal_must_reference_capture(self) -> "InterpretationResponse":
        if self.proposal.capture_id != self.capture_id:
            raise ValueError("proposal capture_id must match interpretation capture_id")
        return self
