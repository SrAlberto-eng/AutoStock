"""users.py — Endpoints de gestion de usuarios y roles."""

import hashlib
import secrets
import string

import bcrypt
from fastapi import APIRouter, Header, HTTPException, Path, Query, Request
from fastapi.responses import JSONResponse

from auth_helpers import extract_bearer_token, decode_token
from database import get_engine
from http_helpers import error_response, current_user_id
from repositories import audit_repo, auth_repo, users_repo
from repositories.base import now_utc, to_datetime_optional
from sanitizers import sanitize_string
from schemas import (
    ApiResponse,
    UserCreateRequest,
    UserUpdateRequest,
    UserResponse,
    UserListResponse,
    ResetPasswordResponse,
    SelfPasswordChangeRequest,
    UnblockUserResponse,
)
from validators import validate_email

router = APIRouter()


def _get_actor(authorization: str | None) -> dict | None:
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
        actor = auth_repo.get_actor(conn, int(payload["sub"]))

    return actor


def _require_admin(authorization: str | None) -> dict | JSONResponse:
    actor = _get_actor(authorization)
    if not actor:
        return error_response(401, "No autenticado")
    if actor["rol"] != "administrador":
        return error_response(403, "Solo administrador puede ejecutar esta operación")
    return actor


def _row_to_user(row) -> UserResponse:
    return UserResponse(
        id=row["id"],
        nombre=row["nombre"],
        email=row["email"],
        role_id=row["role_id"],
        rol=row["rol"],
        area_id=row.get("area_id"),
        area_nombre=row.get("area_nombre"),
        bloqueado_hasta=to_datetime_optional(row.get("bloqueado_hasta")),
        debe_cambiar_password=bool(row.get("debe_cambiar_password")),
        activo=bool(row["activo"]),
        created_at=to_datetime_optional(row["created_at"]) or now_utc(),
    )


def _generate_temp_password(length: int = 8) -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


@router.get("", response_model=ApiResponse[UserListResponse])
async def list_users(
    authorization: str | None = Header(default=None),
    include_inactive: bool = Query(False),
):
    actor = _require_admin(authorization)
    if isinstance(actor, JSONResponse):
        return actor

    with get_engine().begin() as conn:
        rows = users_repo.list_active_users(conn, include_inactive)

    items = [_row_to_user(row) for row in rows]

    return ApiResponse[UserListResponse](
        success=True,
        data=UserListResponse(total=len(items), items=items),
        error=None,
        timestamp=now_utc(),
    )


@router.post("", response_model=ApiResponse[UserResponse])
async def create_user(
    request: UserCreateRequest,
    http_request: Request,
    authorization: str | None = Header(default=None),
):
    actor = _require_admin(authorization)
    if isinstance(actor, JSONResponse):
        return actor
    usuario_id = current_user_id(http_request)

    nombre = sanitize_string(request.nombre, 100, "nombre")
    email = sanitize_string(request.email, 255, "email").lower()
    if not validate_email(email):
        raise HTTPException(status_code=400, detail="Formato de email inválido")

    now = now_utc()
    with get_engine().begin() as conn:
        if users_repo.email_exists(conn, email):
            return error_response(409, "El correo ya existe")

        resolved_role_id = users_repo.resolve_role_id(conn, request.rol, request.role_id)
        if resolved_role_id is None:
            raise HTTPException(
                status_code=400,
                detail="Rol inválido. Valores permitidos: " + str(users_repo.ROLES_VALIDOS),
            )

        password_hash = bcrypt.hashpw(
            request.password.encode("utf-8"),
            bcrypt.gensalt(rounds=12),
        ).decode("utf-8")

        new_user_id = users_repo.create_user(
            conn,
            nombre=nombre,
            email=email,
            password_hash=password_hash,
            role_id=resolved_role_id,
            area_id=request.area_id,
            debe_cambiar_password=bool(request.password_temporal),
            created_at=now,
        )
        audit_repo.log_audit(
            conn,
            usuario_id=usuario_id,
            accion="CREATE",
            entidad="usuarios",
            entidad_id=new_user_id,
            detalle={"email": email, "role_id": resolved_role_id},
        )
        row = users_repo.fetch_user_row(conn, new_user_id)

    return ApiResponse[UserResponse](
        success=True,
        data=_row_to_user(row),
        error=None,
        timestamp=now,
    )


