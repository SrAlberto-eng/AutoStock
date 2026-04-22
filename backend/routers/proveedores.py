"""proveedores.py — CRUD para proveedores."""

from fastapi import APIRouter, Path, Query, Request
from sqlalchemy.exc import IntegrityError

from auth_helpers import require_role
from database import get_engine
from http_helpers import error_response, current_user_id
from repositories import audit_repo, proveedores_repo
from repositories.base import now_utc
from sanitizers import sanitize_string
from validators import validate_email
from fastapi import HTTPException
from schemas import (
    ApiResponse,
    ProveedorCreateRequest,
    ProveedorListResponse,
    ProveedorResponse,
    ProveedorUpdateRequest,
)

router = APIRouter()


@router.get("", response_model=ApiResponse[ProveedorListResponse])
async def list_proveedores(
    request: Request,
    include_inactive: bool = Query(False),
):
    """Lista proveedores. Solo admin/gerente ven inactivos."""
    if include_inactive:
        require_role(request, ["administrador", "gerente"])

    with get_engine().connect() as conn:
        items = proveedores_repo.list_proveedores(conn, include_inactive)

    now = now_utc()
    return ApiResponse[ProveedorListResponse](
        success=True,
        data=ProveedorListResponse(
            total=len(items),
            items=[ProveedorResponse(**i) for i in items],
        ),
        error=None,
        timestamp=now,
    )


@router.post("", response_model=ApiResponse[ProveedorResponse])
async def create_proveedor(request_body: ProveedorCreateRequest, request: Request):
    require_role(request, ["administrador", "gerente"])
    usuario_id = current_user_id(request)
    nombre = sanitize_string(request_body.nombre, 100, "nombre")
    email = sanitize_string(request_body.email, 100, "email")
    telefono = sanitize_string(request_body.telefono, 100, "telefono") if request_body.telefono else None

    try:
        with get_engine().begin() as conn:
            new_id = proveedores_repo.create_proveedor(conn, nombre, email, telefono)
            audit_repo.log_audit(
                conn,
                usuario_id=usuario_id,
                accion="CREATE",
                entidad="proveedores",
                entidad_id=new_id,
                detalle={"nombre": nombre, "email": email, "telefono": telefono},
            )
    except IntegrityError:
        return error_response(409, "Ya existe un proveedor con ese nombre")

    return ApiResponse[ProveedorResponse](
        success=True,
        data=ProveedorResponse(id=new_id, nombre=nombre, email=email, telefono=telefono, activo=True, productos_asociados=0),
        error=None,
        timestamp=now_utc(),
    )


@router.patch("/{proveedor_id}", response_model=ApiResponse[ProveedorResponse])
async def update_proveedor(
    request: Request,
    request_body: ProveedorUpdateRequest,
    proveedor_id: int = Path(..., gt=0),
):
    require_role(request, ["administrador", "gerente"])

    if (request_body.nombre) is None and (request_body.email) is None and (request_body.telefono) is None:
        return error_response(400, "No hay campos para actualizar")

    nombre = sanitize_string(request_body.nombre, 100, "nombre").lower()

    email = sanitize_string(request_body.email, 100, "email").lower()

    if not validate_email(email):
        raise HTTPException(status_code=400, detail="Formato de email inválido")
    
    telefono = sanitize_string(request_body.telefono, 100, "telefono") if request_body.telefono else None                                                                                                                                                           
    
    try:
        with get_engine().begin() as conn:
            existing = proveedores_repo.get_by_id(conn, proveedor_id)
            if not existing:
                return error_response(404, "Proveedor no encontrado")

            proveedores_repo.update_proveedor(conn, proveedor_id, nombre, email, telefono)
            updated = proveedores_repo.get_by_id(conn, proveedor_id)

            audit_repo.log_audit(
                conn,
                usuario_id=current_user_id(request),
                accion="UPDATE",
                entidad="proveedores",
                entidad_id=proveedor_id,
                detalle={"nombre": nombre, "email": email, "telefono": telefono},
            )
    except IntegrityError:
        return error_response(409, "Ya existe un proveedor con ese nombre")

    with get_engine().connect() as conn:
        linked = proveedores_repo.count_linked_products(conn, proveedor_id)

    return ApiResponse[ProveedorResponse](
        success=True,
        data=ProveedorResponse(
            id=updated["id"],
            nombre=updated["nombre"],
            email=updated["email"],
            telefono=updated["telefono"],
            activo=bool(updated["activo"]),
            productos_asociados=linked,
        ),
        error=None,
        timestamp=now_utc(),
    )


@router.post("/{proveedor_id}/toggle", response_model=ApiResponse[ProveedorResponse])
async def toggle_proveedor(request: Request, proveedor_id: int = Path(..., gt=0)):
    """Activa/desactiva proveedor (soft delete)."""
    require_role(request, ["administrador", "gerente"])

    with get_engine().begin() as conn:
        existing = proveedores_repo.get_by_id(conn, proveedor_id)
        if not existing:
            return error_response(404, "Proveedor no encontrado")

        nuevo_estado = 0 if existing["activo"] else 1
        proveedores_repo.toggle_activo(conn, proveedor_id, nuevo_estado)

        audit_repo.log_audit(
            conn,
            usuario_id=current_user_id(request),
            accion="UPDATE",
            entidad="proveedores",
            entidad_id=proveedor_id,
            detalle={"activo": nuevo_estado},
        )

    with get_engine().connect() as conn:
        updated = proveedores_repo.get_by_id(conn, proveedor_id)
        linked = proveedores_repo.count_linked_products(conn, proveedor_id)

    return ApiResponse[ProveedorResponse](
        success=True,
        data=ProveedorResponse(
            id=updated["id"],
            nombre=updated["nombre"],
            email=updated["email"],
            telefono=updated["telefono"],
            activo=bool(updated["activo"]),
            productos_asociados=linked,
        ),
        error=None,
        timestamp=now_utc(),
    )
