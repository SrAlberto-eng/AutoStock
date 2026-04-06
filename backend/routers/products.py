"""products.py — Endpoints de productos (CRUD + bulk + detalle)."""

from typing import Any, Optional

from fastapi import APIRouter, Body, HTTPException, Path, Query, Request
from sqlalchemy.exc import IntegrityError

from auth_helpers import require_role
from database import get_engine
from http_helpers import error_response, current_user_id
from repositories import audit_repo, products_repo, movements_repo
from repositories.base import now_utc, to_datetime, compute_estado
from sanitizers import sanitize_string
from schemas import (
    ApiResponse,
    ProductCreateRequest,
    ProductListResponse,
    ProductResponse,
)

router = APIRouter()


def _row_to_product(row: Any) -> ProductResponse:
    return ProductResponse(
        id=row["id"],
        nombre=row["nombre"],
        categoria_id=row["categoria_id"],
        area_id=row["area_id"],
        unidad_id=row["unidad_id"],
        proveedor_id=row["proveedor_id"],
        stock_actual=float(row["stock_actual"]),
        stock_min=float(row["stock_min"]),
        stock_max=float(row["stock_max"]),
        estado=row["estado"],
        activo=bool(row["activo"]),
        created_at=to_datetime(row["created_at"]),
    )


@router.get("", response_model=ApiResponse[ProductListResponse])
async def list_products(
    nombre: Optional[str] = Query(None),
    categoria_id: Optional[int] = Query(None),
    area_id: Optional[int] = Query(None),
    estado: Optional[str] = Query(None),
    include_inactive: bool = Query(False),
):
    with get_engine().begin() as conn:
        rows = products_repo.list_products(conn, nombre, categoria_id, area_id, estado, include_inactive)

    items = [_row_to_product(row) for row in rows]

    return ApiResponse[ProductListResponse](
        success=True,
        data=ProductListResponse(
            total=len(items),
            items=items,
            filters_applied={
                "nombre": nombre,
                "categoria_id": categoria_id,
                "area_id": area_id,
                "estado": estado,
            },
        ),
        error=None,
        timestamp=now_utc(),
    )


@router.post("", response_model=ApiResponse[ProductResponse])
async def create_product(request: ProductCreateRequest, http_request: Request):
    require_role(http_request, ["administrador", "gerente"])
    usuario_id = current_user_id(http_request)
    nombre = sanitize_string(request.nombre, 100, "nombre")

    try:
        with get_engine().begin() as conn:
            new_id = products_repo.create_product(
                conn,
                nombre=nombre,
                categoria_id=request.categoria_id,
                area_id=request.area_id,
                unidad_id=request.unidad_id,
                proveedor_id=request.proveedor_id,
                stock_min=float(request.stock_min),
                stock_max=float(request.stock_max),
                stock_actual=float(request.stock_actual),
            )
            if float(request.stock_actual) > 0:
                movements_repo.create_movement(
                    conn,
                    tipo="entrada",
                    producto_id=int(new_id),
                    cantidad=float(request.stock_actual),
                    fecha_sistema=now_utc(),
                    usuario_id=usuario_id,
                    motivo="Stock inicial",
                    area_id=None,
                )
            audit_repo.log_audit(
                conn,
                usuario_id=usuario_id,
                accion="CREATE",
                entidad="productos",
                entidad_id=int(new_id),
                detalle={"nombre": nombre},
            )
            row = products_repo.get_by_id(conn, new_id, active_only=False)
    except IntegrityError:
        return error_response(409, "No se pudo crear el producto por conflicto de datos")

    return ApiResponse[ProductResponse](
        success=True,
        data=_row_to_product(row),
        error=None,
        timestamp=now_utc(),
    )


@router.post("/bulk", response_model=ApiResponse[dict])
async def bulk_create_products(http_request: Request, payload: dict = Body(default_factory=dict)):
    require_role(http_request, ["administrador", "gerente"])
    usuario_id = current_user_id(http_request)

    raw_items = payload.get("items") or payload.get("productos") or []
    if not isinstance(raw_items, list):
        return error_response(400, "El body debe incluir una lista en 'items'")

    created_items: list[dict[str, Any]] = []
    created_count = 0
    omitted_count = 0

    with get_engine().begin() as conn:
        for raw in raw_items:
            if not isinstance(raw, dict):
                omitted_count += 1
                continue

            nombre = str(raw.get("nombre") or "").strip()
            categoria_id = raw.get("categoria_id")
            area_id = raw.get("area_id")
            unidad_id = raw.get("unidad_id")

            if not (nombre and categoria_id and area_id and unidad_id):
                omitted_count += 1
                continue

            stock_actual = float(raw.get("stock_actual") or 0)
            if stock_actual < 0:
                omitted_count += 1
                continue

            stock_min = float(raw.get("stock_min") or 0)
            stock_max = float(raw.get("stock_max") or max(stock_min, stock_actual, 0))

            try:
                new_id = products_repo.create_product(
                    conn,
                    nombre=nombre,
                    categoria_id=int(categoria_id),
                    area_id=int(area_id),
                    unidad_id=int(unidad_id),
                    proveedor_id=raw.get("proveedor_id"),
                    stock_min=stock_min,
                    stock_max=stock_max,
                    stock_actual=stock_actual,
                )
            except (IntegrityError, ValueError, TypeError):
                omitted_count += 1
                continue

            if stock_actual > 0:
                movements_repo.create_movement(
                    conn,
                    tipo="entrada",
                    producto_id=int(new_id),
                    cantidad=stock_actual,
                    fecha_sistema=now_utc(),
                    usuario_id=usuario_id,
                    motivo="Stock inicial",
                    area_id=None,
                )
            row = products_repo.get_by_id(conn, new_id, active_only=False)
            if row:
                created_items.append(_row_to_product(row).dict())
                created_count += 1

    return ApiResponse[dict](
        success=True,
        data={
            "creados": created_count,
            "omitidos": omitted_count,
            "items": created_items,
        },
        error=None,
        timestamp=now_utc(),
    )


