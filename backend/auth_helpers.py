"""auth_helpers.py — Dependencias de autenticacion para routers."""

import hashlib
from datetime import datetime

import config
from fastapi import HTTPException, Request
from jose import JWTError
from jose import jwt as jose_jwt

from database import get_engine
from repositories import auth_repo


def get_current_user(request: Request) -> dict:
    authorization = request.headers.get("Authorization")
    if not authorization:
        raise HTTPException(status_code=401, detail="No autenticado")

    parts = authorization.split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer" or not parts[1].strip():
        raise HTTPException(status_code=401, detail="No autenticado")

    token = parts[1].strip()

    try:
        payload = jose_jwt.decode(token, config.JWT_SECRET, algorithms=["HS256"])
    except JWTError:
        raise HTTPException(status_code=401, detail="No autenticado")

    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(status_code=401, detail="No autenticado")

    token_hash = hashlib.sha256(token.encode()).hexdigest()
    ahora = datetime.utcnow()

    with get_engine().begin() as conn:
        session_row = auth_repo.validate_session(conn, token_hash, ahora)
        if not session_row:
            raise HTTPException(status_code=401, detail="No autenticado")

        user_row = auth_repo.get_user_by_id_with_role(conn, int(user_id))

    if not user_row:
        raise HTTPException(status_code=401, detail="No autenticado")

    return {
        "user_id": int(user_row["id"]),
        "role": str(user_row["role"]),
        "email": str(user_row["email"]),
    }


def require_role(request: Request, roles: list[str]) -> dict:
    user = get_current_user(request)
    if user["role"] not in roles:
        raise HTTPException(status_code=403, detail="No tienes permisos para esta operación")
    return user


def extract_bearer_token(authorization: str | None) -> str | None:
    if not authorization:
        return None
    parts = authorization.split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer" or not parts[1].strip():
        return None
    return parts[1].strip()


def decode_token(token: str) -> dict | None:
    try:
        return jose_jwt.decode(token, config.JWT_SECRET, algorithms=[config.JWT_ALGORITHM])
    except JWTError:
        return None
