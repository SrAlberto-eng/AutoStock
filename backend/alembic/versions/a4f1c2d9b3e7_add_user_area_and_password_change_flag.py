"""add_user_area_and_password_change_flag

Revision ID: a4f1c2d9b3e7
Revises: d9e2f0b41a6c
Create Date: 2026-03-15 19:20:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "a4f1c2d9b3e7"
down_revision = "d9e2f0b41a6c"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("usuarios") as batch_op:
        batch_op.add_column(sa.Column("area_id", sa.Integer(), nullable=True))
        batch_op.add_column(
            sa.Column(
                "debe_cambiar_password",
                sa.Boolean(),
                nullable=False,
                server_default=sa.false(),
            )
        )
        batch_op.create_foreign_key(
            "fk_usuarios_area_id_areas",
            "areas",
            ["area_id"],
            ["id"],
            ondelete="SET NULL",
        )

    op.execute("UPDATE usuarios SET debe_cambiar_password = 0 WHERE debe_cambiar_password IS NULL")


def downgrade() -> None:
    with op.batch_alter_table("usuarios") as batch_op:
        batch_op.drop_constraint("fk_usuarios_area_id_areas", type_="foreignkey")
        batch_op.drop_column("debe_cambiar_password")
        batch_op.drop_column("area_id")