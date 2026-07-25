"""create team job workflow schema

Revision ID: 20260725_01
Revises:
Create Date: 2026-07-25
"""

from alembic import op
import sqlalchemy as sa


revision = "20260725_01"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table("users", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("email", sa.String(320), nullable=False), sa.Column("password_hash", sa.String(512), nullable=False), sa.Column("created_at", sa.DateTime(), nullable=False), sa.UniqueConstraint("email"))
    op.create_index("ix_users_email", "users", ["email"])
    op.create_table("workspaces", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("name", sa.String(160), nullable=False), sa.Column("owner_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False), sa.Column("created_at", sa.DateTime(), nullable=False))
    op.create_table("memberships", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("workspace_id", sa.Integer(), sa.ForeignKey("workspaces.id"), nullable=False), sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False), sa.Column("role", sa.String(16), nullable=False), sa.UniqueConstraint("workspace_id", "user_id", name="uq_workspace_member"))
    op.create_index("ix_memberships_workspace_id", "memberships", ["workspace_id"])
    op.create_index("ix_memberships_user_id", "memberships", ["user_id"])
    op.create_table("job_applications", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("workspace_id", sa.Integer(), sa.ForeignKey("workspaces.id"), nullable=False), sa.Column("company", sa.String(160), nullable=False), sa.Column("job_title", sa.String(160), nullable=False), sa.Column("status", sa.String(32), nullable=False), sa.Column("created_by_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False), sa.Column("created_at", sa.DateTime(), nullable=False))
    op.create_index("ix_job_applications_workspace_id", "job_applications", ["workspace_id"])
    op.create_index("ix_job_applications_company", "job_applications", ["company"])
    op.create_index("ix_job_applications_status", "job_applications", ["status"])
    op.create_table("tasks", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("application_id", sa.Integer(), sa.ForeignKey("job_applications.id"), nullable=False), sa.Column("title", sa.String(240), nullable=False), sa.Column("completed", sa.Boolean(), nullable=False), sa.Column("created_by_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False))
    op.create_index("ix_tasks_application_id", "tasks", ["application_id"])
    op.create_table("comments", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("application_id", sa.Integer(), sa.ForeignKey("job_applications.id"), nullable=False), sa.Column("author_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False), sa.Column("body", sa.Text(), nullable=False), sa.Column("created_at", sa.DateTime(), nullable=False))
    op.create_index("ix_comments_application_id", "comments", ["application_id"])
    op.create_table("activities", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("workspace_id", sa.Integer(), sa.ForeignKey("workspaces.id"), nullable=False), sa.Column("application_id", sa.Integer(), sa.ForeignKey("job_applications.id")), sa.Column("actor_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False), sa.Column("action", sa.String(64), nullable=False), sa.Column("detail", sa.Text(), nullable=False), sa.Column("created_at", sa.DateTime(), nullable=False))
    op.create_index("ix_activities_workspace_id", "activities", ["workspace_id"])
    op.create_index("ix_activities_application_id", "activities", ["application_id"])


def downgrade() -> None:
    op.drop_table("activities")
    op.drop_table("comments")
    op.drop_table("tasks")
    op.drop_table("job_applications")
    op.drop_table("memberships")
    op.drop_table("workspaces")
    op.drop_table("users")
