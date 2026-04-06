"""catalogs_repo.py — CRUD para catalogos (categorias, areas, unidades_medida)."""

from sqlalchemy import text


CATALOG_MAP = {
    "categorias": ("categorias", "categoria_id"),
    "areas": ("areas", "area_id"),
    "unidades": ("unidades_medida", "unidad_id"),
}


def resolve_catalog(tipo: str) -> tuple[str, str]:
    return CATALOG_MAP[tipo]


def list_items(conn, tipo: str) -> list[dict]:
    table_name, fk_column = resolve_catalog(tipo)
    extra_col = ", c.abreviacion" if tipo == "unidades" else ""
    rows = conn.execute(
        text(
            f"""
            SELECT
                c.id,
                c.nombre{extra_col},
                COUNT(p.id) AS productos_asociados
            FROM {table_name} c
            LEFT JOIN productos p
                ON p.{fk_column} = c.id
                AND p.activo = 1
            GROUP BY c.id, c.nombre
            ORDER BY c.nombre ASC
            """
        )
    ).mappings().all()
    result = []
    for row in rows:
        item = {
            "id": row["id"],
            "nombre": row["nombre"],
            "productos_asociados": int(row["productos_asociados"] or 0),
        }
        if tipo == "unidades":
            item["abreviacion"] = row["abreviacion"] or ""
        result.append(item)
    return result


def create_item(conn, tipo: str, nombre: str) -> int:
    table_name, _ = resolve_catalog(tipo)
    result = conn.execute(
        text(f"INSERT INTO {table_name} (nombre) VALUES (:nombre)"),
        {"nombre": nombre},
    )
    return result.lastrowid


def create_unidad(conn, nombre: str, abreviacion: str) -> int:
    result = conn.execute(
        text(
            "INSERT INTO unidades_medida (nombre, abreviacion) VALUES (:nombre, :abreviacion)"
        ),
        {"nombre": nombre, "abreviacion": abreviacion},
    )
    return result.lastrowid


def get_item(conn, tipo: str, item_id: int) -> dict | None:
    table_name, _ = resolve_catalog(tipo)
    row = conn.execute(
        text(f"SELECT id FROM {table_name} WHERE id = :id LIMIT 1"),
        {"id": item_id},
    ).first()
    return row


def update_item(conn, tipo: str, item_id: int, nombre: str):
    table_name, _ = resolve_catalog(tipo)
    conn.execute(
        text(f"UPDATE {table_name} SET nombre = :nombre WHERE id = :id"),
        {"nombre": nombre, "id": item_id},
    )


def update_unidad(conn, item_id: int, fields: dict):
    """Actualiza unidad de medida (nombre y/o abreviacion)."""
    if not fields:
        return
    set_parts = []
    params = {"id": item_id}
    for key, val in fields.items():
        set_parts.append(f"{key} = :{key}")
        params[key] = val
    conn.execute(
        text(f"UPDATE unidades_medida SET {', '.join(set_parts)} WHERE id = :id"),
        params,
    )


def get_unidad(conn, item_id: int) -> dict | None:
    row = conn.execute(
        text("SELECT id, nombre, abreviacion FROM unidades_medida WHERE id = :id LIMIT 1"),
        {"id": item_id},
    ).mappings().first()
    return dict(row) if row else None


def count_linked_products(conn, tipo: str, item_id: int) -> int:
    _, fk_column = resolve_catalog(tipo)
    return conn.execute(
        text(f"SELECT COUNT(*) FROM productos WHERE {fk_column} = :id"),
        {"id": item_id},
    ).scalar_one()


def delete_item(conn, tipo: str, item_id: int):
    table_name, _ = resolve_catalog(tipo)
    conn.execute(
        text(f"DELETE FROM {table_name} WHERE id = :id"),
        {"id": item_id},
    )
