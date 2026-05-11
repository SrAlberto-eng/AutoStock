"""add_facturas_table

Revision ID: a1b2c3d4e5f6
Revises: fcfc663321a3
Create Date: 2026-05-08 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = 'a1b2c3d4e5f6'
down_revision = 'fcfc663321a3'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'facturas',
        sa.Column('id', sa.Integer, primary_key=True, autoincrement=True),
        sa.Column('id_factura', sa.Text, nullable=False),
        sa.Column('proveedor_id', sa.Integer, sa.ForeignKey('proveedores.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('fecha_emision', sa.DateTime, nullable=False),
        sa.Column('total', sa.Float, nullable=False),
        sa.Column('id_movimiento', sa.Integer, sa.ForeignKey('movimientos.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('xml_data', sa.Text, nullable=False),
    )


def downgrade() -> None:
    op.drop_table('facturas')
