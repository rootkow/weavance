"""Create canonical tasks and actions.

Revision ID: 0004
Revises: 0003
Create Date: 2026-07-28
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "tasks",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("source_capture_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("source_interpretation_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("status", sa.Text(), server_default="active", nullable=False),
        sa.Column("provenance", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("deadline", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("importance", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "length(btrim(title)) > 0",
            name="ck_tasks_title_not_blank",
        ),
        sa.CheckConstraint(
            "status IN ('active', 'completed', 'archived')",
            name="ck_tasks_status",
        ),
        sa.ForeignKeyConstraint(
            ["source_capture_id"],
            ["captures.id"],
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["source_interpretation_id"],
            ["interpretations.id"],
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_tasks_status_created_at", "tasks", ["status", "created_at"])

    op.create_table(
        "actions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("task_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("source_interpretation_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("status", sa.Text(), server_default="active", nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("provenance", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("duration", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "length(btrim(description)) > 0",
            name="ck_actions_description_not_blank",
        ),
        sa.CheckConstraint(
            "status IN ('active', 'completed', 'archived')",
            name="ck_actions_status",
        ),
        sa.CheckConstraint(
            "position > 0",
            name="ck_actions_position_positive",
        ),
        sa.ForeignKeyConstraint(
            ["source_interpretation_id"],
            ["interpretations.id"],
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(["task_id"], ["tasks.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("task_id", "position", name="uq_actions_task_position"),
    )
    op.create_index("ix_actions_task_status", "actions", ["task_id", "status"])

    op.execute(
        """
        WITH latest_confirmed AS (
            SELECT DISTINCT ON (capture_id)
                id,
                capture_id,
                proposal,
                created_at
            FROM interpretations
            WHERE status = 'confirmed'
            ORDER BY capture_id, version DESC
        )
        INSERT INTO tasks (
            id,
            source_capture_id,
            source_interpretation_id,
            title,
            status,
            provenance,
            deadline,
            importance,
            created_at,
            updated_at
        )
        SELECT
            (task.value->>'id')::uuid,
            interpretation.capture_id,
            interpretation.id,
            task.value->>'title',
            'active',
            task.value->'provenance',
            task.value->'deadline',
            task.value->'importance',
            interpretation.created_at,
            interpretation.created_at
        FROM latest_confirmed AS interpretation
        CROSS JOIN LATERAL
            jsonb_array_elements(interpretation.proposal->'tasks') AS task(value)
        """
    )
    op.execute(
        """
        WITH latest_confirmed AS (
            SELECT DISTINCT ON (capture_id)
                id,
                proposal,
                created_at
            FROM interpretations
            WHERE status = 'confirmed'
            ORDER BY capture_id, version DESC
        )
        INSERT INTO actions (
            id,
            task_id,
            source_interpretation_id,
            description,
            status,
            position,
            provenance,
            duration,
            created_at,
            updated_at
        )
        SELECT
            (action.value->>'id')::uuid,
            (task.value->>'id')::uuid,
            interpretation.id,
            action.value->>'description',
            'active',
            action.position::integer,
            action.value->'provenance',
            action.value->'duration',
            interpretation.created_at,
            interpretation.created_at
        FROM latest_confirmed AS interpretation
        CROSS JOIN LATERAL
            jsonb_array_elements(interpretation.proposal->'tasks') AS task(value)
        CROSS JOIN LATERAL
            jsonb_array_elements(task.value->'actions')
            WITH ORDINALITY AS action(value, position)
        """
    )


def downgrade() -> None:
    op.drop_index("ix_actions_task_status", table_name="actions")
    op.drop_table("actions")
    op.drop_index("ix_tasks_status_created_at", table_name="tasks")
    op.drop_table("tasks")
