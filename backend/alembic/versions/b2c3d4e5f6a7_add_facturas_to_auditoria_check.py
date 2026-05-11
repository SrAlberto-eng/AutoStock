"""add_facturas_to_auditoria_check

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-05-08 00:00:00.000000

Agrega 'facturas' al CHECK constraint de auditoria.entidad.
SQLite no soporta ALTER TABLE para modificar CHECKs — requiere recrear la tabla.
"""

import sqlalchemy as sa
from alembic import op

revision = 'b2c3d4e5f6a7'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text("PRAGMA foreign_keys=OFF"))

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
            CHECK (entidad IN ('usuarios','productos','movimientos','categorias','areas','unidades','proveedores','sesiones','facturas')),
            FOREIGN KEY(usuario_id) REFERENCES usuarios (id) ON DELETE SET NULL
        )
    """))
    conn.execute(sa.text("""
        INSERT INTO auditoria (id, usuario_id, accion, entidad, entidad_id, fecha, detalle_json)
        SELECT id, usuario_id, accion, entidad, entidad_id, fecha, detalle_json
        FROM _auditoria_old
    """))
    conn.execute(sa.text("DROP TABLE _auditoria_old"))
    conn.execute(sa.text(
        "CREATE INDEX idx_auditoria_entidad_entidad_id ON auditoria (entidad, entidad_id)"
    ))

    conn.execute(sa.text("PRAGMA foreign_keys=ON"))


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text("PRAGMA foreign_keys=OFF"))

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
        WHERE entidad != 'facturas'
    """))
    conn.execute(sa.text("DROP TABLE _auditoria_old"))
    conn.execute(sa.text(
        "CREATE INDEX idx_auditoria_entidad_entidad_id ON auditoria (entidad, entidad_id)"
    ))

    conn.execute(sa.text("PRAGMA foreign_keys=ON"))
