"""add_check_constraints

Revision ID: d8e4f6a2b3c5
Revises: c7d3e5f8a1b2
Create Date: 2026-03-25 21:30:00.000000

Reconstruye movimientos y auditoria para agregar CHECK constraints
que no se aplicaron con batch_alter_table en la migracion anterior.
Tambien corrige auditoria.entidad_id a NULLABLE.

Nota: En SQLite, la unica forma de agregar CHECK constraints a tablas
existentes es reconstruir la tabla completa. Usamos batch_alter_table
con recreate='always' para forzar la reconstruccion.
"""

from alembic import op
import sqlalchemy as sa

revision = "d8e4f6a2b3c5"
down_revision = "c7d3e5f8a1b2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Reconstruir movimientos con CHECK constraints
    with op.batch_alter_table("movimientos", schema=None, recreate="always") as batch_op:
        batch_op.alter_column("tipo", existing_type=sa.Text(), nullable=False)
        batch_op.alter_column("cantidad", existing_type=sa.Float(), nullable=False)
        batch_op.alter_column("revertido", existing_type=sa.Integer(), nullable=False, server_default="0")

    # Agregar CHECK constraints manualmente via SQL (batch_alter_table no soporta CHECKs nativamente en recreate)
    # En su lugar, reconstruimos con SQL directo
    conn = op.get_bind()

    # --- Reconstruir movimientos con CHECKs ---
    conn.execute(sa.text("ALTER TABLE movimientos RENAME TO _movimientos_old"))
    conn.execute(sa.text("""
        CREATE TABLE movimientos (
            id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
            tipo TEXT NOT NULL,
            producto_id INTEGER NOT NULL,
            area_id INTEGER,
            cantidad FLOAT NOT NULL,
            fecha_sistema DATETIME NOT NULL,
            usuario_id INTEGER,
            motivo TEXT,
            revertido INTEGER NOT NULL DEFAULT 0,
            CHECK (tipo IN ('entrada','salida','merma')),
            CHECK (cantidad > 0),
            FOREIGN KEY(producto_id) REFERENCES productos (id) ON DELETE RESTRICT,
            FOREIGN KEY(area_id) REFERENCES areas (id) ON DELETE SET NULL,
            FOREIGN KEY(usuario_id) REFERENCES usuarios (id) ON DELETE SET NULL
        )
    """))
    conn.execute(sa.text("""
        INSERT INTO movimientos (id, tipo, producto_id, area_id, cantidad, fecha_sistema, usuario_id, motivo, revertido)
        SELECT id, tipo, producto_id, area_id, cantidad, fecha_sistema, usuario_id, motivo, revertido
        FROM _movimientos_old
    """))
    conn.execute(sa.text("DROP TABLE _movimientos_old"))

    # Recrear indices de movimientos
    conn.execute(sa.text("CREATE INDEX idx_movimientos_producto_fecha ON movimientos (producto_id, fecha_sistema)"))
    conn.execute(sa.text("CREATE INDEX idx_movimientos_area_id ON movimientos (area_id)"))

    # --- Reconstruir auditoria con CHECKs y entidad_id NULLABLE ---
    conn.execute(sa.text("ALTER TABLE auditoria RENAME TO _auditoria_old"))
    conn.execute(sa.text("""
        CREATE TABLE auditoria (
            id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
            usuario_id INTEGER,
            accion TEXT NOT NULL,
            entidad TEXT NOT NULL,
            entidad_id INTEGER,
            fecha DATETIME NOT NULL,
            detalle_json TEXT,
            CHECK (accion IN ('CREATE','UPDATE','DELETE','LOGIN','LOGOUT')),
            CHECK (entidad IN ('usuarios','productos','movimientos','categorias','areas','unidades','proveedores','sesiones')),
            FOREIGN KEY(usuario_id) REFERENCES usuarios (id) ON DELETE SET NULL
        )
    """))
    conn.execute(sa.text("""
        INSERT INTO auditoria (id, usuario_id, accion, entidad, entidad_id, fecha, detalle_json)
        SELECT id, usuario_id, accion, entidad, entidad_id, fecha, detalle_json
        FROM _auditoria_old
    """))
    conn.execute(sa.text("DROP TABLE _auditoria_old"))

    # Recrear indice de auditoria
    conn.execute(sa.text("CREATE INDEX idx_auditoria_entidad_entidad_id ON auditoria (entidad, entidad_id)"))


def downgrade() -> None:
    conn = op.get_bind()

    # --- Revertir auditoria sin CHECKs, entidad_id NOT NULL ---
    conn.execute(sa.text("ALTER TABLE auditoria RENAME TO _auditoria_old"))
    conn.execute(sa.text("""
        CREATE TABLE auditoria (
            id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
            usuario_id INTEGER,
            accion VARCHAR(50) NOT NULL,
            entidad VARCHAR(50) NOT NULL,
            entidad_id INTEGER NOT NULL,
            fecha DATETIME NOT NULL,
            detalle_json TEXT,
            FOREIGN KEY(usuario_id) REFERENCES usuarios (id) ON DELETE SET NULL
        )
    """))
    conn.execute(sa.text("""
        INSERT INTO auditoria (id, usuario_id, accion, entidad, entidad_id, fecha, detalle_json)
        SELECT id, usuario_id, accion, entidad, COALESCE(entidad_id, 0), fecha, detalle_json
        FROM _auditoria_old
    """))
    conn.execute(sa.text("DROP TABLE _auditoria_old"))
    conn.execute(sa.text("CREATE INDEX idx_auditoria_entidad_entidad_id ON auditoria (entidad, entidad_id)"))

    # --- Revertir movimientos sin CHECKs ---
    conn.execute(sa.text("ALTER TABLE movimientos RENAME TO _movimientos_old"))
    conn.execute(sa.text("""
        CREATE TABLE movimientos (
            id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
            tipo VARCHAR(50) NOT NULL,
            producto_id INTEGER NOT NULL,
            cantidad FLOAT NOT NULL,
            fecha_sistema DATETIME NOT NULL,
            usuario_id INTEGER,
            motivo VARCHAR(255),
            revertido BOOLEAN NOT NULL,
            area_id INTEGER,
            CONSTRAINT fk_movimientos_area_id FOREIGN KEY(area_id) REFERENCES areas (id) ON DELETE SET NULL,
            FOREIGN KEY(producto_id) REFERENCES productos (id) ON DELETE RESTRICT,
            FOREIGN KEY(usuario_id) REFERENCES usuarios (id) ON DELETE SET NULL
        )
    """))
    conn.execute(sa.text("""
        INSERT INTO movimientos (id, tipo, producto_id, cantidad, fecha_sistema, usuario_id, motivo, revertido, area_id)
        SELECT id, tipo, producto_id, cantidad, fecha_sistema, usuario_id, motivo, revertido, area_id
        FROM _movimientos_old
    """))
    conn.execute(sa.text("DROP TABLE _movimientos_old"))
    conn.execute(sa.text("CREATE INDEX idx_movimientos_producto_fecha ON movimientos (producto_id, fecha_sistema)"))
    conn.execute(sa.text("CREATE INDEX idx_movimientos_area_id ON movimientos (area_id)"))
