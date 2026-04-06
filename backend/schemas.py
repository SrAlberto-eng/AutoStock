"""
schemas.py — Modelos Pydantic para validación y documentación OpenAPI.

Contiene todas las estructuras de request/response de los endpoints.
Organizados por dominio con campos estrictamente tipados.
"""

from datetime import datetime
from typing import Optional, List, Any, Generic, TypeVar
from pydantic import BaseModel, Field


# ─────────────────────────────────────────────────────────────────────────────
# Response Wrapper (estándar para todos los endpoints)
# ─────────────────────────────────────────────────────────────────────────────

T = TypeVar("T")


class ApiResponse(BaseModel, Generic[T]):
    """
    Envoltorio estándar para todas las respuestas API.
    
    Ejemplo:
        {
            "success": true,
            "data": {...},
            "error": null,
            "timestamp": "2026-03-12T10:30:45.123456Z"
        }
    """

    success: bool
    data: Optional[T] = None
    error: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}


# ─────────────────────────────────────────────────────────────────────────────
# AUTH SCHEMAS
# ─────────────────────────────────────────────────────────────────────────────


class LoginRequest(BaseModel):
    """Request body para POST /api/auth/login"""

    email: str = Field(..., min_length=3, max_length=100, example="usuario@example.com")
    password: str = Field(..., min_length=1, example="micontraseña123")


class LoginResponse(BaseModel):
    """Response body para POST /api/auth/login"""

    token: str = Field(..., example="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...")
    role: str = Field(..., example="gerente")
    expires_at: int = Field(..., example=1773356400)
    user_id: int = Field(..., example=1)
    nombre: str = Field(..., example="Juan Pérez")
    debe_cambiar_password: Optional[bool] = Field(default=None, example=True)


class UserProfile(BaseModel):
    """Response para GET /api/auth/me"""

    id: int
    nombre: str
    email: str
    role: str
    activo: bool


# ─────────────────────────────────────────────────────────────────────────────
# CATALOGS SCHEMAS
# ─────────────────────────────────────────────────────────────────────────────


class CatalogItemBase(BaseModel):
    """Base para items de catálogos (categorías, áreas, unidades)"""

    nombre: str = Field(..., min_length=1, max_length=100)


class CatalogItemCreate(CatalogItemBase):
    """Request para crear item de catálogo"""

    pass


class CatalogItem(CatalogItemBase):
    """Response para item de catálogo"""

    id: int

    class Config:
        from_attributes = True


class UnidadMedidaCreate(BaseModel):
    """Request para crear unidad de medida"""

    nombre: str = Field(..., min_length=1, max_length=50)
    abreviacion: str = Field(..., min_length=1, max_length=10)


class UnidadMedidaUpdate(BaseModel):
    """Request para PATCH unidad de medida"""

    nombre: Optional[str] = Field(None, min_length=1, max_length=50)
    abreviacion: Optional[str] = Field(None, min_length=1, max_length=10)


class UnidadMedida(UnidadMedidaCreate):
    """Response para unidad de medida"""

    id: int

    class Config:
        from_attributes = True


class CatalogList(BaseModel):
    """Response para GET /api/catalogos/{tipo}"""

    total: int = Field(..., example=5)
    items: List[CatalogItem] = Field(default_factory=list)


# ─────────────────────────────────────────────────────────────────────────────
# PRODUCTS SCHEMAS
# ─────────────────────────────────────────────────────────────────────────────


class ProductCreateRequest(BaseModel):
    """Request para POST /api/productos"""

    nombre: str = Field(..., min_length=1, max_length=100, example="Tuerca M8")
    categoria_id: int = Field(..., example=1)
    area_id: int = Field(..., example=2)
    unidad_id: int = Field(..., example=3)
    proveedor_id: Optional[int] = Field(None, example=1)
    stock_actual: float = Field(default=0, ge=0, example=0)
    stock_min: float = Field(default=10, example=10)
    stock_max: float = Field(default=100, example=100)


class ProductUpdateRequest(BaseModel):
    """Request para PATCH /api/productos/{id}"""

    nombre: Optional[str] = Field(None, max_length=100)
    categoria_id: Optional[int] = None
    area_id: Optional[int] = None
    unidad_id: Optional[int] = None
    proveedor_id: Optional[int] = None
    stock_min: Optional[float] = None
    stock_max: Optional[float] = None


class ProductResponse(BaseModel):
    """Response para producto individual"""

    id: int
    nombre: str
    categoria_id: int
    area_id: int
    unidad_id: int
    proveedor_id: Optional[int]
    stock_actual: float
    stock_min: float
    stock_max: float
    estado: str = Field(..., example="Disponible")
    activo: bool
    created_at: datetime

    class Config:
        from_attributes = True


