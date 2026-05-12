"""facturas_repo.py — CRUD para facturas (CFDI)."""

import json
import xml.etree.ElementTree as ET
from sqlalchemy import text

_NS_CFDI4 = "http://www.sat.gob.mx/cfd/4"
_NS_CFDI3 = "http://www.sat.gob.mx/cfd/3"


def _parse_productos_from_xml(xml_data: str) -> list[dict]:
    try:
        root = ET.fromstring(xml_data)
    except ET.ParseError:
        return []
    conceptos = (
        root.findall(f".//{{{_NS_CFDI4}}}Concepto")
        or root.findall(f".//{{{_NS_CFDI3}}}Concepto")
        or root.findall(".//Concepto")
    )
    result = []
    for c in conceptos:
        nombre = c.get("Descripcion") or c.get("descripcion") or ""
        try:
            cantidad = float(c.get("Cantidad") or c.get("cantidad") or 0)
        except ValueError:
            cantidad = 0.0
        if nombre:
            result.append({"producto_nombre": nombre, "cantidad": cantidad})
    return result


def check_exists(conn, id_factura: str) -> bool:
    row = conn.execute(
        text("SELECT 1 FROM facturas WHERE id_factura = :id_factura LIMIT 1"),
        {"id_factura": id_factura},
    ).scalar()
    return bool(row)


def create_factura(conn, id_factura, proveedor_id, fecha_emision, total, id_movimiento, xml_data, movimiento_ids=None) -> int:
    ids_json = json.dumps(movimiento_ids) if movimiento_ids else None
    result = conn.execute(
        text(
            """
            INSERT INTO facturas (id_factura, proveedor_id, fecha_emision, total, id_movimiento, xml_data, movimiento_ids)
            VALUES (:id_factura, :proveedor_id, :fecha_emision, :total, :id_movimiento, :xml_data, :movimiento_ids)
            """
        ),
        {
            "id_factura": id_factura,
            "proveedor_id": proveedor_id,
            "fecha_emision": fecha_emision,
            "total": total,
            "id_movimiento": id_movimiento,
            "xml_data": xml_data,
            "movimiento_ids": ids_json,
        },
    )
    return result.lastrowid


def list_facturas(conn) -> list[dict]:
    rows = conn.execute(
        text(
            """
            SELECT
                f.id, f.id_factura, f.proveedor_id, f.fecha_emision, f.total, f.id_movimiento,
                p.nombre AS proveedor_nombre
            FROM facturas f
            LEFT JOIN proveedores p ON f.proveedor_id = p.id
            ORDER BY f.fecha_emision DESC
            """
        )
    ).mappings().all()
    return [dict(row) for row in rows]


def get_detail(conn, factura_id: int) -> dict | None:
    row = conn.execute(
        text(
            """
            SELECT
                f.id, f.id_factura, f.fecha_emision, f.total, f.id_movimiento, f.xml_data,
                prov.nombre     AS proveedor_nombre,
                m.tipo          AS mov_tipo,
                m.fecha_sistema AS mov_fecha,
                m.motivo        AS mov_motivo,
                u.nombre        AS usuario_nombre
            FROM facturas f
            LEFT JOIN proveedores prov ON f.proveedor_id = prov.id
            LEFT JOIN movimientos m    ON m.id = f.id_movimiento
            LEFT JOIN usuarios u       ON m.usuario_id = u.id
            WHERE f.id = :id
            LIMIT 1
            """
        ),
        {"id": factura_id},
    ).mappings().first()
    if not row:
        return None

    result = dict(row)

    xml_data = result.get("xml_data") or ""
    result["productos"] = _parse_productos_from_xml(xml_data)
    return result


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
