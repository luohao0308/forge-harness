"""add database idempotency for Desktop Git Worktree audit phases

Revision ID: 20260821_0054
Revises: 20260819_0053
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260821_0054"
down_revision: str | None = "20260819_0053"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_index(
        "admin_audit_events_git_worktree_uidx",
        "admin_audit_events",
        ["organization_id", "event_type", "resource_type", "resource_id", "action"],
        unique=True,
        sqlite_where=sa.text(
            "event_type = 'DESKTOP_GIT_WORKTREE_AUDITED' "
            "AND resource_type = 'desktop_git_worktree'"
        ),
        postgresql_where=sa.text(
            "event_type = 'DESKTOP_GIT_WORKTREE_AUDITED' "
            "AND resource_type = 'desktop_git_worktree'"
        ),
    )


def downgrade() -> None:
    op.drop_index("admin_audit_events_git_worktree_uidx", "admin_audit_events")