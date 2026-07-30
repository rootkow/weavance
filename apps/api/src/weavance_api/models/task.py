from __future__ import annotations

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PostgreSQLUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from weavance_api.database import Base

TaskStatus = Literal["active", "completed", "archived"]
ActionStatus = Literal["active", "completed", "archived"]


class Task(Base):
    __tablename__ = "tasks"
    __table_args__ = (
        CheckConstraint(
            "length(btrim(title)) > 0",
            name="ck_tasks_title_not_blank",
        ),
        CheckConstraint(
            "status IN ('active', 'completed', 'archived')",
            name="ck_tasks_status",
        ),
    )

    id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True), primary_key=True)
    source_capture_id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        ForeignKey("captures.id", ondelete="RESTRICT"),
        nullable=False,
    )
    source_interpretation_id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        ForeignKey("interpretations.id", ondelete="RESTRICT"),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[TaskStatus] = mapped_column(
        Text,
        nullable=False,
        default="active",
        server_default="active",
    )
    provenance: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    deadline: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    importance: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
    actions: Mapped[list[Action]] = relationship(
        back_populates="task",
        cascade="all, delete-orphan",
        order_by="Action.position",
    )


class Action(Base):
    __tablename__ = "actions"
    __table_args__ = (
        CheckConstraint(
            "length(btrim(description)) > 0",
            name="ck_actions_description_not_blank",
        ),
        CheckConstraint(
            "status IN ('active', 'completed', 'archived')",
            name="ck_actions_status",
        ),
        CheckConstraint(
            "position > 0",
            name="ck_actions_position_positive",
        ),
        UniqueConstraint(
            "task_id",
            "position",
            name="uq_actions_task_position",
        ),
    )

    id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True), primary_key=True)
    task_id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        ForeignKey("tasks.id", ondelete="CASCADE"),
        nullable=False,
    )
    source_interpretation_id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        ForeignKey("interpretations.id", ondelete="RESTRICT"),
        nullable=False,
    )
    description: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[ActionStatus] = mapped_column(
        Text,
        nullable=False,
        default="active",
        server_default="active",
    )
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    provenance: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    duration: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
    task: Mapped[Task] = relationship(back_populates="actions")
