"""config.py — Configuración central de AutoStock Backend."""

import os

BASE_DIR: str = os.path.dirname(os.path.abspath(__file__))
DEFAULT_DB_PATH: str = os.path.join(BASE_DIR, "database", "autostock.db")
os.makedirs(os.path.dirname(DEFAULT_DB_PATH), exist_ok=True)

# ── Base de datos ─────────────────────────────────────────────────────────────
DATABASE_URL: str = os.getenv(
    "AUTOSTOCK_DB_URL",
    f"sqlite:///{DEFAULT_DB_PATH.replace(os.sep, '/')}",
)

# PRAGMA que activa WAL mode en SQLite (se ejecuta en startup de main.py)
WAL_PRAGMA: str = "PRAGMA journal_mode=WAL"

# ── JWT ───────────────────────────────────────────────────────────────────────
# IMPORTANTE: en producción establece AUTOSTOCK_JWT_SECRET como variable de
# entorno. Si se genera aleatoriamente aquí, todos los tokens quedan inválidos
# cada vez que se reinicia el sidecar.
# PRODUCCIÓN: setear AUTOSTOCK_JWT_SECRET como variable de entorno
JWT_SECRET: str = os.getenv(
    "AUTOSTOCK_JWT_SECRET",
    "autostock-dev-secret-DO-NOT-USE-IN-PRODUCTION-32ch",
)
JWT_ALGORITHM: str = "HS256"
JWT_EXPIRATION_HOURS: int = 8

# ── Servidor ──────────────────────────────────────────────────────────────────
HOST: str = "127.0.0.1"  # ← nunca "0.0.0.0"
PORT: int = 8765
