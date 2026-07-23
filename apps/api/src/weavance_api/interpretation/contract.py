from datetime import date, datetime, time
from enum import StrEnum
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

NonBlankString = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
Confidence = Annotated[float, Field(ge=0.0, le=1.0)]
PositiveMinutes = Annotated[int, Field(ge=1)]


class ContractModel(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


class EvidenceSource(StrEnum):
    USER_TEXT = "user_text"
    USER_CORRECTION = "user_correction"
    CONNECTED_SOURCE = "connected_source"
    OBSERVED_BEHAVIOR = "observed_behavior"
    GENERAL_KNOWLEDGE = "general_knowledge"
    DEFAULT = "default"


class DerivationMethod(StrEnum):
    DIRECT = "direct"
    MODEL = "model"
    RULE = "rule"
    LEARNED = "learned"


class Provenance(ContractModel):
    evidence_source: EvidenceSource
    derivation: DerivationMethod
    confidence: Confidence
    evidence: NonBlankString | None = None


class InterpretationRequest(ContractModel):
    capture_id: UUID
    raw_text: NonBlankString
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


class DeadlineObservation(ContractModel):
    date: date
    local_time: time | None = None
    time_zone: NonBlankString
    provenance: Provenance

    @field_validator("time_zone")
    @classmethod
    def time_zone_must_be_valid(cls, value: str) -> str:
        try:
            ZoneInfo(value)
        except ZoneInfoNotFoundError as exc:
            raise ValueError("time_zone must be a valid IANA time zone") from exc
        return value


class DurationEstimate(ContractModel):
    minimum_minutes: PositiveMinutes
    maximum_minutes: PositiveMinutes
    provenance: Provenance

    @model_validator(mode="after")
    def maximum_must_not_precede_minimum(self) -> "DurationEstimate":
        if self.maximum_minutes < self.minimum_minutes:
            raise ValueError("maximum_minutes must be greater than or equal to minimum_minutes")
        return self


class ImportanceEstimate(ContractModel):
    level: Literal["low", "medium", "high"]
    provenance: Provenance


class ActionProposal(ContractModel):
    id: UUID
    description: NonBlankString
    provenance: Provenance
    duration: DurationEstimate | None = None


class TaskProposal(ContractModel):
    id: UUID
    title: NonBlankString
    provenance: Provenance
    actions: tuple[ActionProposal, ...] = Field(min_length=1)
    deadline: DeadlineObservation | None = None
    importance: ImportanceEstimate | None = None


class InterpreterDescriptor(ContractModel):
    name: NonBlankString
    version: NonBlankString


class InterpretationProposal(ContractModel):
    schema_version: Literal["1"] = "1"
    capture_id: UUID
    interpreter: InterpreterDescriptor
    tasks: tuple[TaskProposal, ...]

    @model_validator(mode="after")
    def proposal_ids_must_be_unique(self) -> "InterpretationProposal":
        task_ids = [task.id for task in self.tasks]
        if len(task_ids) != len(set(task_ids)):
            raise ValueError("task proposal IDs must be unique")

        action_ids = [action.id for task in self.tasks for action in task.actions]
        if len(action_ids) != len(set(action_ids)):
            raise ValueError("action proposal IDs must be unique")

        return self
