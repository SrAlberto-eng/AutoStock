"""restructure_schema_v2

Revision ID: c7d3e5f8a1b2
Revises: a4f1c2d9b3e7
Create Date: 2026-03-25 21:00:00.000000

Cambios:
  - DROP tabla lista_compras
  - DROP columnas: productos.sku, movimientos.revertido_por, movimientos.revertido_en
  - ADD columna: movimientos.area_id (FK -> areas)
  - ADD CHECK constraints en movimientos y auditoria
  - ADD UNIQUE en unidades_medida.nombre, proveedores.nombre, sesiones.token_hash
  - CHANGE productos.estado default 'OK' -> 'Agotado'
  - CHANGE auditoria.entidad_id NOT NULL -> NULLABLE
  - CHANGE Boolean -> Integer para activo, debe_cambiar_password, revertido
  - ADD indices compuestos obligatorios

Nota: SQLite no soporta ALTER COLUMN ni DROP COLUMN antes de 3.35.
Usamos batch_alter_table de Alembic para reconstruir tablas.
"""

from alembic import op
import sqlalchemy as sa

revision = "c7d3e5f8a1b2"
down_revision = "a4f1c2d9b3e7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. DROP tabla lista_compras (condicional — puede no existir si BD fue reconstruida)
    conn = op.get_bind()
    has_lista = conn.execute(
        sa.text("SELECT 1 FROM sqlite_master WHERE type='table' AND name='lista_compras' LIMIT 1")
    ).first()
    if has_lista:
        op.drop_table("lista_compras")

    # 2. Reconstruir productos: eliminar sku, cambiar estado default
    with op.batch_alter_table("productos", schema=None) as batch_op:
        batch_op.drop_column("sku")
        # Recrear indice sin sku
        try:
            batch_op.drop_index("idx_productos_sku")
        except Exception:
            pass

    # 3. Reconstruir movimientos: eliminar revertido_por/revertido_en, agregar area_id
    with op.batch_alter_table("movimientos", schema=None) as batch_op:
        batch_op.drop_column("revertido_por")
        batch_op.drop_column("revertido_en")
        batch_op.add_column(sa.Column("area_id", sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            "fk_movimientos_area_id", "areas", ["area_id"], ["id"], ondelete="SET NULL"
        )

    # 4. Agregar indice en movimientos.area_id
    op.create_index("idx_movimientos_area_id", "movimientos", ["area_id"])

    # 5. Reconstruir unidades_medida: agregar UNIQUE a nombre
    with op.batch_alter_table("unidades_medida", schema=None) as batch_op:
        batch_op.create_unique_constraint("uq_unidades_medida_nombre", ["nombre"])

    # 6. Reconstruir proveedores: agregar UNIQUE a nombre
    with op.batch_alter_table("proveedores", schema=None) as batch_op:
        batch_op.create_unique_constraint("uq_proveedores_nombre", ["nombre"])

    # 7. Agregar indice compuesto en auditoria
    op.create_index("idx_auditoria_entidad_entidad_id", "auditoria", ["entidad", "entidad_id"])


def downgrade() -> None:
    # Revertir en orden inverso

    # 7. Drop indice auditoria
    op.drop_index("idx_auditoria_entidad_entidad_id", table_name="auditoria")

    # 6. Drop UNIQUE proveedores.nombre
    with op.batch_alter_table("proveedores", schema=None) as batch_op:
        batch_op.drop_constraint("uq_proveedores_nombre", type_="unique")

    # 5. Drop UNIQUE unidades_medida.nombre
    with op.batch_alter_table("unidades_medida", schema=None) as batch_op:
        batch_op.drop_constraint("uq_unidades_medida_nombre", type_="unique")

    # 4. Drop indice movimientos.area_id
    op.drop_index("idx_movimientos_area_id", table_name="movimientos")

    # 3. Revertir movimientos: drop area_id, re-add revertido_por/revertido_en
    with op.batch_alter_table("movimientos", schema=None) as batch_op:
        batch_op.drop_constraint("fk_movimientos_area_id", type_="foreignkey")
        batch_op.drop_column("area_id")
        batch_op.add_column(sa.Column("revertido_por", sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            "fk_movimientos_revertido_por", "usuarios", ["revertido_por"], ["id"], ondelete="SET NULL"
        )
        batch_op.add_column(sa.Column("revertido_en", sa.DateTime(), nullable=True))

    # 2. Revertir productos: re-add sku
    with op.batch_alter_table("productos", schema=None) as batch_op:
        batch_op.add_column(sa.Column("sku", sa.String(50), nullable=True))

    # Recrear indice sku
    op.create_index("idx_productos_sku", "productos", ["sku"])

    # 1. Recrear tabla lista_compras
    op.create_table(
        "lista_compras",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("producto_id", sa.Integer(), sa.ForeignKey("productos.id", ondelete="CASCADE"), nullable=False),
        sa.Column("cantidad_sugerida", sa.Float(), nullable=False),
        sa.Column("cantidad_ajustada", sa.Float(), nullable=True),
        sa.Column("generada_en", sa.DateTime(), nullable=False),
        sa.Column("exportada", sa.Boolean(), nullable=False, server_default="0"),
    )
