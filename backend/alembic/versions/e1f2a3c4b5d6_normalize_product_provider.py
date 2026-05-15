"""normalize product provider relationship

Revision ID: e1f2a3c4b5d6
Revises: d4e5f6a7b8c9
Create Date: 2026-05-12 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'e1f2a3c4b5d6'
down_revision = 'd4e5f6a7b8c9'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Create association table
    op.create_table(
        'productos_proveedores',
        sa.Column('producto_id', sa.Integer(), sa.ForeignKey('productos.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('proveedor_id', sa.Integer(), sa.ForeignKey('proveedores.id', ondelete='CASCADE'), primary_key=True)
    )

    # 2. Data migration: move proveedor_id from productos to productos_proveedores
    conn = op.get_bind()
    conn.execute(sa.text(
        "INSERT INTO productos_proveedores (producto_id, proveedor_id) "
        "SELECT id, proveedor_id FROM productos WHERE proveedor_id IS NOT NULL"
    ))

    # 3. Drop proveedor_id column from productos
    with op.batch_alter_table('productos', schema=None) as batch_op:
        batch_op.drop_column('proveedor_id')


def downgrade() -> None:
    # Add proveedor_id back to productos
    with op.batch_alter_table('productos', schema=None) as batch_op:
        batch_op.add_column(sa.Column('proveedor_id', sa.Integer(), sa.ForeignKey('proveedores.id', ondelete='SET NULL'), nullable=True))

    # Restore data (this might be ambiguous if M:N was used, so we just take one)
    conn = op.get_bind()
    conn.execute(sa.text(
        "UPDATE productos SET proveedor_id = ("
        "SELECT proveedor_id FROM productos_proveedores "
        "WHERE productos_proveedores.producto_id = productos.id LIMIT 1)"
    ))

    op.drop_table('productos_proveedores')
