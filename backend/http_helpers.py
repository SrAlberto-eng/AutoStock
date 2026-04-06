"""http_helpers.py — Helpers HTTP compartidos por todos los routers."""

from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse

from auth_helpers import get_current_user
from repositories.base import now_utc


def error_response(status_code: int, message: str) -> JSONResponse:
    """Respuesta de error estandarizada."""
    return JSONResponse(
        status_code=status_code,
        content={
            "success": False,
            "data": None,
            "error": message,
            "timestamp": now_utc().isoformat(),
        },
    )


def current_user_id(request: Request) -> int | None:
    """Extrae user_id del token JWT. Retorna None si no hay auth."""
    try:
        user = get_current_user(request)
        return int(user["user_id"])
    except HTTPException:
        return None
