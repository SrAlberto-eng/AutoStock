"""movements.py — Endpoints de movimientos, dashboard e importacion XML."""

import base64
import xml.etree.ElementTree as ET
from typing import Optional

from fastapi import APIRouter, Body, Path, Query, HTTPException, Request

from auth_helpers import require_role
from database import get_engine
from http_helpers import error_response, current_user_id
from repositories import audit_repo, movements_repo
from repositories.base import now_utc, to_datetime, compute_estado
from sanitizers import sanitize_string
from schemas import (
    ApiResponse,
    MovementCreateRequest,
    MovementResponse,
    MovementListResponse,
    RevertMovementResponse,
    ImportacionPreviewResponse,
    DashboardResumenResponse,
)
from validators import validate_merma_motivo, validate_reversion_same_day

router = APIRouter()
dashboard_router = APIRouter()
importacion_router = APIRouter()


def _row_to_movement(row) -> MovementResponse:
    return MovementResponse(
        id=row["id"],
        tipo=row["tipo"],
        producto_id=row["producto_id"],
        producto_nombre=row.get("producto_nombre"),
        cantidad=row["cantidad"],
        fecha_sistema=to_datetime(row["fecha_sistema"]),
        usuario_id=row["usuario_id"],
        motivo=row["motivo"],
        revertido=bool(row["revertido"]),
    )


@router.post("", response_model=ApiResponse[dict])
async def create_movement(request_body: MovementCreateRequest, request: Request):
    now = now_utc()

    if not request_body.items:
        return error_response(400, "items no puede estar vacío")

    if request_body.tipo == "salida" and not request_body.area_id:
        return error_response(400, "area_id es requerido para salidas")

    if request_body.tipo == "merma":
        for item in request_body.items:
            motivo = sanitize_string(
                item.motivo or request_body.motivo_general, 500, "motivo"
            )
            if not validate_merma_motivo(motivo):
                return error_response(
                    400, f"Merma sin motivo para producto_id={item.producto_id}"
                )

    movimientos_creados = 0
    total_cantidad = 0.0
    usuario_id = current_user_id(request)

    try:
        with get_engine().begin() as conn:
            area_id_usuario = None
            if request_body.tipo == "salida" and usuario_id is not None:
                area_id_usuario = movements_repo.get_user_area(conn, usuario_id)

            for item in request_body.items:
                product = movements_repo.get_product_for_movement(conn, item.producto_id)
                if not product:
                    raise HTTPException(
                        status_code=404,
                        detail=f"Producto {item.producto_id} no encontrado o inactivo",
                    )

                if request_body.tipo in ("salida", "merma"):
                    if product["stock_actual"] < item.cantidad:
                        nombre = product.get("nombre", f"#{item.producto_id}")
                        raise HTTPException(
                            status_code=409,
                            detail=(
                                f"Stock insuficiente para {nombre}: "
                                f"disponible: {product['stock_actual']}, "
                                f"solicitado: {item.cantidad}"
                            ),
                        )

                if request_body.tipo == "salida" and area_id_usuario is not None:
                    if product["area_id"] != area_id_usuario:
                        raise HTTPException(
                            status_code=403,
                            detail="Solo puedes registrar salidas de tu área asignada",
                        )

                motivo = item.motivo or request_body.motivo_general
                if request_body.tipo == "merma":
                    motivo = sanitize_string(motivo, 500, "motivo")

                movement_id = movements_repo.create_movement(
                    conn,
                    tipo=request_body.tipo,
                    producto_id=item.producto_id,
                    cantidad=item.cantidad,
                    fecha_sistema=now,
                    usuario_id=usuario_id,
                    motivo=motivo,
                    area_id=request_body.area_id,
                )

                audit_repo.log_audit(
                    conn,
                    usuario_id=usuario_id,
                    accion="CREATE",
                    entidad="movimientos",
                    entidad_id=movement_id,
                    detalle={
                        "tipo": request_body.tipo,
                        "producto_id": item.producto_id,
                        "cantidad": item.cantidad,
                    },
                )

                movements_repo.apply_stock_change(
                    conn, item.producto_id, request_body.tipo, item.cantidad
                )

                movimientos_creados += 1
                total_cantidad += item.cantidad

    except HTTPException:
        raise
    except Exception as exc:
        return error_response(500, f"Error al registrar movimiento: {exc}")

    return ApiResponse[dict](
        success=True,
        data={
            "movimientos_creados": movimientos_creados,
            "cantidad_items": total_cantidad,
            "tipo": request_body.tipo,
            "fecha_sistema": now.isoformat(),
        },
        error=None,
        timestamp=now,
    )


@router.get("", response_model=ApiResponse[MovementListResponse])
async def list_movements(
    tipo: Optional[str] = Query(None, pattern="^(entrada|salida|merma)$"),
    producto_id: Optional[int] = Query(None),
    fecha_desde: Optional[str] = Query(None),
    fecha_hasta: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
):
    now = now_utc()

    with get_engine().connect() as conn:
        rows, total = movements_repo.list_movements(
            conn, tipo, producto_id, fecha_desde, fecha_hasta, skip, limit
        )

    items = [_row_to_movement(r) for r in rows]
    filters_applied = {
        k: v
        for k, v in {
            "tipo": tipo,
            "producto_id": producto_id,
            "fecha_desde": fecha_desde,
            "fecha_hasta": fecha_hasta,
        }.items()
        if v is not None
    }

    return ApiResponse[MovementListResponse](
        success=True,
        data=MovementListResponse(total=total, items=items, filters_applied=filters_applied),
        error=None,
        timestamp=now,
    )


