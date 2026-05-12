"""add movimiento_ids to facturas

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-05-11

"""
from alembic import op
import sqlalchemy as sa

revision = 'c3d4e5f6a7b8'
down_revision = 'b2c3d4e5f6a7'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('facturas', sa.Column('movimiento_ids', sa.Text(), nullable=True))


def downgrade():
    op.drop_column('facturas', 'movimiento_ids')
