"""facturas.py — Endpoints para gestión de facturas (CFDI)."""

from fastapi import APIRouter, Path, Request
from sqlalchemy.exc import IntegrityError

from auth_helpers import require_role
from database import get_engine
from http_helpers import error_response, current_user_id
from repositories import audit_repo, facturas_repo
from repositories.base import now_utc
from schemas import (
    ApiResponse,
    FacturaCreate,
    FacturaDetailResponse,
    FacturaResponse,
)

router = APIRouter()


@router.get("", response_model=ApiResponse[list[FacturaResponse]])
async def list_facturas(request: Request):
    """Lista todas las facturas. Solo admin/gerente."""
    require_role(request, ["administrador", "gerente"])

    with get_engine().connect() as conn:
        items = facturas_repo.list_facturas(conn)

    return ApiResponse[list[FacturaResponse]](
        success=True,
        data=[FacturaResponse(**i) for i in items],
        error=None,
        timestamp=now_utc(),
    )


@router.get("/check/{id_factura}", response_model=ApiResponse[dict])
async def check_factura_exists(id_factura: str = Path(...)):
    """Verifica si un UUID de factura ya existe. Público."""
    with get_engine().connect() as conn:
        exists = facturas_repo.check_exists(conn, id_factura)

    return ApiResponse[dict](
        success=True,
        data={"exists": exists},
        error=None,
        timestamp=now_utc(),
    )


@router.get("/{factura_id}", response_model=ApiResponse[FacturaDetailResponse])
async def get_factura_detail(request: Request, factura_id: int = Path(..., gt=0)):
    """Detalle enriquecido de una factura. Solo admin/gerente."""
    require_role(request, ["administrador", "gerente"])

    with get_engine().connect() as conn:
        row = facturas_repo.get_detail(conn, factura_id)

    if not row:
        return error_response(404, "Factura no encontrada")

    return ApiResponse[FacturaDetailResponse](
        success=True,
        data=FacturaDetailResponse(**row),
        error=None,
        timestamp=now_utc(),
    )


@router.post("", response_model=ApiResponse[FacturaResponse])
async def create_factura(request_body: FacturaCreate, request: Request):
    """Registra una nueva factura. Solo admin/gerente."""
    require_role(request, ["administrador", "gerente"])
    usuario_id = current_user_id(request)

    try:
        with get_engine().begin() as conn:
            new_id = facturas_repo.create_factura(
                conn,
                id_factura=request_body.id_factura,
                proveedor_id=request_body.proveedor_id,
                fecha_emision=request_body.fecha_emision,
                total=request_body.total,
                id_movimiento=request_body.id_movimiento,
                xml_data=request_body.xml_data,
                movimiento_ids=request_body.movimiento_ids,
            )

            audit_repo.log_audit(
                conn,
                usuario_id=usuario_id,
                accion="CREATE",
                entidad="facturas",
                entidad_id=new_id,
                detalle={
                    "id_factura": request_body.id_factura,
                    "total": request_body.total,
                    "proveedor_id": request_body.proveedor_id,
                },
            )

            updated = facturas_repo.get_by_id(conn, new_id)

    except IntegrityError as exc:
        msg = str(exc.orig) if exc.orig else str(exc)
        if "UNIQUE" in msg or "id_factura" in msg:
            return error_response(409, "Ya existe una factura registrada con ese ID")
        return error_response(409, f"Error de integridad al registrar factura: {msg}")
    except Exception as exc:
        return error_response(500, f"Error al registrar factura: {exc}")

    return ApiResponse[FacturaResponse](
        success=True,
        data=FacturaResponse(**updated),
        error=None,
        timestamp=now_utc(),
    )
