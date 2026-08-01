"""Create re-entry checkpoints.

Revision ID: 0006
Revises: 0005
Create Date: 2026-08-01
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0006"
down_revision: str | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "reentry_checkpoints",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("task_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("action_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("source_episode_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("reentry_episode_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("entry_point", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "length(btrim(entry_point)) > 0",
            name="ck_reentry_checkpoints_entry_point_not_blank",
        ),
        sa.ForeignKeyConstraint(
            ["action_id"],
            ["actions.id"],
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["reentry_episode_id"],
            ["recommendation_episodes.id"],
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["source_episode_id"],
            ["recommendation_episodes.id"],
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["task_id"],
            ["tasks.id"],
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "reentry_episode_id",
            name="uq_reentry_checkpoints_reentry_episode_id",
        ),
        sa.UniqueConstraint(
            "source_episode_id",
            name="uq_reentry_checkpoints_source_episode_id",
        ),
    )
    op.create_index(
        "ix_reentry_checkpoints_open_created_at",
        "reentry_checkpoints",
        ["created_at"],
        postgresql_where=sa.text("reentry_episode_id IS NULL"),
    )


def downgrade() -> None:
    op.drop_index(
        "ix_reentry_checkpoints_open_created_at",
        table_name="reentry_checkpoints",
    )
    op.drop_table("reentry_checkpoints")
