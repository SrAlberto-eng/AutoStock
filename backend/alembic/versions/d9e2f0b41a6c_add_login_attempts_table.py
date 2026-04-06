"""add_login_attempts_table

Revision ID: d9e2f0b41a6c
Revises: bf123c8c713a
Create Date: 2026-03-12 18:10:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "d9e2f0b41a6c"
down_revision = "bf123c8c713a"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "login_attempts",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("email", sa.String(length=100), nullable=False),
        sa.Column("timestamp", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "idx_login_attempts_email_timestamp",
        "login_attempts",
        ["email", "timestamp"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("idx_login_attempts_email_timestamp", table_name="login_attempts")
    op.drop_table("login_attempts")
