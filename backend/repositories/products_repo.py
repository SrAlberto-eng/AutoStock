"""products_repo.py — Operaciones de productos."""

from typing import Any

from sqlalchemy import text

from repositories.base import now_utc, compute_estado


_SELECT_PRODUCT = """
    SELECT
        id, nombre, categoria_id, area_id, unidad_id, proveedor_id,
        stock_actual, stock_min, stock_max, estado, activo, created_at
    FROM productos
"""


def list_products(
    conn,
    nombre: str | None = None,
    categoria_id: int | None = None,
    area_id: int | None = None,
    estado: str | None = None,
    include_inactive: bool = False,
) -> list[dict]:
    clauses = [] if include_inactive else ["activo = 1"]
    params: dict[str, Any] = {}

    if nombre and nombre.strip():
        clauses.append("LOWER(nombre) LIKE :nombre")
        params["nombre"] = f"%{nombre.strip().lower()}%"
    if categoria_id is not None:
        clauses.append("categoria_id = :categoria_id")
        params["categoria_id"] = categoria_id
    if area_id is not None:
        clauses.append("area_id = :area_id")
        params["area_id"] = area_id
    if estado and estado.strip():
        clauses.append("estado = :estado")
        params["estado"] = estado.strip()

    if clauses:
        where_sql = " WHERE " + " AND ".join(clauses)
    else:
        where_sql = ""
    rows = conn.execute(
        text(f"{_SELECT_PRODUCT}{where_sql} ORDER BY id DESC"),
        params,
    ).mappings().all()
    return [dict(r) for r in rows]


def get_by_id(conn, product_id: int, active_only: bool = True) -> dict | None:
    where = "WHERE id = :id AND activo = 1" if active_only else "WHERE id = :id"
    row = conn.execute(
        text(f"{_SELECT_PRODUCT} {where} LIMIT 1"),
        {"id": product_id},
    ).mappings().first()
    return dict(row) if row else None


def create_product(
    conn,
    nombre: str,
    categoria_id: int,
    area_id: int,
    unidad_id: int,
    proveedor_id: int | None,
    stock_min: float,
    stock_max: float,
    stock_actual: float = 0.0,
) -> int:
    estado = compute_estado(stock_actual, stock_min)

    result = conn.execute(
        text(
            """
            INSERT INTO productos (
                nombre, categoria_id, area_id, unidad_id, proveedor_id,
                stock_actual, stock_min, stock_max, estado, activo, created_at
            ) VALUES (
                :nombre, :categoria_id, :area_id, :unidad_id, :proveedor_id,
                :stock_actual, :stock_min, :stock_max, :estado, 1, :created_at
            )
            """
        ),
        {
            "nombre": nombre,
            "categoria_id": categoria_id,
            "area_id": area_id,
            "unidad_id": unidad_id,
            "proveedor_id": proveedor_id,
            "stock_actual": stock_actual,
            "stock_min": stock_min,
            "stock_max": stock_max,
            "estado": estado,
            "created_at": now_utc(),
        },
    )
    return result.lastrowid


def update_product(conn, product_id: int, fields: dict[str, Any]):
    if not fields:
        return
    set_parts = []
    params: dict[str, Any] = {"id": product_id}
    for field, value in fields.items():
        set_parts.append(f"{field} = :{field}")
        params[field] = value

    conn.execute(
        text(f"UPDATE productos SET {', '.join(set_parts)} WHERE id = :id"),
        params,
    )


def soft_delete(conn, product_id: int):
    conn.execute(
        text("UPDATE productos SET activo = 0 WHERE id = :id"),
        {"id": product_id},
    )


def toggle_activo(conn, product_id: int, nuevo_estado: int):
    conn.execute(
        text("UPDATE productos SET activo = :activo WHERE id = :id"),
        {"activo": nuevo_estado, "id": product_id},
    )


def get_product_history(conn, product_id: int, limit: int = 20) -> list[dict]:
    rows = conn.execute(
        text(
            """
            SELECT id, tipo, cantidad, fecha_sistema, usuario_id, motivo, revertido
            FROM movimientos
            WHERE producto_id = :product_id
            ORDER BY fecha_sistema DESC
            LIMIT :limit
            """
        ),
        {"product_id": product_id, "limit": limit},
    ).mappings().all()
    return [dict(r) for r in rows]


def update_stock_estado(conn, product_id: int):
    row = conn.execute(
        text("SELECT stock_actual, stock_min FROM productos WHERE id = :id"),
        {"id": product_id},
    ).mappings().first()
    if row:
        estado = compute_estado(float(row["stock_actual"]), float(row["stock_min"]))
        conn.execute(
            text("UPDATE productos SET estado = :estado WHERE id = :id"),
            {"estado": estado, "id": product_id},
        )
