"""purchases.py — Lista de compras generada en tiempo real.

Desde FASE 1, la tabla lista_compras fue eliminada.
La lista se computa en tiempo real a partir de productos con stock < stock_min.

Endpoints:
    GET  /api/compras         — lista de productos bajo stock minimo
    GET  /api/compras/export  — misma lista formateada para exportacion
"""

import hashlib

from fastapi import APIRouter, Header, Request

from auth_helpers import extract_bearer_token, decode_token, require_role
from database import get_engine
from http_helpers import error_response
from repositories import auth_repo, purchases_repo
from repositories.base import now_utc
from schemas import (
    ApiResponse,
    ExportPurchaseListResponse,
    PurchaseLineItemResponse,
    PurchaseListResponse,
)

router = APIRouter()


def _row_to_purchase_item(row: dict) -> PurchaseLineItemResponse:
    return PurchaseLineItemResponse(
        id=row["producto_id"],
        producto_id=row["producto_id"],
        nombre_producto=row["nombre_producto"],
        cantidad_sugerida=float(row["cantidad_sugerida"]),
        cantidad_ajustada=None,
        generada_en=now_utc(),
        categoria_nombre=row.get("categoria_nombre"),
        area_nombre=row.get("area_nombre"),
        unidad_nombre=row.get("unidad_nombre"),
        proveedor_nombre=row.get("proveedor_nombre"),
        stock_actual=float(row["stock_actual"]) if row.get("stock_actual") is not None else None,
        stock_min=float(row["stock_min"]) if row.get("stock_min") is not None else None,
    )


def _get_user_name_from_token(authorization: str | None) -> str | None:
    token = extract_bearer_token(authorization)
    if not token:
        return None

    payload = decode_token(token)
    if not payload or "sub" not in payload:
        return None

    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    now = now_utc()
    with get_engine().begin() as conn:
        session_row = auth_repo.validate_session(conn, token_hash, now)
        if not session_row:
            return None
        user = auth_repo.get_user_profile(conn, int(payload["sub"]))

    return user["nombre"] if user else None


@router.get("", response_model=ApiResponse[PurchaseListResponse])
async def list_purchase_items(request: Request):
    """Lista de compras computada en tiempo real (productos bajo stock minimo)."""
    require_role(request, ["administrador", "gerente", "encargado_compras"])
    with get_engine().connect() as conn:
        rows = purchases_repo.get_purchase_list(conn)

    items = [_row_to_purchase_item(r) for r in rows]
    now = now_utc()

    return ApiResponse[PurchaseListResponse](
        success=True,
        data=PurchaseListResponse(
            total=len(items),
            items=items,
            generada_en=now,
            exportada=False,
        ),
        error=None,
        timestamp=now,
    )


@router.get("/export", response_model=ApiResponse[ExportPurchaseListResponse])
async def export_purchase_list(request: Request, authorization: str | None = Header(default=None)):
    """Exporta la lista de compras actual."""
    require_role(request, ["administrador", "gerente", "encargado_compras"])
    now = now_utc()
    user_name = _get_user_name_from_token(authorization)

    with get_engine().connect() as conn:
        rows = purchases_repo.get_purchase_list(conn)
        if not rows:
            return error_response(404, "No hay items pendientes para exportar")

    return ApiResponse[ExportPurchaseListResponse](
        success=True,
        data=ExportPurchaseListResponse(
            items=[_row_to_purchase_item(r) for r in rows],
            fecha_exportacion=now,
            usuario=user_name,
        ),
        error=None,
        timestamp=now,
    )
