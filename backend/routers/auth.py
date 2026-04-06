"""auth.py — Endpoints de autenticacion: login, logout, perfil."""

import hashlib
import time
from datetime import timedelta

import bcrypt
import config
from fastapi import APIRouter, Header, HTTPException, Request
from fastapi.responses import JSONResponse
from jose import jwt

from auth_helpers import extract_bearer_token, decode_token
from database import get_engine
from http_helpers import error_response
from repositories import auth_repo
from repositories.base import now_utc
from sanitizers import sanitize_string
from schemas import ApiResponse, LoginRequest, LoginResponse, UserProfile

router = APIRouter()

_login_attempts: dict[str, list[float]] = {}


@router.post(
    "/login",
    response_model=ApiResponse[LoginResponse],
    response_model_exclude_none=True,
)
async def login(request: LoginRequest, http_request: Request):
    now = now_utc()

    ip = http_request.client.host if http_request.client else "unknown"
    ahora = time.time()
    _login_attempts[ip] = [t for t in _login_attempts.get(ip, []) if ahora - t < 60]
    if len(_login_attempts[ip]) >= 10:
        return error_response(429, "Demasiados intentos. Espera un minuto.")
    _login_attempts[ip].append(ahora)

    email = sanitize_string(request.email, 255, "email").lower()
    password = str(request.password or "")

    if not password:
        raise HTTPException(status_code=400, detail="password no puede estar vacio")

    engine = get_engine()

    with engine.begin() as conn:
        user_row = auth_repo.find_active_user_by_email(conn, email)

        if user_row:
            bloqueado = user_row["bloqueado_hasta"]
            if isinstance(bloqueado, str):
                from datetime import datetime
                bloqueado = datetime.fromisoformat(bloqueado)
            if bloqueado and bloqueado > now:
                raise HTTPException(
                    status_code=403,
                    detail="Cuenta bloqueada temporalmente. Contacta al administrador.",
                )

        valid_password = False
        if user_row:
            valid_password = bcrypt.checkpw(
                password.encode("utf-8"),
                user_row["password_hash"].encode("utf-8"),
            )

        if not user_row or not valid_password:
            auth_repo.record_login_attempt(conn, email, now)
            recent_attempts = auth_repo.count_recent_attempts(
                conn, email, now - timedelta(minutes=15)
            )

            if user_row and recent_attempts > 5:
                auth_repo.lock_user(conn, user_row["id"], now + timedelta(minutes=15))
                return error_response(
                    403,
                    "Cuenta bloqueada temporalmente. Contacta al administrador.",
                )

            return error_response(401, "Credenciales incorrectas")

        auth_repo.clear_login_attempts(conn, email)

        exp_dt = now + timedelta(hours=8)
        must_change_password = bool(user_row.get("debe_cambiar_password"))
        payload = {
            "sub": str(user_row["id"]),
            "role": user_row["role"],
            "exp": exp_dt,
        }

        token = jwt.encode(payload, config.JWT_SECRET, algorithm=config.JWT_ALGORITHM)
        token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()

        auth_repo.create_session(conn, user_row["id"], token_hash, exp_dt)

    login_data = {
        "token": token,
        "role": user_row["role"],
        "expires_at": int(exp_dt.timestamp()),
        "user_id": user_row["id"],
        "nombre": user_row["nombre"],
    }
    if must_change_password:
        login_data["debe_cambiar_password"] = True

    return ApiResponse[LoginResponse](
        success=True,
        data=LoginResponse(**login_data),
        error=None,
        timestamp=now,
    )


@router.post("/logout", response_model=ApiResponse[dict])
async def logout(authorization: str | None = Header(default=None)):
    token = extract_bearer_token(authorization)
    if not token:
        return error_response(401, "No autenticado")

    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()

    with get_engine().begin() as conn:
        auth_repo.revoke_session(conn, token_hash)

    return ApiResponse[dict](
        success=True,
        data={"mensaje": "Sesion cerrada correctamente"},
        error=None,
        timestamp=now_utc(),
    )


@router.get("/me", response_model=ApiResponse[UserProfile])
async def get_current_user(authorization: str | None = Header(default=None)):
    token = extract_bearer_token(authorization)
    if not token:
        return error_response(401, "No autenticado")

    payload = decode_token(token)
    if not payload or "sub" not in payload:
        return error_response(401, "No autenticado")

    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    now = now_utc()

    with get_engine().begin() as conn:
        session_row = auth_repo.validate_session(conn, token_hash, now)
        if not session_row:
            return error_response(401, "No autenticado")

        user_row = auth_repo.get_user_profile(conn, int(payload["sub"]))
        if not user_row:
            return error_response(401, "No autenticado")

    return ApiResponse[UserProfile](
        success=True,
        data=UserProfile(
            id=user_row["id"],
            nombre=user_row["nombre"],
            email=user_row["email"],
            role=user_row["role"],
            activo=bool(user_row["activo"]),
        ),
        error=None,
        timestamp=now,
    )