@router.post("/cambiar-password", response_model=ApiResponse[dict])
async def change_own_password(
    request: SelfPasswordChangeRequest,
    authorization: str | None = Header(default=None),
):
    actor = _get_actor(authorization)
    if not actor:
        return error_response(401, "No autenticado")

    password_hash = bcrypt.hashpw(
        request.password.encode("utf-8"),
        bcrypt.gensalt(rounds=12),
    ).decode("utf-8")

    with get_engine().begin() as conn:
        updated = users_repo.update_password(conn, int(actor["id"]), password_hash, debe_cambiar=False)
        if updated == 0:
            return error_response(404, "Usuario no encontrado")

    return ApiResponse[dict](
        success=True,
        data={"success": True},
        error=None,
        timestamp=now_utc(),
    )


@router.patch("/{user_id}", response_model=ApiResponse[UserResponse])
async def update_user(
    user_id: int = Path(..., gt=0),
    request: UserUpdateRequest = None,
    authorization: str | None = Header(default=None),
):
    actor = _require_admin(authorization)
    if isinstance(actor, JSONResponse):
        return actor
    if request is None:
        return error_response(400, "No hay campos para actualizar")

    incoming = request.dict(exclude_unset=True)
    if not incoming:
        return error_response(400, "No hay campos para actualizar")

    with get_engine().begin() as conn:
        existing = users_repo.fetch_user_row(conn, user_id)
        if not existing or not bool(existing["activo"]):
            return error_response(404, "Usuario no encontrado")

        if "email" in incoming:
            incoming["email"] = sanitize_string(incoming["email"], 255, "email").lower()
            if not validate_email(incoming["email"]):
                raise HTTPException(status_code=400, detail="Formato de email inválido")
            if users_repo.email_exists(conn, incoming["email"], exclude_id=user_id):
                return error_response(409, "El correo ya existe")

        if "nombre" in incoming:
            incoming["nombre"] = sanitize_string(incoming["nombre"], 100, "nombre")

        if "rol" in incoming or "role_id" in incoming:
            resolved_role_id = users_repo.resolve_role_id(
                conn, incoming.get("rol"), incoming.get("role_id")
            )
            if resolved_role_id is None:
                raise HTTPException(
                    status_code=400,
                    detail="Rol inválido. Valores permitidos: " + str(users_repo.ROLES_VALIDOS),
                )
            new_role_name = users_repo.get_role_name(conn, resolved_role_id)
            normalized_new_role = str(new_role_name or "").strip().lower()

            if (
                str(existing["rol"]).strip().lower() == "administrador"
                and normalized_new_role != "administrador"
            ):
                if users_repo.count_active_admins(conn) <= 1:
                    raise HTTPException(
                        status_code=400,
                        detail="No puedes cambiar el rol del único administrador activo",
                    )

            incoming["role_id"] = resolved_role_id
            incoming.pop("rol", None)

        allowed = {"nombre", "email", "role_id", "area_id"}
        updates = {k: v for k, v in incoming.items() if k in allowed}
        if not updates:
            return error_response(400, "No hay campos válidos para actualizar")

        users_repo.update_user(conn, user_id, updates)
        row = users_repo.fetch_user_row(conn, user_id)

    return ApiResponse[UserResponse](
        success=True,
        data=_row_to_user(row),
        error=None,
        timestamp=now_utc(),
    )


@router.post("/{user_id}/password", response_model=ApiResponse[ResetPasswordResponse])
async def reset_password(
    http_request: Request,
    user_id: int = Path(..., gt=0),
    authorization: str | None = Header(default=None),
):
    actor = _require_admin(authorization)
    if isinstance(actor, JSONResponse):
        return actor
    usuario_id = current_user_id(http_request)

    temp_password = _generate_temp_password(8)
    password_hash = bcrypt.hashpw(
        temp_password.encode("utf-8"),
        bcrypt.gensalt(rounds=12),
    ).decode("utf-8")

    with get_engine().begin() as conn:
        updated = users_repo.update_password(conn, user_id, password_hash, debe_cambiar=True)
        if updated == 0:
            return error_response(404, "Usuario no encontrado")
        audit_repo.log_audit(
            conn,
            usuario_id=usuario_id,
            accion="UPDATE",
            entidad="usuarios",
            entidad_id=user_id,
            detalle={"accion": "reset_password"},
        )

    return ApiResponse[ResetPasswordResponse](
        success=True,
        data=ResetPasswordResponse(usuario_id=user_id, password_temporal=temp_password),
        error=None,
        timestamp=now_utc(),
    )


