"""facturas_repo.py — CRUD para facturas (CFDI)."""

from sqlalchemy import text


def check_exists(conn, id_factura: str) -> bool:
    row = conn.execute(
        text("SELECT 1 FROM facturas WHERE id_factura = :id_factura LIMIT 1"),
        {"id_factura": id_factura},
    ).scalar()
    return bool(row)


def create_factura(conn, id_factura, proveedor_id, fecha_emision, total, id_movimiento, xml_data) -> int:
    result = conn.execute(
        text(
            """
            INSERT INTO facturas (id_factura, proveedor_id, fecha_emision, total, id_movimiento, xml_data)
            VALUES (:id_factura, :proveedor_id, :fecha_emision, :total, :id_movimiento, :xml_data)
            """
        ),
        {
            "id_factura": id_factura,
            "proveedor_id": proveedor_id,
            "fecha_emision": fecha_emision,
            "total": total,
            "id_movimiento": id_movimiento,
            "xml_data": xml_data,
        },
    )
    return result.lastrowid


def list_facturas(conn) -> list[dict]:
    rows = conn.execute(
        text(
            """
            SELECT
                f.id, f.id_factura, f.proveedor_id, f.fecha_emision, f.total, f.id_movimiento, f.xml_data,
                p.nombre AS proveedor_nombre
            FROM facturas f
            LEFT JOIN proveedores p ON f.proveedor_id = p.id
            ORDER BY f.fecha_emision DESC
            """
        )
    ).mappings().all()
    return [dict(row) for row in rows]


def get_by_id(conn, factura_id: int) -> dict | None:
    row = conn.execute(
        text(
            """
            SELECT f.*, p.nombre AS proveedor_nombre
            FROM facturas f
            JOIN proveedores p ON f.proveedor_id = p.id
            WHERE f.id = :id
            LIMIT 1
            """
        ),
        {"id": factura_id},
    ).mappings().first()
    return dict(row) if row else None
