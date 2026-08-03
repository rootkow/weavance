from __future__ import annotations

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PostgreSQLUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from weavance_api.database import Base
from weavance_api.domain.recommendation import MAX_REENTRY_POINT_CHARACTERS

EpisodeEventType = Literal[
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


class RecommendationEpisode(Base):
    __tablename__ = "recommendation_episodes"
    __table_args__ = (
        CheckConstraint(
            "length(btrim(entry_point)) > 0",
            name="ck_recommendation_episodes_entry_point_not_blank",
        ),
        CheckConstraint(
            "length(btrim(stopping_condition)) > 0",
            name="ck_recommendation_episodes_stopping_condition_not_blank",
        ),
        CheckConstraint(
            "length(btrim(reason)) > 0",
            name="ck_recommendation_episodes_reason_not_blank",
        ),
    )

    id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True), primary_key=True)
    task_id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        ForeignKey("tasks.id", ondelete="RESTRICT"),
        nullable=False,
    )
    action_id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        ForeignKey("actions.id", ondelete="RESTRICT"),
        nullable=False,
    )
    parent_episode_id: Mapped[UUID | None] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        ForeignKey("recommendation_episodes.id", ondelete="RESTRICT"),
        nullable=True,
    )
    entry_point: Mapped[str] = mapped_column(Text, nullable=False)
    stopping_condition: Mapped[str] = mapped_column(Text, nullable=False)
    context_snapshot: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    explanation_factors: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB,
        nullable=False,
    )
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    strategy_name: Mapped[str] = mapped_column(Text, nullable=False)
    strategy_version: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    task: Mapped[Task] = relationship()
    action: Mapped[Action] = relationship()
    parent_episode: Mapped[RecommendationEpisode | None] = relationship(
        remote_side="RecommendationEpisode.id",
    )
    events: Mapped[list[EpisodeEvent]] = relationship(
        back_populates="episode",
        cascade="all, delete-orphan",
        order_by="EpisodeEvent.created_at",
    )


class EpisodeEvent(Base):
    __tablename__ = "episode_events"
    __table_args__ = (
        CheckConstraint(
            """
            event_type IN (
                'accepted',
                'resized',
                'deferred',
                'swapped',
                'overwhelmed',
                'done_for_now',
                'progress_made',
                'did_not_start',
                'keep_going'
            )
            """,
            name="ck_episode_events_event_type",
        ),
    )

    id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True), primary_key=True)
    episode_id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        ForeignKey("recommendation_episodes.id", ondelete="CASCADE"),
        nullable=False,
    )
    event_type: Mapped[EpisodeEventType] = mapped_column(Text, nullable=False)
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    episode: Mapped[RecommendationEpisode] = relationship(back_populates="events")


class ReentryCheckpoint(Base):
    __tablename__ = "reentry_checkpoints"
    __table_args__ = (
        CheckConstraint(
            "length(btrim(entry_point)) > 0",
            name="ck_reentry_checkpoints_entry_point_not_blank",
        ),
        CheckConstraint(
            f"length(entry_point) <= {MAX_REENTRY_POINT_CHARACTERS}",
            name="ck_reentry_checkpoints_entry_point_length",
        ),
    )

    id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True), primary_key=True)
    task_id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        ForeignKey("tasks.id", ondelete="RESTRICT"),
        nullable=False,
    )
    action_id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        ForeignKey("actions.id", ondelete="RESTRICT"),
        nullable=False,
    )
    source_episode_id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        ForeignKey("recommendation_episodes.id", ondelete="RESTRICT"),
        nullable=False,
        unique=True,
    )
    reentry_episode_id: Mapped[UUID | None] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        ForeignKey("recommendation_episodes.id", ondelete="RESTRICT"),
        nullable=True,
        unique=True,
    )
    entry_point: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    task: Mapped[Task] = relationship()
    action: Mapped[Action] = relationship()
    source_episode: Mapped[RecommendationEpisode] = relationship(
        foreign_keys=[source_episode_id],
    )
    reentry_episode: Mapped[RecommendationEpisode | None] = relationship(
        foreign_keys=[reentry_episode_id],
    )


from weavance_api.models.task import Action, Task  # noqa: E402
