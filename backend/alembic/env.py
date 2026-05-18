"""
env.py — Entorno de Alembic para migraciones de AutoStock.

Para crear una nueva migración:
    cd backend/
    alembic revision --autogenerate -m "descripcion"

Para aplicar migraciones:
    alembic upgrade head

Para revertir:
    alembic downgrade -1
"""

import sys
import os
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool
from alembic import context

# Añadir backend/ al path para importar config y models.
# En modo frozen (PyInstaller) usamos sys._MEIPASS directamente; en dev,
# calculamos la ruta desde __file__.
if getattr(sys, 'frozen', False) and hasattr(sys, '_MEIPASS'):
    if sys._MEIPASS not in sys.path:
        sys.path.insert(0, sys._MEIPASS)
else:
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import config as app_config  # noqa: E402

# target_metadata solo es necesario para --autogenerate (desarrollo).
# En modo frozen solo ejecutamos 'upgrade head' con scripts pre-escritos,
# por lo que None es válido si el import falla por aislamiento del SourceFileLoader.
try:
    from models import metadata  # noqa: E402
    target_metadata = metadata
except ImportError:
    if not (getattr(sys, 'frozen', False) and hasattr(sys, '_MEIPASS')):
        raise
    target_metadata = None

# Configuración de Alembic desde alembic.ini
alembic_config = context.config

if alembic_config.config_file_name is not None:
    fileConfig(alembic_config.config_file_name)

# Sobreescribir URL con la de la aplicación (respeta AUTOSTOCK_DB_URL y modo frozen)
alembic_config.set_main_option("sqlalchemy.url", app_config.DATABASE_URL)


def run_migrations_offline() -> None:
    """Modo offline: genera SQL sin conexión activa (útil para revisión)."""
    url = alembic_config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Modo online: aplica migraciones con conexión activa."""
    connectable = engine_from_config(
        alembic_config.get_section(alembic_config.config_ini_section),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
