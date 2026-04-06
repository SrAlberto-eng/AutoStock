"""database.py — Conexion singleton a SQLite con WAL y PRAGMA foreign_keys."""

from sqlalchemy import create_engine, event, text
from sqlalchemy.engine import Engine

import config


class Database:
    """Singleton que administra la conexion a SQLite.

    Garantiza:
      - Un unico engine para toda la aplicacion
      - PRAGMA foreign_keys=ON en cada conexion
      - WAL mode activado al inicializar
    """

    _instance: "Database | None" = None
    _engine: Engine | None = None

    def __new__(cls) -> "Database":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    @property
    def engine(self) -> Engine:
        if self._engine is None:
            self._engine = create_engine(
                config.DATABASE_URL,
                connect_args={"check_same_thread": False},
            )

            @event.listens_for(self._engine, "connect")
            def _set_sqlite_pragma(dbapi_connection, connection_record):
                cursor = dbapi_connection.cursor()
                cursor.execute("PRAGMA foreign_keys=ON")
                cursor.close()

        return self._engine

    def init_wal(self) -> str:
        """Activa WAL mode. Retorna el modo actual."""
        with self.engine.begin() as conn:
            result = conn.execute(text(config.WAL_PRAGMA))
            return result.fetchone()[0]

    def dispose(self) -> None:
        if self._engine is not None:
            self._engine.dispose()
            self._engine = None


db = Database()


def get_engine() -> Engine:
    """Atajo para obtener el engine singleton."""
    return db.engine
