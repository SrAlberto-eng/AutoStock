from pathlib import Path
import sys

from sqlalchemy import text

# Ensure backend package modules are importable when running:
# python backend/scripts/reset_db.py
BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from database import get_engine  # noqa: E402
from main import seed_default_admin  # noqa: E402


def _table_exists(conn, table_name: str) -> bool:
    row = conn.execute(
        text(
            """
            SELECT 1
            FROM sqlite_master
            WHERE type = 'table' AND name = :table_name
            LIMIT 1
            """
        ),
        {"table_name": table_name},
    ).first()
    return row is not None


def reset_data() -> None:
    engine = get_engine()

    delete_order = [
        "auditoria",
        "sesiones",
        "login_attempts",
        "movimientos",
        "productos",
        "usuarios",
        "roles",
        "categorias",
        "areas",
        "unidades_medida",
        "proveedores",
    ]

    roles = [
        "administrador",
        "gerente",
        "encargado_area",
        "encargado_compras",
    ]

    print("[reset_db] Iniciando reset de datos...")

    with engine.begin() as conn:
        for table_name in delete_order:
            if not _table_exists(conn, table_name):
                print(f"[reset_db] Tabla no encontrada, se omite: {table_name}")
                continue
            conn.execute(text(f"DELETE FROM {table_name}"))
            print(f"[reset_db] Datos eliminados de: {table_name}")

        for role_name in roles:
            conn.execute(
                text("INSERT INTO roles (nombre) VALUES (:nombre)"),
                {"nombre": role_name},
            )
            print(f"[reset_db] Rol insertado: {role_name}")

        seed_default_admin(conn)
        print("[reset_db] Usuario admin reinsertado: admin@autostock.local")

    print("[reset_db] Reset completado.")


if __name__ == "__main__":
    reset_data()
