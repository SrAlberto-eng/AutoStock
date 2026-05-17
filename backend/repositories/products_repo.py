"""products_repo.py — Operaciones de productos."""

from typing import Any

from sqlalchemy import text

from repositories.base import now_utc, compute_estado


_SELECT_PRODUCT = """
    SELECT
        p.id, p.nombre, p.categoria_id, p.area_id, p.unidad_id,
        GROUP_CONCAT(pp.proveedor_id) as proveedor_ids,
        p.stock_actual, p.stock_min, p.stock_max, p.estado, p.activo, p.created_at
    FROM productos p
    LEFT JOIN productos_proveedores pp ON p.id = pp.producto_id
"""


def list_products(
    conn,
    nombre: str | None = None,
    categoria_id: int | None = None,
    area_id: int | None = None,
    estado: str | None = None,
    include_inactive: bool = False,
) -> list[dict]:
    clauses = [] if include_inactive else ["p.activo = 1"]
    params: dict[str, Any] = {}

    if nombre and nombre.strip():
        clauses.append("LOWER(p.nombre) LIKE :nombre")
        params["nombre"] = f"%{nombre.strip().lower()}%"
    if categoria_id is not None:
        clauses.append("p.categoria_id = :categoria_id")
        params["categoria_id"] = categoria_id
    if area_id is not None:
        clauses.append("p.area_id = :area_id")
        params["area_id"] = area_id
    if estado and estado.strip():
        clauses.append("p.estado = :estado")
        params["estado"] = estado.strip()

    if clauses:
        where_sql = " WHERE " + " AND ".join(clauses)
    else:
        where_sql = ""
    rows = conn.execute(
        text(f"{_SELECT_PRODUCT}{where_sql} GROUP BY p.id ORDER BY p.id DESC"),
        params,
    ).mappings().all()
    return [dict(r) for r in rows]


def get_by_id(conn, product_id: int, active_only: bool = True) -> dict | None:
    where = "WHERE p.id = :id AND p.activo = 1" if active_only else "WHERE p.id = :id"
    row = conn.execute(
        text(f"{_SELECT_PRODUCT} {where} GROUP BY p.id LIMIT 1"),
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
    # 1. Verificar si el producto ya existe por nombre (activo o inactivo)
    existing = find_product_by_name(conn, nombre)

    if existing:
        existing_id = existing["id"]

        # Re-habilitar si estaba inactivo (evita duplicados en cualquier flujo)
        if not existing["activo"]:
            conn.execute(
                text("UPDATE productos SET activo = 1 WHERE id = :id"),
                {"id": existing_id}
            )

        # 2a. Sumar stock y actualizar estado
        row = conn.execute(
            text("SELECT stock_actual, stock_min FROM productos WHERE id = :id"),
            {"id": existing_id}
        ).mappings().first()

        nuevo_stock = float(row["stock_actual"]) + stock_actual
        nuevo_estado = compute_estado(nuevo_stock, float(row["stock_min"]))

        conn.execute(
            text("""
                UPDATE productos
                SET stock_actual = :stock, estado = :estado
                WHERE id = :id
            """),
            {"stock": nuevo_stock, "estado": nuevo_estado, "id": existing_id}
        )

        # Asociar nuevo proveedor si no está asociado
        if proveedor_id:
            conn.execute(
                text("""
                    INSERT OR IGNORE INTO productos_proveedores (producto_id, proveedor_id)
                    VALUES (:p_id, :pr_id)
                """),
                {"p_id": existing_id, "pr_id": proveedor_id}
            )

        return existing_id

    # 2b. Si no existe, crear producto y asociación
    estado = compute_estado(stock_actual, stock_min)

    result = conn.execute(
        text(
            """
            INSERT INTO productos (
                nombre, categoria_id, area_id, unidad_id,
                stock_actual, stock_min, stock_max, estado, activo, created_at
            ) VALUES (
                :nombre, :categoria_id, :area_id, :unidad_id,
                :stock_actual, :stock_min, :stock_max, :estado, 1, :created_at
            )
            """
        ),
        {
            "nombre": nombre,
            "categoria_id": categoria_id,
            "area_id": area_id,
            "unidad_id": unidad_id,
            "stock_actual": stock_actual,
            "stock_min": stock_min,
            "stock_max": stock_max,
            "estado": estado,
            "created_at": now_utc(),
        },
    )
    new_id = result.lastrowid
    
    if proveedor_id:
        conn.execute(
            text("INSERT INTO productos_proveedores (producto_id, proveedor_id) VALUES (:p_id, :pr_id)"),
            {"p_id": new_id, "pr_id": proveedor_id}
        )
        
    return new_id


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


def get_product_history(conn, producto_id: int, limit: int = 20) -> list[dict]:
    rows = conn.execute(
        text(
            """
            SELECT m.id, m.tipo, m.cantidad, m.fecha_sistema,
                   m.usuario_id, u.nombre AS usuario_nombre,
                   m.motivo, m.revertido
            FROM movimientos m
            LEFT JOIN usuarios u ON m.usuario_id = u.id
            WHERE m.producto_id = :producto_id
            ORDER BY m.fecha_sistema DESC
            LIMIT :limit
            """
        ),
        {"producto_id": producto_id, "limit": limit},
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
        
def associate_provider(conn, product_id: int, proveedor_id: int):
    conn.execute(
        text("""
            INSERT OR IGNORE INTO productos_proveedores (producto_id, proveedor_id)
            VALUES (:p_id, :pr_id)
        """),
        {"p_id": product_id, "pr_id": proveedor_id}
    )


def find_product_by_name(conn, product_name: str) -> dict | None:
    result = conn.execute(
        text(
            "SELECT id, activo FROM productos "
            "WHERE LOWER(TRIM(nombre)) = LOWER(TRIM(:product_name)) LIMIT 1"
        ),
        {"product_name": product_name}
    ).mappings().first()
    return dict(result) if result else None