@router.post("/{movement_id}/revertir", response_model=ApiResponse[RevertMovementResponse])
async def revert_movement(request: Request, movement_id: int = Path(..., gt=0)):
    require_role(request, ["administrador"])
    now = now_utc()
    usuario_id = current_user_id(request)

    with get_engine().begin() as conn:
        row = movements_repo.get_movement(conn, movement_id)
        if not row:
            return error_response(404, "Movimiento no encontrado")

        if bool(row["revertido"]):
            return error_response(409, "El movimiento ya estaba revertido")

        if row["tipo"] == "entrada":
            return error_response(400, "Las entradas no son reversibles")

        product = movements_repo.get_product_for_movement(conn, row["producto_id"])
        if not product:
            return error_response(409, "El producto asociado está inactivo o fue eliminado")

        fecha = to_datetime(row["fecha_sistema"])
        if not validate_reversion_same_day(fecha):
            return error_response(400, "Solo se pueden revertir movimientos del día actual")

        reversion_id = movements_repo.create_movement(
            conn,
            tipo="entrada",
            producto_id=row["producto_id"],
            cantidad=row["cantidad"],
            fecha_sistema=now,
            usuario_id=usuario_id,
            motivo=f"Reversión de movimiento #{movement_id}",
            area_id=row["area_id"],
        )

        movements_repo.apply_stock_change(conn, row["producto_id"], "entrada", row["cantidad"])
        movements_repo.mark_as_reverted(conn, movement_id)

        audit_repo.log_audit(
            conn,
            usuario_id=usuario_id,
            accion="UPDATE",
            entidad="movimientos",
            entidad_id=movement_id,
            detalle={"movimiento_reversion_id": reversion_id},
        )

    return ApiResponse[RevertMovementResponse](
        success=True,
        data=RevertMovementResponse(
            movimiento_original_id=movement_id,
            movimiento_reversion_id=reversion_id,
            cantidad_revertida=float(row["cantidad"]),
            fecha_reversion=now,
        ),
        error=None,
        timestamp=now,
    )


@dashboard_router.get("/resumen", response_model=ApiResponse[DashboardResumenResponse])
async def get_dashboard_summary():
    now = now_utc()
    today = now.date().isoformat()

    with get_engine().connect() as conn:
        data = movements_repo.get_dashboard_summary(conn, today)

    return ApiResponse[DashboardResumenResponse](
        success=True,
        data=data,
        error=None,
        timestamp=now,
    )


# ── Importacion XML ──────────────────────────────────────────────────────────

_NS_CFDI4 = "http://www.sat.gob.mx/cfd/4"
_NS_CFDI3 = "http://www.sat.gob.mx/cfd/3"


def _simple_match(nombre_factura: str, products: list, top_k: int = 3) -> list:
    lower = nombre_factura.lower()
    words_f = set(lower.split())
    scored = []
    for p in products:
        words_db = set(p["nombre"].lower().split())
        if not words_f or not words_db:
            continue
        overlap = len(words_f & words_db)
        if overlap:
            score = round(overlap / max(len(words_f), len(words_db)), 2)
            if score >= 0.3:
                scored.append(
                    {"producto_id": p["id"], "nombre_bd": p["nombre"], "confianza": score}
                )
    scored.sort(key=lambda x: x["confianza"], reverse=True)
    return scored[:top_k]


@importacion_router.post("/preview", response_model=ApiResponse[ImportacionPreviewResponse])
async def preview_xml_import(xml_base64: str = Body(..., embed=True)):
    now = now_utc()

    try:
        xml_bytes = base64.b64decode(xml_base64)
    except Exception:
        raise HTTPException(status_code=400, detail="XML base64 inválido")

    if len(xml_bytes) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="El XML excede el tamaño máximo de 5MB")

    xml_content = xml_bytes.decode("utf-8", errors="replace")
    if "<!ENTITY" in xml_content or "SYSTEM" in xml_content:
        raise HTTPException(status_code=400, detail="El XML contiene entidades no permitidas")

    try:
        root = ET.fromstring(xml_content)
    except ET.ParseError as exc:
        return error_response(400, f"XML inválido: {exc}")

    conceptos = (
        root.findall(f".//{{{_NS_CFDI4}}}Concepto")
        or root.findall(f".//{{{_NS_CFDI3}}}Concepto")
        or root.findall(".//Concepto")
    )
    if not conceptos:
        return error_response(400, "No se encontraron conceptos en el XML")

    with get_engine().connect() as conn:
        products = movements_repo.get_active_products_for_matching(conn)

    lineas = []
    for i, concepto in enumerate(conceptos, start=1):
        descripcion = concepto.get("Descripcion") or concepto.get("descripcion") or ""
        cantidad_raw = concepto.get("Cantidad") or concepto.get("cantidad") or "0"
        try:
            cantidad = float(cantidad_raw)
        except ValueError:
            cantidad = 0.0

        lineas.append(
            {
                "numero_linea": i,
                "nombre_factura": descripcion,
                "cantidad": cantidad,
                "matches": _simple_match(descripcion, products),
            }
        )

    return ApiResponse[ImportacionPreviewResponse](
        success=True,
        data=ImportacionPreviewResponse(total_lineas=len(lineas), lineas=lineas),
        error=None,
        timestamp=now,
    )