@router.post("/{user_id}/toggle", response_model=ApiResponse[UserResponse])
async def toggle_user(
    http_request: Request,
    user_id: int = Path(..., gt=0),
    authorization: str | None = Header(default=None),
):
    """Activa/desactiva usuario (soft delete reversible)."""
    actor = _require_admin(authorization)
    if isinstance(actor, JSONResponse):
        return actor
    usuario_id = current_user_id(http_request)

    if actor["id"] == user_id:
        return error_response(403, "No puedes desactivarte a ti mismo")

    with get_engine().begin() as conn:
        existing = users_repo.fetch_user_row(conn, user_id)
        if not existing:
            return error_response(404, "Usuario no encontrado")

        nuevo_estado = 0 if existing["activo"] else 1

        # No permitir desactivar al ultimo admin
        if nuevo_estado == 0 and existing["rol"] == "administrador":
            if users_repo.count_active_admins(conn) <= 1:
                return error_response(403, "No puedes desactivar al único administrador activo")

        users_repo.toggle_activo(conn, user_id, nuevo_estado)
        audit_repo.log_audit(
            conn,
            usuario_id=usuario_id,
            accion="UPDATE",
            entidad="usuarios",
            entidad_id=user_id,
            detalle={"activo": nuevo_estado},
        )
        row = users_repo.fetch_user_row(conn, user_id)

    return ApiResponse[UserResponse](
        success=True,
        data=_row_to_user(row),
        error=None,
        timestamp=now_utc(),
    )


@router.delete("/{user_id}", response_model=ApiResponse[dict])
async def soft_delete_user(
    http_request: Request,
    user_id: int = Path(..., gt=0),
    authorization: str | None = Header(default=None),
):
    actor = _require_admin(authorization)
    if isinstance(actor, JSONResponse):
        return actor
    usuario_id = current_user_id(http_request)
    if actor["id"] == user_id:
        return error_response(403, "No puedes eliminarte a ti mismo")

    with get_engine().begin() as conn:
        existing = users_repo.fetch_user_row(conn, user_id)
        if not existing or not bool(existing["activo"]):
            return error_response(404, "Usuario no encontrado")

        if existing["rol"] == "administrador":
            if users_repo.count_active_admins(conn) <= 1:
                return error_response(403, "No puedes eliminar al administrador principal")

        users_repo.soft_delete(conn, user_id)
        audit_repo.log_audit(
            conn,
            usuario_id=usuario_id,
            accion="DELETE",
            entidad="usuarios",
            entidad_id=user_id,
        )

    return ApiResponse[dict](
        success=True,
        data={"deleted": True, "id": user_id},
        error=None,
        timestamp=now_utc(),
    )


@router.post("/{user_id}/unblock", response_model=ApiResponse[UnblockUserResponse])
async def unblock_user(
    http_request: Request,
    user_id: int = Path(..., gt=0),
    authorization: str | None = Header(default=None),
):
    actor = _require_admin(authorization)
    if isinstance(actor, JSONResponse):
        return actor
    usuario_id = current_user_id(http_request)

    now = now_utc()
    with get_engine().begin() as conn:
        updated = users_repo.unblock(conn, user_id)
        if updated == 0:
            return error_response(404, "Usuario no encontrado")
        audit_repo.log_audit(
            conn,
            usuario_id=usuario_id,
            accion="UPDATE",
            entidad="usuarios",
            entidad_id=user_id,
            detalle={"accion": "unblock"},
        )

    return ApiResponse[UnblockUserResponse](
        success=True,
        data=UnblockUserResponse(usuario_id=user_id, desbloqueado_en=now, unblocked=True),
        error=None,
        timestamp=now,
    )
