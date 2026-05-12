"""add unique constraint on facturas.id_factura

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-05-11

"""
from alembic import op

revision = 'd4e5f6a7b8c9'
down_revision = 'c3d4e5f6a7b8'
branch_labels = None
depends_on = None


def upgrade():
    op.create_index('uq_facturas_id_factura', 'facturas', ['id_factura'], unique=True)


def downgrade():
    op.drop_index('uq_facturas_id_factura', table_name='facturas')