@router.get("/{product_id}", response_model=ApiResponse[dict])
async def get_product_detail(product_id: int = Path(..., gt=0)):
    with get_engine().begin() as conn:
        row = products_repo.get_by_id(conn, product_id, active_only=False)
        if not row:
            return error_response(404, "Producto no encontrado")

        history_rows = products_repo.get_product_history(conn, product_id)

    historial = [
        {
            "id": h["id"],
            "tipo": h["tipo"],
            "cantidad": float(h["cantidad"]),
            "fecha_sistema": to_datetime(h["fecha_sistema"]).isoformat(),
            "usuario_id": h["usuario_id"],
            "motivo": h["motivo"],
            "revertido": bool(h["revertido"]),
        }
        for h in history_rows
    ]

    return ApiResponse[dict](
        success=True,
        data={
            "producto": _row_to_product(row).dict(),
            "historial": historial,
        },
        error=None,
        timestamp=now_utc(),
    )


@router.patch("/{product_id}", response_model=ApiResponse[ProductResponse])
async def update_product(
    http_request: Request,
    product_id: int = Path(..., gt=0),
    payload: dict = Body(default_factory=dict),
):
    require_role(http_request, ["administrador", "gerente"])
    usuario_id = current_user_id(http_request)
    allowed_fields = {
        "nombre",
        "categoria_id",
        "area_id",
        "unidad_id",
        "proveedor_id",
        "stock_actual",
        "stock_min",
        "stock_max",
    }
    incoming = {k: v for k, v in payload.items() if k in allowed_fields}

    with get_engine().begin() as conn:
        current = products_repo.get_by_id(conn, product_id)
        if not current:
            return error_response(404, "Producto no encontrado")

        if "stock_actual" in incoming:
            try:
                if float(incoming["stock_actual"]) < 0:
                    return error_response(400, "stock_actual no puede ser negativo")
            except (TypeError, ValueError):
                return error_response(400, "stock_actual debe ser numérico")

        updated_stock_actual = float(incoming.get("stock_actual", current["stock_actual"]))
        updated_stock_min = float(incoming.get("stock_min", current["stock_min"]))
        incoming["estado"] = compute_estado(updated_stock_actual, updated_stock_min)

        if "nombre" in incoming:
            incoming["nombre"] = sanitize_string(incoming["nombre"], 100, "nombre")
        for int_field in ("categoria_id", "area_id", "unidad_id", "proveedor_id"):
            if int_field in incoming and incoming[int_field] is not None:
                incoming[int_field] = int(incoming[int_field])
        for float_field in ("stock_actual", "stock_min", "stock_max"):
            if float_field in incoming:
                incoming[float_field] = float(incoming[float_field])

        products_repo.update_product(conn, product_id, incoming)
        audit_repo.log_audit(
            conn,
            usuario_id=usuario_id,
            accion="UPDATE",
            entidad="productos",
            entidad_id=product_id,
            detalle={"fields": sorted(list(incoming.keys()))},
        )
        row = products_repo.get_by_id(conn, product_id, active_only=False)

    return ApiResponse[ProductResponse](
        success=True,
        data=_row_to_product(row),
        error=None,
        timestamp=now_utc(),
    )


@router.post("/{product_id}/toggle", response_model=ApiResponse[ProductResponse])
async def toggle_product(http_request: Request, product_id: int = Path(..., gt=0)):
    """Activa/desactiva producto (soft delete reversible)."""
    require_role(http_request, ["administrador", "gerente"])
    usuario_id = current_user_id(http_request)

    with get_engine().begin() as conn:
        existing = products_repo.get_by_id(conn, product_id, active_only=False)
        if not existing:
            return error_response(404, "Producto no encontrado")

        nuevo_estado = 0 if existing["activo"] else 1
        products_repo.toggle_activo(conn, product_id, nuevo_estado)

        audit_repo.log_audit(
            conn,
            usuario_id=usuario_id,
            accion="UPDATE",
            entidad="productos",
            entidad_id=product_id,
            detalle={"activo": nuevo_estado},
        )
        row = products_repo.get_by_id(conn, product_id, active_only=False)

    return ApiResponse[ProductResponse](
        success=True,
        data=_row_to_product(row),
        error=None,
        timestamp=now_utc(),
    )


@router.delete("/{product_id}", response_model=ApiResponse[dict])
async def soft_delete_product(http_request: Request, product_id: int = Path(..., gt=0)):
    require_role(http_request, ["administrador", "gerente"])
    usuario_id = current_user_id(http_request)

    with get_engine().begin() as conn:
        existing = products_repo.get_by_id(conn, product_id)
        if not existing:
            return error_response(404, "Producto no encontrado")

        products_repo.soft_delete(conn, product_id)
        audit_repo.log_audit(
            conn,
            usuario_id=usuario_id,
            accion="DELETE",
            entidad="productos",
            entidad_id=product_id,
        )

    return ApiResponse[dict](
        success=True,
        data={"deleted": True, "tipo": "soft"},
        error=None,
        timestamp=now_utc(),
    )
