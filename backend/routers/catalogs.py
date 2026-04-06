"""catalogs.py — CRUD para catalogos (categorias, areas, unidades de medida)."""

from fastapi import APIRouter, Path, Request
from sqlalchemy.exc import IntegrityError

from auth_helpers import require_role
from database import get_engine
from http_helpers import error_response, current_user_id
from repositories import audit_repo, catalogs_repo
from repositories.base import now_utc
from sanitizers import sanitize_string
from schemas import (
    ApiResponse,
    CatalogItem,
    CatalogItemCreate,
    UnidadMedida,
    UnidadMedidaCreate,
    UnidadMedidaUpdate,
)

router = APIRouter()


@router.get("/{tipo}", response_model=ApiResponse[dict])
async def list_catalog_items(
    tipo: str = Path(..., pattern="^(categorias|areas|unidades)$"),
):
    with get_engine().begin() as conn:
        items = catalogs_repo.list_items(conn, tipo)

    return ApiResponse[dict](
        success=True,
        data={"total": len(items), "items": items},
        error=None,
        timestamp=now_utc(),
    )


@router.post("/unidades", response_model=ApiResponse[UnidadMedida])
async def create_unidad_medida(http_request: Request, request: UnidadMedidaCreate):
    require_role(http_request, ["administrador", "gerente"])
    usuario_id = current_user_id(http_request)

    nombre = sanitize_string(request.nombre, 100, "nombre")
    if not request.abreviacion.strip():
        return error_response(400, "Nombre y abreviación son obligatorios")

    try:
        with get_engine().begin() as conn:
            new_id = catalogs_repo.create_unidad(conn, nombre, request.abreviacion.strip())
            audit_repo.log_audit(
                conn,
                usuario_id=usuario_id,
                accion="CREATE",
                entidad="unidades",
                entidad_id=int(new_id),
                detalle={"nombre": nombre},
            )
    except IntegrityError:
        return error_response(409, "No se pudo crear la unidad de medida")

    return ApiResponse[UnidadMedida](
        success=True,
        data=UnidadMedida(id=new_id, nombre=nombre, abreviacion=request.abreviacion.strip()),
        error=None,
        timestamp=now_utc(),
    )


@router.post("/{tipo}", response_model=ApiResponse[CatalogItem])
async def create_catalog_item(
    http_request: Request,
    tipo: str = Path(..., pattern="^(categorias|areas)$"),
    request: CatalogItemCreate = None,
):
    nombre = sanitize_string(request.nombre if request else None, 100, "nombre")
    require_role(http_request, ["administrador", "gerente"])
    usuario_id = current_user_id(http_request)

    try:
        with get_engine().begin() as conn:
            new_id = catalogs_repo.create_item(conn, tipo, nombre)
            audit_repo.log_audit(
                conn,
                usuario_id=usuario_id,
                accion="CREATE",
                entidad=tipo,
                entidad_id=int(new_id),
                detalle={"nombre": nombre},
            )
    except IntegrityError:
        return error_response(409, "Ya existe un elemento con ese nombre")

    return ApiResponse[CatalogItem](
        success=True,
        data=CatalogItem(id=new_id, nombre=nombre),
        error=None,
        timestamp=now_utc(),
    )


@router.patch("/unidades/{item_id}", response_model=ApiResponse[UnidadMedida])
async def update_unidad_medida(
    http_request: Request,
    item_id: int = Path(..., gt=0),
    request: UnidadMedidaUpdate = None,
):
    require_role(http_request, ["administrador", "gerente"])
    if request is None:
        return error_response(400, "No hay campos para actualizar")

    fields = {}
    if request.nombre is not None:
        fields["nombre"] = sanitize_string(request.nombre, 50, "nombre")
    if request.abreviacion is not None:
        abrev = request.abreviacion.strip()
        if not abrev:
            return error_response(400, "abreviacion no puede estar vacia")
        fields["abreviacion"] = abrev

    if not fields:
        return error_response(400, "No hay campos para actualizar")

    try:
        with get_engine().begin() as conn:
            existing = catalogs_repo.get_unidad(conn, item_id)
            if not existing:
                return error_response(404, "Unidad no encontrada")
            catalogs_repo.update_unidad(conn, item_id, fields)
            updated = catalogs_repo.get_unidad(conn, item_id)
    except IntegrityError:
        return error_response(409, "Ya existe una unidad con ese nombre")

    return ApiResponse[UnidadMedida](
        success=True,
        data=UnidadMedida(
            id=updated["id"],
            nombre=updated["nombre"],
            abreviacion=updated["abreviacion"],
        ),
        error=None,
        timestamp=now_utc(),
    )


@router.patch("/{tipo}/{item_id}", response_model=ApiResponse[CatalogItem])
async def update_catalog_item(
    http_request: Request,
    tipo: str = Path(..., pattern="^(categorias|areas)$"),
    item_id: int = Path(..., gt=0),
    request: CatalogItemCreate = None,
):
    nombre = sanitize_string(request.nombre if request else None, 100, "nombre")
    require_role(http_request, ["administrador", "gerente"])

    try:
        with get_engine().begin() as conn:
            existing = catalogs_repo.get_item(conn, tipo, item_id)
            if not existing:
                return error_response(404, "Elemento no encontrado")
            catalogs_repo.update_item(conn, tipo, item_id, nombre)
    except IntegrityError:
        return error_response(409, "Ya existe un elemento con ese nombre")

    return ApiResponse[CatalogItem](
        success=True,
        data=CatalogItem(id=item_id, nombre=nombre),
        error=None,
        timestamp=now_utc(),
    )


@router.delete("/{tipo}/{item_id}", response_model=ApiResponse[dict])
async def delete_catalog_item(
    http_request: Request,
    tipo: str = Path(..., pattern="^(categorias|areas|unidades)$"),
    item_id: int = Path(..., gt=0),
):
    require_role(http_request, ["administrador", "gerente"])
    usuario_id = current_user_id(http_request)

    with get_engine().begin() as conn:
        existing = catalogs_repo.get_item(conn, tipo, item_id)
        if not existing:
            return error_response(404, "Elemento no encontrado")

        linked = catalogs_repo.count_linked_products(conn, tipo, item_id)
        if linked > 0:
            return error_response(409, "No se puede eliminar: tiene productos asociados")

        catalogs_repo.delete_item(conn, tipo, item_id)
        audit_repo.log_audit(
            conn,
            usuario_id=usuario_id,
            accion="DELETE",
            entidad=tipo,
            entidad_id=item_id,
            detalle={"tipo": tipo},
        )

    return ApiResponse[dict](
        success=True,
        data={"mensaje": f"{tipo} ID {item_id} eliminado", "id": item_id},
        error=None,
        timestamp=now_utc(),
    )
