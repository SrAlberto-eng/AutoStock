"""users_repo.py — Operaciones de usuarios."""

from typing import Any

from sqlalchemy import text


ROLES_VALIDOS = {
    "administrador",
    "gerente",
    "encargado_area",
    "encargado_compras",
}

_SELECT_USER = """
    SELECT
        u.id, u.nombre, u.email, u.role_id,
        r.nombre AS rol,
        u.area_id,
        a.nombre AS area_nombre,
        u.bloqueado_hasta, u.debe_cambiar_password,
        u.activo, u.created_at
    FROM usuarios u
    JOIN roles r ON r.id = u.role_id
    LEFT JOIN areas a ON a.id = u.area_id
"""


def fetch_user_row(conn, user_id: int) -> dict | None:
    row = conn.execute(
        text(f"{_SELECT_USER} WHERE u.id = :id LIMIT 1"),
        {"id": user_id},
    ).mappings().first()
    return dict(row) if row else None


def list_active_users(conn, include_inactive: bool = False) -> list[dict]:
    where = "" if include_inactive else "WHERE u.activo = 1"
    rows = conn.execute(
        text(f"{_SELECT_USER} {where} ORDER BY u.id DESC")
    ).mappings().all()
    return [dict(r) for r in rows]


def email_exists(conn, email: str, exclude_id: int | None = None) -> bool:
    if exclude_id:
        row = conn.execute(
            text("SELECT id FROM usuarios WHERE lower(email) = lower(:email) AND id <> :id LIMIT 1"),
            {"email": email, "id": exclude_id},
        ).first()
    else:
        row = conn.execute(
            text("SELECT id FROM usuarios WHERE lower(email) = lower(:email) LIMIT 1"),
            {"email": email},
        ).first()
    return row is not None


def resolve_role_id(conn, role_name: str | None, role_id: int | None) -> int | None:
    resolved_name: str | None = None

    if role_name is not None:
        resolved_name = role_name.strip().lower()
    elif role_id is not None:
        row = conn.execute(
            text("SELECT nombre FROM roles WHERE id = :id LIMIT 1"),
            {"id": role_id},
        ).first()
        if row:
            resolved_name = str(row[0]).strip().lower()

    if not resolved_name or resolved_name not in ROLES_VALIDOS:
        return None

    row = conn.execute(
        text("SELECT id FROM roles WHERE lower(nombre) = :nombre LIMIT 1"),
        {"nombre": resolved_name},
    ).first()
    return int(row[0]) if row else None


def get_role_name(conn, role_id: int) -> str | None:
    return conn.execute(
        text("SELECT nombre FROM roles WHERE id = :id LIMIT 1"),
        {"id": role_id},
    ).scalar_one_or_none()


def create_user(
    conn,
    nombre: str,
    email: str,
    password_hash: str,
    role_id: int,
    area_id: int | None,
    debe_cambiar_password: bool,
    created_at,
) -> int:
    result = conn.execute(
        text(
            """
            INSERT INTO usuarios (
                nombre, email, password_hash, role_id, area_id,
                bloqueado_hasta, debe_cambiar_password, activo, created_at
            ) VALUES (
                :nombre, :email, :password_hash, :role_id, :area_id,
                NULL, :debe_cambiar_password, 1, :created_at
            )
            """
        ),
        {
            "nombre": nombre,
            "email": email,
            "password_hash": password_hash,
            "role_id": role_id,
            "area_id": area_id,
            "debe_cambiar_password": debe_cambiar_password,
            "created_at": created_at,
        },
    )
    return int(result.lastrowid)


def update_user(conn, user_id: int, fields: dict[str, Any]):
    if not fields:
        return
    set_sql = ", ".join(f"{key} = :{key}" for key in fields)
    conn.execute(
        text(f"UPDATE usuarios SET {set_sql} WHERE id = :id"),
        {**fields, "id": user_id},
    )


def update_password(conn, user_id: int, password_hash: str, debe_cambiar: bool = False) -> int:
    result = conn.execute(
        text(
            """
            UPDATE usuarios
            SET password_hash = :hash, debe_cambiar_password = :debe
            WHERE id = :id AND activo = 1
            """
        ),
        {"hash": password_hash, "debe": int(debe_cambiar), "id": user_id},
    )
    return result.rowcount


def soft_delete(conn, user_id: int):
    conn.execute(
        text("UPDATE usuarios SET activo = 0 WHERE id = :id"),
        {"id": user_id},
    )


def toggle_activo(conn, user_id: int, nuevo_estado: int):
    conn.execute(
        text("UPDATE usuarios SET activo = :activo WHERE id = :id"),
        {"activo": nuevo_estado, "id": user_id},
    )


def unblock(conn, user_id: int) -> int:
    result = conn.execute(
        text("UPDATE usuarios SET bloqueado_hasta = NULL WHERE id = :id AND activo = 1"),
        {"id": user_id},
    )
    return result.rowcount


def count_active_admins(conn) -> int:
    admin_role_id = conn.execute(
        text("SELECT id FROM roles WHERE lower(nombre) = 'administrador' LIMIT 1")
    ).scalar_one_or_none()
    if admin_role_id is None:
        return 0
    return conn.execute(
        text("SELECT COUNT(*) FROM usuarios WHERE role_id = :rid AND activo = 1"),
        {"rid": int(admin_role_id)},
    ).scalar_one()
