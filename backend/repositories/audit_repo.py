"""audit_repo.py — Registro de auditoria."""

import json

from sqlalchemy import text

from repositories.base import now_utc


def log_audit(conn, usuario_id, accion, entidad, entidad_id, detalle=None):
    conn.execute(
        text(
            """
            INSERT INTO auditoria
            (usuario_id, accion, entidad, entidad_id, fecha, detalle_json)
            VALUES
            (:usuario_id, :accion, :entidad, :entidad_id, :fecha, :detalle_json)
            """
        ),
        {
            "usuario_id": usuario_id,
            "accion": accion,
            "entidad": entidad,
            "entidad_id": entidad_id,
            "fecha": now_utc(),
            "detalle_json": json.dumps(detalle) if detalle else None,
        },
    )
