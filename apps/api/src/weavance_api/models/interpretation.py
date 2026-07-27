from datetime import datetime
from typing import Any, Literal
from uuid import UUID, uuid4

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PostgreSQLUUID
from sqlalchemy.orm import Mapped, mapped_column

from weavance_api.database import Base

InterpretationStatus = Literal["proposed", "confirmed"]


class Interpretation(Base):
    __tablename__ = "interpretations"
    __table_args__ = (
        CheckConstraint(
            "version > 0",
            name="ck_interpretations_version_positive",
        ),
        CheckConstraint(
            "status IN ('proposed', 'confirmed')",
            name="ck_interpretations_status",
        ),
        UniqueConstraint(
            "capture_id",
            "version",
            name="uq_interpretations_capture_version",
        ),
        UniqueConstraint(
            "parent_interpretation_id",
            name="uq_interpretations_parent",
        ),
    )

    id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        server_default=text("gen_random_uuid()"),
    )
    capture_id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        ForeignKey("captures.id", ondelete="CASCADE"),
        nullable=False,
    )
    parent_interpretation_id: Mapped[UUID | None] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        ForeignKey("interpretations.id", ondelete="CASCADE"),
        nullable=True,
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[InterpretationStatus] = mapped_column(Text, nullable=False)
    reference_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    time_zone: Mapped[str] = mapped_column(Text, nullable=False)
    proposal: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
