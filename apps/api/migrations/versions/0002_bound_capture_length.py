"""Bound capture text length.

Revision ID: 0002
Revises: 0001
Create Date: 2026-07-24
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0002"
down_revision: str | Sequence[str] | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

MAX_CAPTURE_CHARACTERS = 50_000


def upgrade() -> None:
    op.create_check_constraint(
        "ck_captures_raw_text_length",
        "captures",
        f"length(raw_text) <= {MAX_CAPTURE_CHARACTERS}",
    )


def downgrade() -> None:
    op.drop_constraint(
        "ck_captures_raw_text_length",
        "captures",
        type_="check",
    )
