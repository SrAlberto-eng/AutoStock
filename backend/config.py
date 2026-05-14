"""config.py — Configuración central de AutoStock Backend."""

import os
import sys


def _is_frozen() -> bool:
    return getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS")


# BASE_DIR: solo lectura. Apunta a recursos bundleados (alembic/, alembic.ini).
# En modo frozen = sys._MEIPASS (donde PyInstaller extrae los datos).
BASE_DIR: str = sys._MEIPASS if _is_frozen() else os.path.dirname(os.path.abspath(__file__))

# APP_DATA_DIR: escritura (DB, logs, backups).
# En modo frozen: %APPDATA%\AutoStock\
# En modo dev:    backend/ (mismo directorio del script)
if _is_frozen():
    _appdata = os.environ.get("APPDATA", os.path.expanduser("~"))
    APP_DATA_DIR: str = os.path.join(_appdata, "AutoStock")
else:
    APP_DATA_DIR: str = os.path.dirname(os.path.abspath(__file__))

os.makedirs(APP_DATA_DIR, exist_ok=True)

# ── Base de datos ─────────────────────────────────────────────────────────────
_db_dir = os.path.join(APP_DATA_DIR, "database")
os.makedirs(_db_dir, exist_ok=True)

DEFAULT_DB_PATH: str = os.path.join(_db_dir, "autostock.db")

DATABASE_URL: str = os.getenv(
    "AUTOSTOCK_DB_URL",
    f"sqlite:///{DEFAULT_DB_PATH.replace(os.sep, '/')}",
)

# ── Rutas de runtime (siempre absolutas, válidas en frozen y dev) ─────────────
BACKUP_DIR: str = os.path.join(APP_DATA_DIR, "backups")
LOG_DIR: str    = os.path.join(APP_DATA_DIR, "logs")

os.makedirs(BACKUP_DIR, exist_ok=True)
os.makedirs(LOG_DIR,    exist_ok=True)

# ── SQLite ────────────────────────────────────────────────────────────────────
WAL_PRAGMA: str = "PRAGMA journal_mode=WAL"

# ── JWT ───────────────────────────────────────────────────────────────────────
# IMPORTANTE: en producción establece AUTOSTOCK_JWT_SECRET como variable de
# entorno. Si se genera aleatoriamente aquí, todos los tokens quedan inválidos
# cada vez que se reinicia el sidecar.
JWT_SECRET: str = os.getenv(
    "AUTOSTOCK_JWT_SECRET",
    "autostock-dev-secret-DO-NOT-USE-IN-PRODUCTION-32ch",
)
JWT_ALGORITHM: str = "HS256"
JWT_EXPIRATION_HOURS: int = 8

# ── Servidor ──────────────────────────────────────────────────────────────────
HOST: str = "127.0.0.1"  # ← nunca "0.0.0.0"
PORT: int = 8765
