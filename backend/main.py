"""
main.py — Punto de entrada del backend AutoStock.

Inicia FastAPI en 127.0.0.1:8765 (loopback exclusivo).
Tauri lo spawn como sidecar al arrancar la aplicacion de escritorio.
"""

import threading
import time
from contextlib import asynccontextmanager
from datetime import datetime

import bcrypt
import uvicorn
from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from alembic.config import Config
from alembic import command as alembic_command
import os
import config
from database import db, get_engine
from logging_config import setup_file_logger
from middleware import LoggingMiddleware, ErrorHandlerMiddleware
from routers import (
    auth,
    catalogs,
    products,
    movements,
    users,
    purchases,
    proveedores,
    reports,
)
from routers.movements import dashboard_router, importacion_router
from tasks.backup import backup_database

logger = setup_file_logger("autostock")


def seed_default_admin(conn) -> None:
    """Inserta usuario administrador por defecto si no existen usuarios."""
    total_users = conn.execute(text("SELECT COUNT(*) FROM usuarios")).scalar_one()
    if total_users > 0:
        return

    seed_default_catalog(conn)

    role_id = conn.execute(
        text("SELECT id FROM roles WHERE nombre = :nombre LIMIT 1"),
        {"nombre": "administrador"},
    ).scalar_one_or_none()

    if role_id is None:
        conn.execute(
            text("INSERT INTO roles (nombre) VALUES (:nombre)"),
            {"nombre": "administrador"},
        )
        role_id = conn.execute(
            text("SELECT id FROM roles WHERE nombre = :nombre LIMIT 1"),
            {"nombre": "administrador"},
        ).scalar_one()

    password_hash = bcrypt.hashpw(
        "Admin1234".encode("utf-8"),
        bcrypt.gensalt(rounds=12),
    ).decode("utf-8")

    conn.execute(
        text("""
            INSERT INTO usuarios (nombre, email, password_hash, role_id, bloqueado_hasta, activo, created_at)
            VALUES (:nombre, :email, :password_hash, :role_id, :bloqueado_hasta, :activo, :created_at)
            """),
        {
            "nombre": "Administrador",
            "email": "admin@autostock.local",
            "password_hash": password_hash,
            "role_id": role_id,
            "bloqueado_hasta": None,
            "activo": 1,
            "created_at": datetime.utcnow(),
        },
    )


def seed_default_catalog(conn) -> None:
    """Insercion de unidades de medida, areas y categorías iniciales del sistema"""
    unidades = [
        ("Kilogramo", "kg"),
        ("Litro", "L"),
        ("Mililitro", "mL"),
        ("Pieza", "PZA"),
        ("Unidad", "U"),
        ("Caja", "caja"),
        ("Paquete", "paq"),
        ("Gramo", "g"),
        ("Galón", "Gal"),
        ("Docena", "dz"),
        ("Bulto", ""),
    ]

    areas = (
        "Cocina",
        "Almacén general",
        "Barra",
        "Área de limpieza",
        "Área administrativa",
        "Área de mantenimiento",
    )

    categorias = (
        "Productos de limpieza",
        "Materias primas",
        "Bebidas",
        "Almacén general",
        "Equipo",
        "Utensilios",
        "Misceláneos",
    )

    for nombre, abreviacion in unidades:
        conn.execute(
            text(
                "INSERT OR IGNORE INTO unidades_medida (nombre, abreviacion)"
                "VALUES (:nombre, :abreviacion)"
            ),
            {"nombre": nombre, "abreviacion": abreviacion},
        )

    for nombre in areas:
        conn.execute(
            text("INSERT OR IGNORE INTO areas (nombre)" "VALUES (:nombre)"),
            {"nombre": nombre},
        )

    for nombre in categorias:
        conn.execute(
            text("INSERT OR IGNORE INTO categorias (nombre)" "VALUES (:nombre)"),
            {"nombre": nombre},
        )


@asynccontextmanager
async def lifespan(app: FastAPI):
    _alembic_cfg = Config(os.path.join(os.path.dirname(__file__), "alembic.ini"))
    alembic_command.upgrade(_alembic_cfg, "head")

    mode = db.init_wal()
    logger.info(f"SQLite journal_mode = {mode}")

    with get_engine().begin() as conn:
        seed_default_admin(conn)
        roles_requeridos = [
            "administrador",
            "gerente",
            "encargado_area",
            "encargado_compras",
        ]
        for nombre in roles_requeridos:
            conn.execute(
                text("INSERT OR IGNORE INTO roles (nombre) VALUES (:nombre)"),
                {"nombre": nombre},
            )

    def _backup_loop(db_path: str):
        while True:
            time.sleep(24 * 60 * 60)
            try:
                backup_database(db_path)
            except Exception as e:
                logger.error(f"Error en backup: {e}")

    threading.Thread(
        target=_backup_loop,
        args=(config.DATABASE_URL.replace("sqlite:///", ""),),
        daemon=True,
    ).start()

    yield

    db.dispose()


app = FastAPI(
    title="AutoStock Backend",
    version="1.0",
    description=(
        "API REST para el sistema de inventario AutoStock. "
        "Solo accesible desde loopback (127.0.0.1:8765). "
        "100% offline — sin dependencias de red externa."
    ),
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1",
        "http://localhost",
        "http://127.0.0.1:5500",
        "http://localhost:5500",
        "http://127.0.0.1:8765",
        "http://localhost:8765",
        "tauri://localhost",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)
app.add_middleware(ErrorHandlerMiddleware)
app.add_middleware(LoggingMiddleware)


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "data": None,
            "error": exc.detail,
            "timestamp": datetime.utcnow().isoformat(),
        },
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={
            "success": False,
            "data": None,
            "error": "Datos de entrada inválidos",
            "timestamp": datetime.utcnow().isoformat(),
        },
    )


app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(catalogs.router, prefix="/api/catalogos", tags=["catalogos"])
app.include_router(products.router, prefix="/api/productos", tags=["productos"])
app.include_router(movements.router, prefix="/api/movimientos", tags=["movimientos"])
app.include_router(dashboard_router, prefix="/api/dashboard", tags=["dashboard"])
app.include_router(importacion_router, prefix="/api/importacion", tags=["importacion"])
app.include_router(users.router, prefix="/api/usuarios", tags=["usuarios"])
app.include_router(purchases.router, prefix="/api/compras", tags=["compras"])
app.include_router(proveedores.router, prefix="/api/proveedores", tags=["proveedores"])
app.include_router(reports.router, prefix="/api/reportes", tags=["reportes"])
app.include_router(reports.admin_router, prefix="/api/admin", tags=["admin"])


@app.get("/health", tags=["system"])
async def health():
    return {"status": "ok", "version": "1.0"}


if __name__ == "__main__":
    uvicorn.run(
        app,
        host=config.HOST,
        port=config.PORT,
        reload=False,
        log_level="info",
    )
