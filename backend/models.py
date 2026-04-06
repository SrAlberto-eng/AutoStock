"""
models.py — Definicion de tablas con SQLAlchemy Core.

Schema v2: 11 entidades (lista_compras eliminada).

Cambios respecto a v1:
  - Eliminado: sku de productos, revertido_por/revertido_en de movimientos, tabla lista_compras
  - Agregado: area_id en movimientos, CHECK constraints en movimientos/auditoria
  - Corregido: UNIQUE en unidades_medida.nombre, proveedores.nombre, sesiones.token_hash
  - Corregido: auditoria.entidad_id ahora NULLABLE
  - Corregido: productos.estado default 'Agotado'
  - Agregado: indices compuestos obligatorios
"""

from sqlalchemy import (
    MetaData,
    Table,
    Column,
    Integer,
    Text,
    DateTime,
    Float,
    ForeignKey,
    CheckConstraint,
    Index,
)
from datetime import datetime

metadata = MetaData()

# ---------------------------------------------------------------------------
# Entidades base (sin FK entrada)
# ---------------------------------------------------------------------------

roles = Table(
    "roles",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("nombre", Text, nullable=False, unique=True),
)

categorias = Table(
    "categorias",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("nombre", Text, nullable=False, unique=True),
)

areas = Table(
    "areas",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("nombre", Text, nullable=False, unique=True),
)

unidades_medida = Table(
    "unidades_medida",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("nombre", Text, nullable=False, unique=True),
    Column("abreviacion", Text, nullable=False),
)

proveedores = Table(
    "proveedores",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("nombre", Text, nullable=False, unique=True),
    Column("activo", Integer, nullable=False, server_default="1"),
)

# ---------------------------------------------------------------------------
# Usuarios y Sesiones
# ---------------------------------------------------------------------------

usuarios = Table(
    "usuarios",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("nombre", Text, nullable=False),
    Column("email", Text, nullable=False, unique=True),
    Column("password_hash", Text, nullable=False),
    Column(
        "role_id",
        Integer,
        ForeignKey("roles.id", ondelete="RESTRICT"),
        nullable=False,
    ),
    Column(
        "area_id",
        Integer,
        ForeignKey("areas.id", ondelete="SET NULL"),
        nullable=True,
    ),
    Column("bloqueado_hasta", DateTime, nullable=True),
    Column("activo", Integer, nullable=False, server_default="1"),
    Column("debe_cambiar_password", Integer, nullable=False, server_default="0"),
    Column("created_at", DateTime, nullable=False, default=datetime.utcnow),
    Index("idx_usuarios_email", "email", unique=True),
)

sesiones = Table(
    "sesiones",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column(
        "usuario_id",
        Integer,
        ForeignKey("usuarios.id", ondelete="CASCADE"),
        nullable=False,
    ),
    Column("token_hash", Text, nullable=False, unique=True),
    Column("expira_en", DateTime, nullable=False),
    Index("idx_sesiones_token_hash", "token_hash", unique=True),
)

login_attempts = Table(
    "login_attempts",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("email", Text, nullable=False),
    Column("timestamp", DateTime, nullable=False, default=datetime.utcnow),
    Index("idx_login_attempts_email_timestamp", "email", "timestamp"),
)

# ---------------------------------------------------------------------------
# Productos
# ---------------------------------------------------------------------------

productos = Table(
    "productos",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("nombre", Text, nullable=False),
    Column(
        "categoria_id",
        Integer,
        ForeignKey("categorias.id", ondelete="RESTRICT"),
        nullable=False,
    ),
    Column(
        "area_id",
        Integer,
        ForeignKey("areas.id", ondelete="RESTRICT"),
        nullable=False,
    ),
    Column(
        "unidad_id",
        Integer,
        ForeignKey("unidades_medida.id", ondelete="RESTRICT"),
        nullable=False,
    ),
    Column(
        "proveedor_id",
        Integer,
        ForeignKey("proveedores.id", ondelete="SET NULL"),
        nullable=True,
    ),
    Column("stock_actual", Float, nullable=False, server_default="0"),
    Column("stock_min", Float, nullable=False, server_default="0"),
    Column("stock_max", Float, nullable=False, server_default="0"),
    Column("estado", Text, nullable=False, server_default="Agotado"),
    Column("activo", Integer, nullable=False, server_default="1"),
    Column("created_at", DateTime, nullable=False, default=datetime.utcnow),
    CheckConstraint("stock_actual >= 0", name="ck_productos_stock_actual_non_negative"),
    Index("idx_productos_nombre", "nombre"),
)

# ---------------------------------------------------------------------------
# Movimientos
# ---------------------------------------------------------------------------

movimientos = Table(
    "movimientos",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("tipo", Text, nullable=False),
    Column(
        "producto_id",
        Integer,
        ForeignKey("productos.id", ondelete="RESTRICT"),
        nullable=False,
    ),
    Column(
        "area_id",
        Integer,
        ForeignKey("areas.id", ondelete="SET NULL"),
        nullable=True,
    ),
    Column("cantidad", Float, nullable=False),
    Column("fecha_sistema", DateTime, nullable=False, default=datetime.utcnow),
    Column(
        "usuario_id",
        Integer,
        ForeignKey("usuarios.id", ondelete="SET NULL"),
        nullable=True,
    ),
    Column("motivo", Text, nullable=True),
    Column("revertido", Integer, nullable=False, server_default="0"),
    CheckConstraint("tipo IN ('entrada','salida','merma')", name="ck_movimientos_tipo"),
    CheckConstraint("cantidad > 0", name="ck_movimientos_cantidad_positive"),
    Index("idx_movimientos_producto_fecha", "producto_id", "fecha_sistema"),
    Index("idx_movimientos_area_id", "area_id"),
)

# ---------------------------------------------------------------------------
# Auditoria
# ---------------------------------------------------------------------------

auditoria = Table(
    "auditoria",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column(
        "usuario_id",
        Integer,
        ForeignKey("usuarios.id", ondelete="SET NULL"),
        nullable=True,
    ),
    Column("accion", Text, nullable=False),
    Column("entidad", Text, nullable=False),
    Column("entidad_id", Integer, nullable=True),
    Column("fecha", DateTime, nullable=False, default=datetime.utcnow),
    Column("detalle_json", Text, nullable=True),
    CheckConstraint(
        "accion IN ('CREATE','UPDATE','DELETE','LOGIN','LOGOUT')",
        name="ck_auditoria_accion",
    ),
    CheckConstraint(
        "entidad IN ('usuarios','productos','movimientos','categorias','areas','unidades','proveedores','sesiones')",
        name="ck_auditoria_entidad",
    ),
    Index("idx_auditoria_entidad_entidad_id", "entidad", "entidad_id"),
)
