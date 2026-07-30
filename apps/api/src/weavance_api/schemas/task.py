from datetime import datetime
from typing import Annotated, Any, Literal
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    StringConstraints,
    field_validator,
    model_validator,
)

NonBlankString = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
TaskStatusValue = Literal["active", "completed", "archived"]
ActionStatusValue = Literal["active", "completed", "archived"]


class ActionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, frozen=True)

    id: UUID
    task_id: UUID
    source_interpretation_id: UUID
    description: str
    status: ActionStatusValue
    position: int
    provenance: dict[str, Any]
    duration: dict[str, Any] | None
    created_at: datetime
    updated_at: datetime

    @field_validator("created_at", "updated_at")
    @classmethod
    def timestamps_must_include_timezone(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("timestamps must include a timezone")
        return value


class TaskResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, frozen=True)

    id: UUID
    source_capture_id: UUID
    source_interpretation_id: UUID
    title: str
    status: TaskStatusValue
    provenance: dict[str, Any]
    deadline: dict[str, Any] | None
    importance: dict[str, Any] | None
    created_at: datetime
    updated_at: datetime
    actions: tuple[ActionResponse, ...]

    @field_validator("created_at", "updated_at")
    @classmethod
    def timestamps_must_include_timezone(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("timestamps must include a timezone")
        return value


class TaskUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    title: NonBlankString | None = None
    status: TaskStatusValue | None = None

    @model_validator(mode="after")
    def must_include_a_change(self) -> "TaskUpdate":
        if self.title is None and self.status is None:
            raise ValueError("at least one task field must be provided")
        return self


class TaskContentUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    title: NonBlankString
    action_id: UUID
    action_description: NonBlankString


class ActionUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    description: NonBlankString | None = None
    status: ActionStatusValue | None = None

    @model_validator(mode="after")
    def must_include_a_change(self) -> "ActionUpdate":
        if self.description is None and self.status is None:
            raise ValueError("at least one action field must be provided")
        return self
