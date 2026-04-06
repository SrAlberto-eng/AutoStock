# AutoStock - Release Notes v1.0.0

## Modulos incluidos en el MVP
- Autenticacion: login con JWT, sesiones y control basico de acceso por rol.
- Dashboard: indicadores de estado general y alertas de inventario.
- Inventario/Productos: CRUD de productos con estados de stock calculados.
- Movimientos: registro de entradas, salidas y mermas con validaciones operativas.
- Catalogos: administracion de categorias, areas y unidades de medida.
- Usuarios: alta, edicion, baja logica y reseteo de contrasena por administrador.
- Compras: generacion automatica de lista segun stock minimo y ajuste de cantidades.
- Reportes: consulta de movimientos y auditoria de eventos del sistema.
- Backups: respaldo manual y programado de base de datos.

## Stack tecnico

| Capa | Tecnologia |
| --- | --- |
| Frontend | HTML, CSS, JavaScript vanilla |
| Backend | Python 3 + FastAPI |
| BD | SQLite + SQLAlchemy Core |
| Auth | JWT (python-jose) + sesiones persistidas |
| Deployment | Ejecucion local (loopback 127.0.0.1) |

## Decisiones de diseno
1. Backend local en loopback para reducir superficie de ataque y simplificar despliegue.
2. SQLite como base del MVP por portabilidad y costo operativo bajo.
3. Modelo de roles simple para cubrir permisos criticos sin complejidad excesiva.
4. Auditoria de acciones clave para trazabilidad de cambios y cumplimiento operativo.
5. Lista de compras derivada de umbrales de stock para priorizar reposicion automatica.

## Limitaciones conocidas
- Sin sincronizacion multi-sede ni replicacion remota.
- Exportaciones y reportes pueden crecer en tiempo con volumen alto de datos.
- Rate limiting de login en memoria de proceso (no distribuido).
- No incluye recuperacion de contrasena por correo en el MVP.
- Control de permisos puede refinarse por accion granular en futuras versiones.

## Instalacion desde cero

### Requisitos
- Python 3.11+
- Navegador moderno
- Live Server (VS Code) o servidor HTTP local

### Pasos
1. Clonar el repositorio
2. `pip install -r backend/requirements.txt`
3. `cd backend && alembic upgrade head`
4. `python backend/main.py`
5. Abrir frontend con Live Server
6. Login: admin@autostock.local / Admin1234

### Reset de datos (demo/entrega)
`python backend/scripts/reset_db.py`