class ProductListResponse(BaseModel):
    """Response para GET /api/productos"""

    total: int
    items: List[ProductResponse]
    filters_applied: dict = Field(default_factory=dict)


class ProductDetailResponse(BaseModel):
    """Response para GET /api/productos/{id}"""

    producto: ProductResponse
    historial_movimientos: List[dict] = Field(default_factory=list)


class BulkProductCreateRequest(BaseModel):
    """Request para POST /api/productos/bulk"""

    productos: List[ProductCreateRequest]


class BulkProductCreateResponse(BaseModel):
    """Response para POST /api/productos/bulk"""

    creados: int
    fallidos: int
    detalles: List[dict] = Field(default_factory=list)


# ─────────────────────────────────────────────────────────────────────────────
# MOVEMENTS SCHEMAS
# ─────────────────────────────────────────────────────────────────────────────


class MovementLineItem(BaseModel):
    """Item individual en una entrada/salida/merma"""

    producto_id: int = Field(..., example=1)
    cantidad: float = Field(..., gt=0, example=10.5)
    motivo: Optional[str] = Field(None, max_length=255)


class MovementCreateRequest(BaseModel):
    """Request para POST /api/movimientos"""

    tipo: str = Field(..., example="entrada", pattern="^(entrada|salida|merma)$")
    items: List[MovementLineItem]
    area_id: Optional[int] = Field(None, description="Requerido para salidas")
    motivo_general: Optional[str] = Field(None, max_length=255)


class MovementResponse(BaseModel):
    """Response para movimiento individual"""

    id: int
    tipo: str
    producto_id: int
    producto_nombre: Optional[str] = None
    cantidad: float
    fecha_sistema: datetime
    usuario_id: Optional[int]
    motivo: Optional[str]
    revertido: bool

    class Config:
        from_attributes = True


class MovementListResponse(BaseModel):
    """Response para GET /api/movimientos"""

    total: int
    items: List[MovementResponse]
    filters_applied: dict = Field(default_factory=dict)


class ProductMatch(BaseModel):
    """Match individual en importación XML"""

    producto_id: int
    nombre_bd: str
    confianza: float = Field(..., ge=0.0, le=1.0)


class ImportLineaPreview(BaseModel):
    """Preview de línea de factura en XML"""

    numero_linea: int
    nombre_factura: str
    cantidad: float
    matches: List[ProductMatch] = Field(default_factory=list)


class ImportacionPreviewResponse(BaseModel):
    """Response para POST /api/importacion/preview"""

    total_lineas: int
    lineas: List[ImportLineaPreview]


class RevertMovementResponse(BaseModel):
    """Response para POST /api/movimientos/{id}/revertir"""

    movimiento_original_id: int
    movimiento_reversion_id: int
    cantidad_revertida: float
    fecha_reversion: datetime


class DashboardResumenResponse(BaseModel):
    """Response para GET /api/dashboard/resumen"""

    entradas_hoy: int = Field(default=0, example=5)
    salidas_hoy: int = Field(default=0, example=3)
    mermas_hoy: int = Field(default=0, example=1)
    productos_bajo_minimo: int = Field(default=0, example=2)
    productos_agotados: int = Field(default=0, example=0)
    lista_bajo_minimo: list[dict] = Field(default_factory=list)
    lista_agotados: list[dict] = Field(default_factory=list)


# ─────────────────────────────────────────────────────────────────────────────
# PROVEEDORES SCHEMAS
# ─────────────────────────────────────────────────────────────────────────────


class ProveedorCreateRequest(BaseModel):
    """Request para POST /api/proveedores"""

    nombre: str = Field(..., min_length=1, max_length=100)


class ProveedorUpdateRequest(BaseModel):
    """Request para PATCH /api/proveedores/{id}"""

    nombre: Optional[str] = Field(None, min_length=1, max_length=100)


class ProveedorResponse(BaseModel):
    """Response para proveedor individual"""

    id: int
    nombre: str
    activo: bool
    productos_asociados: int = 0


class ProveedorListResponse(BaseModel):
    """Response para GET /api/proveedores"""

    total: int
    items: List[ProveedorResponse]


# ─────────────────────────────────────────────────────────────────────────────
# PURCHASES SCHEMAS
# ─────────────────────────────────────────────────────────────────────────────


