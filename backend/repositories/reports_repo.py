"""reports_repo.py — Consultas para reportes y audit log."""

import json
from typing import Any

from sqlalchemy import text


def get_audit_log(
    conn,
    entidad: str | None = None,
    usuario_id: int | None = None,
    accion: str | None = None,
    fecha_desde: str | None = None,
    fecha_hasta: str | None = None,
    skip: int = 0,
    limit: int = 50,
) -> tuple[list[dict], int]:
    conditions: list[str] = []
    params: dict[str, Any] = {}

    if entidad:
        conditions.append("a.entidad = :entidad")
        params["entidad"] = entidad
    if usuario_id is not None:
        conditions.append("a.usuario_id = :usuario_id")
        params["usuario_id"] = usuario_id
    if accion:
        conditions.append("a.accion = :accion")
        params["accion"] = accion
    if fecha_desde:
        conditions.append("a.fecha >= :fecha_desde")
        params["fecha_desde"] = fecha_desde
    if fecha_hasta:
        if len(fecha_hasta) == 10:
            fecha_hasta = fecha_hasta + "T23:59:59"
        conditions.append("a.fecha <= :fecha_hasta")
        params["fecha_hasta"] = fecha_hasta

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    total = conn.execute(
        text(f"SELECT COUNT(*) FROM auditoria a {where}"), params
    ).scalar_one()

    rows = conn.execute(
        text(
            f"""
            SELECT
                a.id, a.usuario_id,
                u.nombre AS usuario_nombre,
                a.accion, a.entidad, a.entidad_id,
                a.fecha, a.detalle_json
            FROM auditoria a
            LEFT JOIN usuarios u ON u.id = a.usuario_id
            {where}
            ORDER BY a.fecha DESC
            LIMIT :limit OFFSET :skip
            """
        ),
        {**params, "limit": limit, "skip": skip},
    ).mappings().all()

    items = []
    for row in rows:
        detalle = row["detalle_json"]
        if isinstance(detalle, str) and detalle.strip():
            try:
                detalle = json.loads(detalle)
            except (ValueError, TypeError):
                detalle = {"raw": detalle}
        items.append({
            "id": row["id"],
            "usuario_id": row["usuario_id"],
            "usuario_nombre": row["usuario_nombre"],
            "accion": row["accion"],
            "entidad": row["entidad"],
            "entidad_id": row["entidad_id"],
            "fecha": row["fecha"],
            "detalle_json": detalle,
        })

    return items, total


def get_movements_report(
    conn,
    tipos: str | None = None,
    tipo: str | None = None,
    producto_id: int | None = None,
    fecha_desde: str | None = None,
    fecha_hasta: str | None = None,
    skip: int = 0,
    limit: int = 50,
) -> tuple[list[dict], int]:
    conditions: list[str] = []
    params: dict[str, Any] = {}

    if tipos:
        tipos_values = [v.strip() for v in tipos.split(",") if v.strip()]
        tipos_validos = [v for v in tipos_values if v in ("entrada", "salida", "merma")]
        if tipos_validos:
            placeholders = []
            for idx, tipo_val in enumerate(tipos_validos):
                key = f"tipo_{idx}"
                placeholders.append(f":{key}")
                params[key] = tipo_val
            conditions.append(f"m.tipo IN ({', '.join(placeholders)})")
    elif tipo:
        conditions.append("m.tipo = :tipo")
        params["tipo"] = tipo
    if producto_id is not None:
        conditions.append("m.producto_id = :producto_id")
        params["producto_id"] = producto_id
    if fecha_desde:
        conditions.append("m.fecha_sistema >= :fecha_desde")
        params["fecha_desde"] = fecha_desde
    if fecha_hasta:
        if len(fecha_hasta) == 10:
            fecha_hasta = fecha_hasta + "T23:59:59"
        conditions.append("m.fecha_sistema <= :fecha_hasta")
        params["fecha_hasta"] = fecha_hasta

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    total = conn.execute(
        text(f"SELECT COUNT(*) FROM movimientos m {where}"), params
    ).scalar_one()

    rows = conn.execute(
        text(
            f"""
            SELECT
                m.id, m.tipo,
                p.nombre AS producto_nombre,
                m.cantidad, m.fecha_sistema,
                COALESCE(u.nombre, 'Sistema') AS usuario_nombre,
                m.motivo, m.revertido
            FROM movimientos m
            JOIN productos p ON p.id = m.producto_id
            LEFT JOIN usuarios u ON u.id = m.usuario_id
            {where}
            ORDER BY m.fecha_sistema DESC
            LIMIT :limit OFFSET :skip
            """
        ),
        {**params, "limit": limit, "skip": skip},
    ).mappings().all()

    return [dict(r) for r in rows], total
