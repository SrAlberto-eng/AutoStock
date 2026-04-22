"""proveedores_repo.py — CRUD para proveedores."""

from sqlalchemy import text


def list_proveedores(conn, include_inactive: bool = False) -> list[dict]:
    where = "" if include_inactive else "WHERE p.activo = 1"
    rows = conn.execute(
        text(
            f"""
            SELECT
                p.id, p.nombre, p.email, p.telefono, p.activo,
                COUNT(pr.id) AS productos_asociados
            FROM proveedores p
            LEFT JOIN productos pr
                ON pr.proveedor_id = p.id AND pr.activo = 1
            {where}
            GROUP BY p.id, p.nombre, p.email, p.telefono, p.activo
            ORDER BY p.nombre ASC
            """
        )
    ).mappings().all()
    return [
        {
            "id": row["id"],
            "nombre": row["nombre"],
            "activo": bool(row["activo"]),
            "email": row["email"],
            "telefono": row["telefono"],
            "productos_asociados": int(row["productos_asociados"] or 0),
        }
        for row in rows
    ]


def get_by_id(conn, proveedor_id: int) -> dict | None:
    row = conn.execute(
        text("SELECT id, nombre, email, telefono, activo FROM proveedores WHERE id = :id LIMIT 1"),
        {"id": proveedor_id},
    ).mappings().first()
    return dict(row) if row else None


def create_proveedor(conn, nombre: str, email: str, telefono: str) -> int:
    result = conn.execute(
        text("INSERT INTO proveedores (nombre, email, telefono, activo) VALUES (:nombre, :email, :telefono, 1)"),
        {"nombre": nombre, "email": email,  "telefono": telefono},
    )
    return result.lastrowid


def update_proveedor(conn, proveedor_id: int, nombre: str, email: str, telefono: str):
    conn.execute(
        text("UPDATE proveedores SET nombre = :nombre, email = :email, telefono = :telefono WHERE id = :id"),
        {"nombre": nombre, "id": proveedor_id, "email": email, "telefono": telefono},
    )


def toggle_activo(conn, proveedor_id: int, nuevo_estado: int):
    conn.execute(
        text("UPDATE proveedores SET activo = :activo WHERE id = :id"),
        {"activo": nuevo_estado, "id": proveedor_id},
    )


def count_linked_products(conn, proveedor_id: int) -> int:
    return conn.execute(
        text("SELECT COUNT(*) FROM productos WHERE proveedor_id = :id AND activo = 1"),
        {"id": proveedor_id},
    ).scalar_one()
