"""reports.py — Endpoints de reportes de auditoria y movimientos (solo lectura)."""

import os
from typing import Optional

from fastapi import APIRouter, Query, Request
from sqlalchemy import text

from auth_helpers import require_role
from database import get_engine
from repositories import reports_repo
from repositories.base import now_utc, to_datetime
import config
from tasks.backup import backup_database
from schemas import (
    ApiResponse,
    AuditLogEntry,
    AuditLogResponse,
    MovementReportItem,
    MovementReportResponse,
)

router = APIRouter()
admin_router = APIRouter()


@router.get("/audit-log", response_model=ApiResponse[AuditLogResponse])
async def get_audit_log(
    request: Request,
    entidad: Optional[str] = Query(
        None,
        pattern="^(usuarios|productos|movimientos|categorias|areas|unidades|proveedores|sesiones)$",
    ),
    usuario_id: Optional[int] = Query(None),
    accion: Optional[str] = Query(None, pattern="^(CREATE|UPDATE|DELETE|LOGIN|LOGOUT)$"),
    fecha_desde: Optional[str] = Query(None),
    fecha_hasta: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
):
    require_role(request, ["administrador"])

    with get_engine().connect() as conn:
        items, total = reports_repo.get_audit_log(
            conn, entidad, usuario_id, accion, fecha_desde, fecha_hasta, skip, limit
        )

    audit_entries = [
        AuditLogEntry(
            id=item["id"],
            usuario_id=item["usuario_id"],
            usuario_nombre=item["usuario_nombre"],
            accion=item["accion"],
            entidad=item["entidad"],
            entidad_id=item["entidad_id"],
            fecha=to_datetime(item["fecha"]),
            detalle_json=item["detalle_json"],
        )
        for item in items
    ]

    return ApiResponse[AuditLogResponse](
        success=True,
        data=AuditLogResponse(
            items=audit_entries,
            total=total,
            filters_applied={
                "entidad": entidad,
                "usuario_id": usuario_id,
                "accion": accion,
                "fecha_desde": fecha_desde,
                "fecha_hasta": fecha_hasta,
            },
        ),
        error=None,
        timestamp=now_utc(),
    )


@router.get("/movimientos", response_model=ApiResponse[MovementReportResponse])
async def get_movements_report(
    request: Request,
    tipos: Optional[str] = Query(None),
    tipo: Optional[str] = Query(None, pattern="^(entrada|salida|merma)$"),
    producto_id: Optional[int] = Query(None),
    fecha_desde: Optional[str] = Query(None),
    fecha_hasta: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
):
    require_role(request, ["administrador", "gerente"])

    with get_engine().connect() as conn:
        items, total = reports_repo.get_movements_report(
            conn, tipos, tipo, producto_id, fecha_desde, fecha_hasta, skip, limit
        )

    pagina = (skip // limit) + 1

    report_items = [
        MovementReportItem(
            id=item["id"],
            tipo=item["tipo"],
            producto_nombre=item["producto_nombre"],
            cantidad=item["cantidad"],
            fecha_sistema=to_datetime(item["fecha_sistema"]),
            usuario_nombre=item["usuario_nombre"],
            motivo=item["motivo"],
            revertido=bool(item["revertido"]),
        )
        for item in items
    ]

    return ApiResponse[MovementReportResponse](
        success=True,
        data=MovementReportResponse(items=report_items, total=total, pagina=pagina),
        error=None,
        timestamp=now_utc(),
    )


@admin_router.post("/backup")
async def create_manual_backup(request: Request):
    require_role(request, ["administrador"])
    backup_path = backup_database(config.DATABASE_URL.replace("sqlite:///", ""))
    return {
        "backup": os.path.basename(backup_path),
        "timestamp": now_utc().isoformat(),
    }
