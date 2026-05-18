# -*- mode: python ; coding: utf-8 -*-
"""
backend.spec — PyInstaller spec para AutoStock Backend.

Modo:   --onedir (más rápido en arranque que --onefile)
Salida: dist/autostock-backend/autostock-backend.exe

Uso:
    cd backend
    pyinstaller backend.spec
"""

from pathlib import Path

BACKEND_DIR = Path(SPECPATH)  # SPECPATH = directorio del .spec = backend/

a = Analysis(
    [str(BACKEND_DIR / "main.py")],
    pathex=[str(BACKEND_DIR)],
    binaries=[],
    datas=[
        # Carpeta de migraciones (aterriza en _MEIPASS/alembic/)
        (str(BACKEND_DIR / "alembic"),     "alembic"),
        # alembic.ini en la raíz del bundle (_MEIPASS/alembic.ini)
        (str(BACKEND_DIR / "alembic.ini"), "."),
    ],
    hiddenimports=[
        # ── Módulos locales del backend (cargados dinámicamente por Alembic/uvicorn) ──
        "config",
        "models",
        "database",
        "schemas",
        "auth_helpers",
        "http_helpers",
        "sanitizers",
        "validators",
        "middleware",
        "logging_config",
        "tasks",
        "tasks.backup",
        "repositories",
        "repositories.base",
        "repositories.auth_repo",
        "repositories.audit_repo",
        "repositories.users_repo",
        "repositories.products_repo",
        "repositories.movements_repo",
        "repositories.catalogs_repo",
        "repositories.proveedores_repo",
        "repositories.purchases_repo",
        "repositories.reports_repo",
        "repositories.facturas_repo",
        "routers",
        "routers.auth",
        "routers.users",
        "routers.products",
        "routers.movements",
        "routers.catalogs",
        "routers.proveedores",
        "routers.purchases",
        "routers.reports",
        "routers.facturas",
        # python-jose
        "jose",
        "jose.jwt",
        "jose.exceptions",
        "jose.backends",
        "jose.backends.cryptography_backend",
        # bcrypt (el hook hook-bcrypt.py resuelve la extensión C automáticamente)
        "bcrypt",
        # pydantic v2
        "pydantic",
        "pydantic_core",
        "pydantic_core._pydantic_core",
        "pydantic.deprecated.class_validators",
        "pydantic.deprecated.config",
        "pydantic.deprecated.tools",
        # alembic internals
        "alembic",
        "alembic.config",
        "alembic.command",
        "alembic.runtime.migration",
        "alembic.runtime.environment",
        "alembic.operations",
        "alembic.operations.ops",
        "alembic.operations.base",
        "alembic.autogenerate",
        "alembic.script",
        "alembic.ddl",
        "alembic.ddl.impl",
        # SQLAlchemy
        "sqlalchemy.dialects.sqlite",
        "sqlalchemy.dialects.sqlite.pysqlite",
        # uvicorn
        "uvicorn.logging",
        "uvicorn.loops",
        "uvicorn.loops.auto",
        "uvicorn.loops.asyncio",
        "uvicorn.protocols",
        "uvicorn.protocols.http",
        "uvicorn.protocols.http.auto",
        "uvicorn.protocols.http.h11_impl",
        "uvicorn.protocols.websockets",
        "uvicorn.protocols.websockets.auto",
        "uvicorn.lifespan",
        "uvicorn.lifespan.on",
        # email-validator (pydantic EmailStr)
        "email_validator",
        # Mako (requerido por alembic script templates)
        "mako",
        "mako.template",
        # cryptography (backend de jose)
        "cryptography",
        "cryptography.hazmat.primitives",
        "cryptography.hazmat.backends",
        # starlette
        "starlette.routing",
        "starlette.middleware",
        "starlette.middleware.base",
        # anyio
        "anyio",
        "anyio._backends._asyncio",
    ],
    excludes=[
        "pytest", "IPython", "jupyter",
        # Drivers opcionales que PyInstaller busca pero no están instalados
        "pysqlite2",   # driver alternativo SQLite (hook-sqlalchemy.py)
        "MySQLdb",     # driver MySQL (hook-sqlalchemy.py)
        "tzdata",      # datos de timezone opcionales (hook-zoneinfo.py)
    ],
    hookspath=[],
    runtime_hooks=[],
    cipher=None,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=None)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,       # onedir: DLLs van separadas
    name="autostock-backend",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,                   # UPX desactivado (no requiere instalación)
    console=False,
    disable_windowed_traceback=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=False,
    name="autostock-backend",    # → dist/autostock-backend/
)
