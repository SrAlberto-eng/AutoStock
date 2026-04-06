"""purchases_repo.py — Lista de compras generada en tiempo real (sin tabla).

Desde FASE 1 la tabla lista_compras fue eliminada. La lista se computa
en tiempo real a partir de productos con stock_actual < stock_min.
"""

from sqlalchemy import text


def get_purchase_list(conn) -> list[dict]:
    """Retorna productos bajo stock minimo con cantidad sugerida."""
    rows = conn.execute(
        text(
            """
            SELECT
                p.id AS producto_id,
                p.nombre AS nombre_producto,
                p.stock_actual,
                p.stock_min,
                p.stock_max,
                (p.stock_max - p.stock_actual) AS cantidad_sugerida,
                c.nombre AS categoria_nombre,
                a.nombre AS area_nombre,
                um.abreviacion AS unidad_nombre,
                pr.nombre AS proveedor_nombre
            FROM productos p
            LEFT JOIN categorias c ON c.id = p.categoria_id
            LEFT JOIN areas a ON a.id = p.area_id
            LEFT JOIN unidades_medida um ON um.id = p.unidad_id
            LEFT JOIN proveedores pr ON pr.id = p.proveedor_id
            WHERE p.activo = 1
              AND p.stock_actual < p.stock_min
            ORDER BY (p.stock_min - p.stock_actual) DESC
            """
        )
    ).mappings().all()
    return [dict(r) for r in rows]
