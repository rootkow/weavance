"""Create bounded recommendation episodes and append-only events.

Revision ID: 0005
Revises: 0004
Create Date: 2026-07-30
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "recommendation_episodes",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("task_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("action_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("parent_episode_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("entry_point", sa.Text(), nullable=False),
        sa.Column("stopping_condition", sa.Text(), nullable=False),
        sa.Column(
            "context_snapshot",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
        ),
        sa.Column(
            "explanation_factors",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
        ),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("strategy_name", sa.Text(), nullable=False),
        sa.Column("strategy_version", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "length(btrim(entry_point)) > 0",
            name="ck_recommendation_episodes_entry_point_not_blank",
        ),
        sa.CheckConstraint(
            "length(btrim(stopping_condition)) > 0",
            name="ck_recommendation_episodes_stopping_condition_not_blank",
        ),
        sa.CheckConstraint(
            "length(btrim(reason)) > 0",
            name="ck_recommendation_episodes_reason_not_blank",
        ),
        sa.ForeignKeyConstraint(
            ["action_id"],
            ["actions.id"],
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["parent_episode_id"],
            ["recommendation_episodes.id"],
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["task_id"],
            ["tasks.id"],
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_recommendation_episodes_created_at",
        "recommendation_episodes",
        ["created_at"],
    )
    op.create_index(
        "ix_recommendation_episodes_task_created_at",
        "recommendation_episodes",
        ["task_id", "created_at"],
    )

    op.create_table(
        "episode_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("episode_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("event_type", sa.Text(), nullable=False),
        sa.Column(
            "payload",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
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
        sa.ForeignKeyConstraint(
            ["episode_id"],
            ["recommendation_episodes.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_episode_events_episode_created_at",
        "episode_events",
        ["episode_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_episode_events_episode_created_at", table_name="episode_events")
    op.drop_table("episode_events")
    op.drop_index(
        "ix_recommendation_episodes_task_created_at",
        table_name="recommendation_episodes",
    )
    op.drop_index(
        "ix_recommendation_episodes_created_at",
        table_name="recommendation_episodes",
    )
    op.drop_table("recommendation_episodes")
