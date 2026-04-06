"""movements_repo.py — Operaciones de movimientos e importacion."""

from typing import Any

from sqlalchemy import text

from repositories.base import compute_estado


def create_movement(
    conn,
    tipo: str,
    producto_id: int,
    cantidad: float,
    fecha_sistema,
    usuario_id: int | None,
    motivo: str | None,
    area_id: int | None = None,
) -> int:
    result = conn.execute(
        text(
            """
            INSERT INTO movimientos
                (tipo, producto_id, area_id, cantidad, fecha_sistema, usuario_id, motivo, revertido)
            VALUES
                (:tipo, :producto_id, :area_id, :cantidad, :fecha_sistema, :usuario_id, :motivo, 0)
            """
        ),
        {
            "tipo": tipo,
            "producto_id": producto_id,
            "area_id": area_id,
            "cantidad": cantidad,
            "fecha_sistema": fecha_sistema,
            "usuario_id": usuario_id,
            "motivo": motivo,
        },
    )
    return int(result.lastrowid)


def apply_stock_change(conn, producto_id: int, tipo: str, cantidad: float):
    if tipo == "entrada":
        conn.execute(
            text("UPDATE productos SET stock_actual = stock_actual + :qty WHERE id = :id"),
            {"qty": cantidad, "id": producto_id},
        )
    else:
        conn.execute(
            text("UPDATE productos SET stock_actual = stock_actual - :qty WHERE id = :id"),
            {"qty": cantidad, "id": producto_id},
        )

    row = conn.execute(
        text("SELECT stock_actual, stock_min FROM productos WHERE id = :id"),
        {"id": producto_id},
    ).mappings().first()
    estado = compute_estado(float(row["stock_actual"]), float(row["stock_min"]))
    conn.execute(
        text("UPDATE productos SET estado = :estado WHERE id = :id"),
        {"estado": estado, "id": producto_id},
    )


def get_movement(conn, movement_id: int) -> dict | None:
    row = conn.execute(
        text(
            """
            SELECT id, tipo, producto_id, area_id, cantidad, fecha_sistema, revertido
            FROM movimientos WHERE id = :id
            """
        ),
        {"id": movement_id},
    ).mappings().first()
    return dict(row) if row else None


def mark_as_reverted(conn, movement_id: int):
    conn.execute(
        text("UPDATE movimientos SET revertido = 1 WHERE id = :id"),
        {"id": movement_id},
    )


def list_movements(
    conn,
    tipo: str | None = None,
    producto_id: int | None = None,
    fecha_desde: str | None = None,
    fecha_hasta: str | None = None,
    skip: int = 0,
    limit: int = 20,
) -> tuple[list[dict], int]:
    conditions: list[str] = []
    params: dict[str, Any] = {}

    if tipo:
        conditions.append("m.tipo = :tipo")
        params["tipo"] = tipo
    if producto_id is not None:
        conditions.append("m.producto_id = :producto_id")
        params["producto_id"] = producto_id
    if fecha_desde:
        conditions.append("m.fecha_sistema >= :fecha_desde")
        params["fecha_desde"] = fecha_desde
    if fecha_hasta:
        conditions.append("m.fecha_sistema <= :fecha_hasta")
        params["fecha_hasta"] = fecha_hasta

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    total = conn.execute(
        text(f"SELECT COUNT(*) FROM movimientos m {where}"), params
    ).scalar_one()

    rows = conn.execute(
        text(
            f"""
            SELECT m.id, m.tipo, m.producto_id, p.nombre AS producto_nombre,
                m.cantidad, m.fecha_sistema, m.usuario_id, m.motivo, m.revertido
            FROM movimientos m
            JOIN productos p ON m.producto_id = p.id
            {where}
            ORDER BY m.fecha_sistema DESC
            LIMIT :limit OFFSET :skip
            """
        ),
        {**params, "limit": limit, "skip": skip},
    ).mappings().all()

    return [dict(r) for r in rows], total


def get_dashboard_summary(conn, today_iso: str) -> dict:
    entradas = conn.execute(
        text(
            "SELECT COUNT(*) FROM movimientos "
            "WHERE tipo='entrada' AND revertido=0 AND date(fecha_sistema)=:today"
        ),
        {"today": today_iso},
    ).scalar_one()

    salidas = conn.execute(
        text(
            "SELECT COUNT(*) FROM movimientos "
            "WHERE tipo='salida' AND revertido=0 AND date(fecha_sistema)=:today"
        ),
        {"today": today_iso},
    ).scalar_one()

    mermas = conn.execute(
        text(
            "SELECT COUNT(*) FROM movimientos "
            "WHERE tipo='merma' AND revertido=0 AND date(fecha_sistema)=:today"
        ),
        {"today": today_iso},
    ).scalar_one()

    bajo_min = conn.execute(
        text(
            "SELECT COUNT(*) FROM productos "
            "WHERE activo=1 AND stock_actual > 0 AND stock_actual < stock_min"
        ),
    ).scalar_one()

    agotados = conn.execute(
        text("SELECT COUNT(*) FROM productos WHERE activo=1 AND stock_actual=0"),
    ).scalar_one()

    lista_bajo = conn.execute(
        text(
            "SELECT id, nombre, stock_actual, stock_min "
            "FROM productos "
            "WHERE activo=1 AND stock_actual < stock_min AND stock_actual > 0 "
            "LIMIT 10"
        ),
    ).mappings().all()

    lista_agotados = conn.execute(
        text(
            "SELECT id, nombre, stock_actual "
            "FROM productos "
            "WHERE activo=1 AND stock_actual = 0 "
            "LIMIT 10"
        ),
    ).mappings().all()

    return {
        "entradas_hoy": int(entradas),
        "salidas_hoy": int(salidas),
        "mermas_hoy": int(mermas),
        "productos_bajo_minimo": int(bajo_min),
        "productos_agotados": int(agotados),
        "lista_bajo_minimo": [
            {
                "id": int(r["id"]),
                "nombre": r["nombre"],
                "stock_actual": r["stock_actual"],
                "stock_min": r["stock_min"],
            }
            for r in lista_bajo
        ],
        "lista_agotados": [
            {
                "id": int(r["id"]),
                "nombre": r["nombre"],
                "stock_actual": r["stock_actual"],
            }
            for r in lista_agotados
        ],
    }


def get_product_for_movement(conn, product_id: int) -> dict | None:
    row = conn.execute(
        text("SELECT id, nombre, stock_actual, area_id FROM productos WHERE id = :id AND activo = 1"),
        {"id": product_id},
    ).mappings().first()
    return dict(row) if row else None


def get_user_area(conn, usuario_id: int) -> int | None:
    return conn.execute(
        text("SELECT area_id FROM usuarios WHERE id = :id"),
        {"id": usuario_id},
    ).scalar_one_or_none()


def get_active_products_for_matching(conn) -> list[dict]:
    rows = conn.execute(
        text("SELECT id, nombre FROM productos WHERE activo=1")
    ).mappings().all()
    return [dict(r) for r in rows]
