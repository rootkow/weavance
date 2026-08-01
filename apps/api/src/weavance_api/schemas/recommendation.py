from datetime import datetime
from typing import Annotated, Any, Literal
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    field_validator,
    model_validator,
)

NonBlankString = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
ReentryPoint = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=500),
]
EpisodeState = Literal["proposed", "accepted", "closed"]
EpisodeEventTypeValue = Literal[
    "accepted",
    "resized",
    "deferred",
    "swapped",
    "overwhelmed",
    "done_for_now",
    "progress_made",
    "did_not_start",
    "keep_going",
]


class ContextSnapshot(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    available_minutes: Annotated[int, Field(ge=1)] | None = None
    easier_requested: bool = False
    constraints: tuple[NonBlankString, ...] = ()


class RecommendationCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    context: ContextSnapshot = ContextSnapshot()


class RecommendationEpisodeResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    id: UUID
    task_id: UUID
    action_id: UUID
    parent_episode_id: UUID | None
    task_title: str
    action_description: str
    entry_point: str
    stopping_condition: str
    context_snapshot: dict[str, Any]
    explanation_factors: tuple[dict[str, Any], ...]
    reason: str
    strategy_name: str
    strategy_version: str
    state: EpisodeState
    created_at: datetime

    @field_validator("created_at")
    @classmethod
    def timestamp_must_include_timezone(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("created_at must include a timezone")
        return value


class EpisodeEventCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    event_type: EpisodeEventTypeValue
    reentry_point: ReentryPoint | None = None

    @model_validator(mode="after")
    def reentry_point_requires_progress(self) -> "EpisodeEventCreate":
        if self.reentry_point is not None and self.event_type != "progress_made":
            raise ValueError("reentry_point is only valid with progress_made")
        return self


class EpisodeEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, frozen=True)

    id: UUID
    episode_id: UUID
    event_type: EpisodeEventTypeValue
    payload: dict[str, Any]
    created_at: datetime

    @field_validator("created_at")
    @classmethod
    def timestamp_must_include_timezone(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("created_at must include a timezone")
        return value


class ReentryCheckpointResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, frozen=True)

    id: UUID
    task_id: UUID
    action_id: UUID
    source_episode_id: UUID
    reentry_episode_id: UUID | None
    entry_point: str
    created_at: datetime

    @field_validator("created_at")
    @classmethod
    def timestamp_must_include_timezone(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("created_at must include a timezone")
        return value


class RecommendationTransitionResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    event: EpisodeEventResponse
    episode: RecommendationEpisodeResponse
    replacement: RecommendationEpisodeResponse | None = None
    checkpoint: ReentryCheckpointResponse | None = None
