"""production hardening: users columns, jobs/audit/reset tables, hot-path indexes

Revision ID: b1f2c3d4e5a6
Revises: a8b3bcec410c
Create Date: 2026-07-27 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b1f2c3d4e5a6"
down_revision: Union[str, None] = "a8b3bcec410c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- users: RBAC role + token-version revocation -----------------------
    op.add_column("users", sa.Column("role", sa.String(length=20), nullable=False,
                                     server_default="user"))
    op.add_column("users", sa.Column("token_version", sa.Integer(), nullable=False,
                                     server_default="0"))

    # --- jobs --------------------------------------------------------------
    op.create_table(
        "jobs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("job_type", sa.String(length=50), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
        sa.Column("params", sa.JSON(), nullable=True),
        sa.Column("result", sa.JSON(), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_jobs_id", "jobs", ["id"])
    op.create_index("ix_jobs_user_id", "jobs", ["user_id"])
    op.create_index("ix_jobs_status", "jobs", ["status"])

    # --- audit_logs --------------------------------------------------------
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("action", sa.String(length=80), nullable=False),
        sa.Column("target", sa.String(length=255), nullable=True),
        sa.Column("ip_address", sa.String(length=64), nullable=True),
        sa.Column("details", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_audit_logs_id", "audit_logs", ["id"])
    op.create_index("ix_audit_logs_user_id", "audit_logs", ["user_id"])
    op.create_index("ix_audit_logs_action", "audit_logs", ["action"])
    op.create_index("ix_audit_logs_created_at", "audit_logs", ["created_at"])

    # --- password_reset_tokens --------------------------------------------
    op.create_table(
        "password_reset_tokens",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_password_reset_tokens_id", "password_reset_tokens", ["id"])
    op.create_index("ix_password_reset_tokens_user_id", "password_reset_tokens", ["user_id"])
    op.create_index("ix_password_reset_tokens_token_hash", "password_reset_tokens",
                    ["token_hash"], unique=True)

    # --- hot-path indexes on existing foreign keys (item 32) --------------
    op.create_index("ix_uploaded_files_owner_id", "uploaded_files", ["owner_id"])
    op.create_index("ix_chat_history_user_id", "chat_history", ["user_id"])
    op.create_index("ix_chat_history_file_id", "chat_history", ["file_id"])
    op.create_index("ix_datasets_cleaned_file_id", "datasets_cleaned", ["file_id"])
    op.create_index("ix_cleaning_configs_file_id", "cleaning_configs", ["file_id"])
    op.create_index("ix_charts_dashboard_id", "charts", ["dashboard_id"])
    op.create_index("ix_dashboards_user_id", "dashboards", ["user_id"])
    op.create_index("ix_dashboards_file_id", "dashboards", ["file_id"])
    op.create_index("ix_cleaning_templates_user_id", "cleaning_templates", ["user_id"])


def downgrade() -> None:
    for name, table in [
        ("ix_cleaning_templates_user_id", "cleaning_templates"),
        ("ix_dashboards_file_id", "dashboards"),
        ("ix_dashboards_user_id", "dashboards"),
        ("ix_charts_dashboard_id", "charts"),
        ("ix_cleaning_configs_file_id", "cleaning_configs"),
        ("ix_datasets_cleaned_file_id", "datasets_cleaned"),
        ("ix_chat_history_file_id", "chat_history"),
        ("ix_chat_history_user_id", "chat_history"),
        ("ix_uploaded_files_owner_id", "uploaded_files"),
    ]:
        op.drop_index(name, table_name=table)

    op.drop_table("password_reset_tokens")
    op.drop_table("audit_logs")
    op.drop_table("jobs")
    op.drop_column("users", "token_version")
    op.drop_column("users", "role")