class PurchaseLineItemResponse(BaseModel):
    """Item de lista de compras"""

    id: int
    producto_id: int
    nombre_producto: str
    cantidad_sugerida: float
    cantidad_ajustada: Optional[float]
    generada_en: Optional[datetime] = None
    categoria_nombre: Optional[str] = None
    area_nombre: Optional[str] = None
    unidad_nombre: Optional[str] = None
    proveedor_nombre: Optional[str] = None
    stock_actual: Optional[float] = None
    stock_min: Optional[float] = None


class PurchaseListResponse(BaseModel):
    """Response para GET /api/compras"""

    total: int
    items: List[PurchaseLineItemResponse]
    generada_en: Optional[datetime]
    exportada: bool = False


class GenerarListaComprasRequest(BaseModel):
    """Request para POST /api/compras/generar"""

    umbral_minimo: Optional[float] = Field(None, description="Stock mín. para incluir")


class GenerarListaComprasResponse(BaseModel):
    """Response para POST /api/compras/generar"""

    items_generados: int
    fecha_generacion: datetime
    generados: int = 0
    items: List[PurchaseLineItemResponse] = Field(default_factory=list)


class ExportPurchaseListResponse(BaseModel):
    """Response para GET /api/compras/export"""

    items: List[PurchaseLineItemResponse] = Field(default_factory=list)
    fecha_exportacion: datetime
    usuario: Optional[str] = None


class ActualizarCompraRequest(BaseModel):
    """Request para PATCH /api/compras/{id}"""

    cantidad_ajustada: float = Field(..., gt=0)


# ─────────────────────────────────────────────────────────────────────────────
# USERS SCHEMAS
# ─────────────────────────────────────────────────────────────────────────────


class UserCreateRequest(BaseModel):
    """Request para POST /api/usuarios"""

    nombre: str = Field(..., min_length=1, max_length=100)
    email: str
    password: str = Field(..., min_length=6, max_length=255)
    role_id: Optional[int] = None
    rol: Optional[str] = Field(None, max_length=50)
    area_id: Optional[int] = None
    password_temporal: Optional[bool] = False


class UserUpdateRequest(BaseModel):
    """Request para PATCH /api/usuarios/{id}"""

    nombre: Optional[str] = Field(None, max_length=100)
    email: Optional[str] = None
    role_id: Optional[int] = None
    rol: Optional[str] = Field(None, max_length=50)
    area_id: Optional[int] = None


class UserResponse(BaseModel):
    """Response para usuario individual"""

    id: int
    nombre: str
    email: str
    role_id: int
    rol: str
    area_id: Optional[int]
    area_nombre: Optional[str] = None
    bloqueado_hasta: Optional[datetime]
    debe_cambiar_password: bool = False
    activo: bool
    created_at: datetime

    class Config:
        from_attributes = True


class UserListResponse(BaseModel):
    """Response para GET /api/usuarios"""

    total: int
    items: List[UserResponse]


class ResetPasswordRequest(BaseModel):
    """Request para POST /api/usuarios/{id}/password"""

    nueva_password: str = Field(..., min_length=6, max_length=255)


class ResetPasswordResponse(BaseModel):
    """Response para POST /api/usuarios/{id}/password"""

    usuario_id: int
    password_temporal: str


class SelfPasswordChangeRequest(BaseModel):
    """Request para POST /api/usuarios/cambiar-password"""

    password: str = Field(..., min_length=6, max_length=255)


class UnblockUserResponse(BaseModel):
    """Response para POST /api/usuarios/{id}/unblock"""

    usuario_id: int
    desbloqueado_en: datetime
    unblocked: bool = True


# ─────────────────────────────────────────────────────────────────────────────
# REPORTS SCHEMAS
# ─────────────────────────────────────────────────────────────────────────────


class AuditLogEntry(BaseModel):
    """Entrada individual en el registro de auditoría"""

    id: int
    usuario_id: Optional[int]
    usuario_nombre: Optional[str]
    accion: str = Field(..., example="CREATE")
    entidad: str = Field(..., example="productos")
    entidad_id: Optional[int]
    fecha: datetime
    detalle_json: Optional[dict]


class AuditLogResponse(BaseModel):
    """Response para GET /api/reportes/audit-log"""

    total: int
    items: List[AuditLogEntry]
    filters_applied: dict = Field(default_factory=dict)


class MovementReportItem(BaseModel):
    """Fila de reporte de movimientos con nombres enriquecidos."""

    id: int
    tipo: str
    producto_nombre: str
    cantidad: float
    fecha_sistema: datetime
    usuario_nombre: Optional[str] = None
    motivo: Optional[str] = None
    revertido: bool


class MovementReportResponse(BaseModel):
    """Response para GET /api/reportes/movimientos"""

    items: List[MovementReportItem]
    total: int
    pagina: int
