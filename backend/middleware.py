"""
middleware.py — CORS, logging JSON estructurado y error handler global.
"""

import json
import time
import logging
from datetime import datetime, timezone

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

# ── Logger estructurado (JSON) ────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(message)s",
)
logger = logging.getLogger("autostock")


class LoggingMiddleware(BaseHTTPMiddleware):
    """Registra cada request con método, path, status y duración en ms."""

    async def dispatch(self, request: Request, call_next):
        start = time.perf_counter()
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        duration_ms = round((time.perf_counter() - start) * 1000, 2)
        logger.info(
            json.dumps(
                {
                    "ts": datetime.now(timezone.utc).isoformat(),
                    "method": request.method,
                    "path": request.url.path,
                    "status": response.status_code,
                    "duration_ms": duration_ms,
                }
            )
        )
        return response


class ErrorHandlerMiddleware(BaseHTTPMiddleware):
    """Captura excepciones no manejadas y retorna respuesta JSON estandarizada."""

    async def dispatch(self, request: Request, call_next):
        try:
            return await call_next(request)
        except Exception as exc:
            logger.error(
                json.dumps(
                    {
                        "ts": datetime.now(timezone.utc).isoformat(),
                        "level": "ERROR",
                        "error": str(exc),
                        "path": request.url.path,
                        "method": request.method,
                    }
                )
            )
            return JSONResponse(
                status_code=500,
                content={
                    "success": False,
                    "data": None,
                    "error": "Internal server error",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                },
            )
