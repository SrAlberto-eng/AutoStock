"""auth_repo.py — Operaciones de autenticacion y sesiones."""

import hashlib
from datetime import datetime, timedelta

from sqlalchemy import text

from repositories.base import now_utc


def find_active_user_by_email(conn, email: str) -> dict | None:
    row = conn.execute(
        text(
            """
            SELECT u.id, u.nombre, u.email, u.password_hash,
                   u.bloqueado_hasta, u.debe_cambiar_password,
                   r.nombre AS role
            FROM usuarios u
            JOIN roles r ON r.id = u.role_id
            WHERE lower(u.email) = lower(:email) AND u.activo = 1
            LIMIT 1
            """
        ),
        {"email": email},
    ).mappings().first()
    return dict(row) if row else None


def find_active_user_by_identifier(conn, identifier: str) -> dict  | None:
    row = conn.execute(
        text(
            """
            SELECT u.id, u.nombre, u.email, u.password_hash,
                u.bloqueado_hasta, u.debe_cambiar_password,
                r.nombre AS role
            FROM usuarios u
            JOIN roles r ON r.id = u.role_id
            WHERE (lower(u.email)  = lower(:identifier)
            OR lower(u.nombre) = lower(:identifier))
            AND u.activo = 1
            LIMIT 1
            """
        ),
        {"identifier": identifier},
    ).mappings().first()
    return dict(row) if row else None



def validate_session(conn, token_hash: str, ahora: datetime) -> dict | None:
    session_row = conn.execute(
        text(
            """
            SELECT id FROM sesiones
            WHERE token_hash = :hash AND expira_en > :ahora
            LIMIT 1
            """
        ),
        {"hash": token_hash, "ahora": ahora},
    ).first()
    return session_row


def get_user_by_id_with_role(conn, user_id: int) -> dict | None:
    row = conn.execute(
        text(
            """
            SELECT u.id, u.nombre, u.email, r.nombre AS role
            FROM usuarios u
            JOIN roles r ON r.id = u.role_id
            WHERE u.id = :user_id AND u.activo = 1
            LIMIT 1
            """
        ),
        {"user_id": user_id},
    ).mappings().first()
    return dict(row) if row else None


def get_user_profile(conn, user_id: int) -> dict | None:
    row = conn.execute(
        text(
            """
            SELECT u.id, u.nombre, u.email, u.activo, r.nombre AS role
            FROM usuarios u
            JOIN roles r ON r.id = u.role_id
            WHERE u.id = :user_id
            LIMIT 1
            """
        ),
        {"user_id": user_id},
    ).mappings().first()
    return dict(row) if row else None


def create_session(conn, usuario_id: int, token_hash: str, expira_en: datetime):
    conn.execute(
        text(
            """
            INSERT INTO sesiones (usuario_id, token_hash, expira_en)
            VALUES (:usuario_id, :token_hash, :expira_en)
            """
        ),
        {
            "usuario_id": usuario_id,
            "token_hash": token_hash,
            "expira_en": expira_en,
        },
    )


def revoke_session(conn, token_hash: str):
    conn.execute(
        text("UPDATE sesiones SET expira_en = :now WHERE token_hash = :token_hash"),
        {"now": now_utc(), "token_hash": token_hash},
    )


def record_login_attempt(conn, email: str, timestamp: datetime):
    conn.execute(
        text("INSERT INTO login_attempts (email, timestamp) VALUES (:email, :timestamp)"),
        {"email": email, "timestamp": timestamp},
    )


def count_recent_attempts(conn, email: str, window_start: datetime) -> int:
    return conn.execute(
        text(
            """
            SELECT COUNT(*) AS total
            FROM login_attempts
            WHERE lower(email) = lower(:email)
              AND timestamp >= :window_start
            """
        ),
        {"email": email, "window_start": window_start},
    ).scalar_one()


def lock_user(conn, user_id: int, until: datetime):
    conn.execute(
        text("UPDATE usuarios SET bloqueado_hasta = :until WHERE id = :id"),
        {"until": until, "id": user_id},
    )


def clear_login_attempts(conn, identifier: str):
    conn.execute(
        text("DELETE FROM login_attempts WHERE lower(email) = lower(:identifier)"),
        {"identifier": identifier},
    )


def get_actor(conn, user_id: int) -> dict | None:
    row = conn.execute(
        text(
            """
            SELECT u.id, u.nombre, r.nombre AS rol
            FROM usuarios u
            JOIN roles r ON r.id = u.role_id
            WHERE u.id = :user_id AND u.activo = 1
            LIMIT 1
            """
        ),
        {"user_id": user_id},
    ).mappings().first()
    return dict(row) if row else None
