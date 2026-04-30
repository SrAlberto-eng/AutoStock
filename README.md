# AutoStock

Sistema de inventario offline para restaurante/bar con backend en FastAPI + SQLite y frontend en HTML/CSS/JS vanilla.

## Tabla de contenido

- [Vision general](#vision-general)
- [Stack tecnologico](#stack-tecnologico)
- [Arquitectura](#arquitectura)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Que hace cada modulo](#que-hace-cada-modulo)
- [Requisitos](#requisitos)
- [Clonar repositorio](#clonar-repositorio)
- [Configuracion de entorno](#configuracion-de-entorno)
- [Como ejecutar](#como-ejecutar)
- [Pruebas](#pruebas)
- [Resumen de API](#resumen-de-api)
- [Seguridad y runtime](#seguridad-y-runtime)
- [Estado actual y pendientes](#estado-actual-y-pendientes)
- [Problemas comunes](#problemas-comunes)

## Vision general

AutoStock gestiona productos, catalogos, movimientos de inventario (entrada/salida/merma), proveedores, lista de compras calculada en tiempo real, usuarios por rol y auditoria de acciones.

Objetivo principal: operar localmente, sin dependencias externas de red, con trazabilidad de cambios.

## Stack tecnologico

| Capa | Tecnologia |
| --- | --- |
| Backend | Python 3.11+, FastAPI, Uvicorn |
| Datos | SQLite (WAL) + SQLAlchemy Core |
| Migraciones | Alembic |
| Auth | JWT (python-jose) + bcrypt |
| Validacion | Pydantic v2 |
| Frontend | HTML5, CSS3, JavaScript ES6 (sin framework) |
| Testing | pytest |

## Arquitectura

Patron principal en backend:

1. Router recibe request HTTP.
2. Se valida auth/rol.
3. Repository ejecuta operaciones SQL.
4. Se regresa respuesta estandar `ApiResponse`.

La base de datos usa singleton de conexion y activa `PRAGMA journal_mode=WAL` al iniciar.

## Estructura del proyecto

```text
AutoStock/
├── .agent/                       # Artefactos internos del agente (ignorado por git)
├── CLAUDE.md                     # Documento interno del proyecto (ignorado por git)
├── README.md
├── start.ps1                     # Arranca backend + frontend en Windows
├── stop.ps1                      # Detiene procesos iniciados por start.ps1
├── backend/
│   ├── ai/
│   │   └── matcher.py            # Pendiente: matching semantico
│   ├── alembic/
│   ├── repositories/
│   ├── routers/
│   ├── scripts/
│   ├── tasks/
│   ├── tests/
│   ├── database/                 # autostock.db (runtime)
│   ├── main.py
│   ├── config.py
│   ├── database.py
│   ├── models.py
│   ├── schemas.py
│   ├── validators.py
│   └── requirements.txt
├── frontend/
│   ├── index.html
│   ├── views/
│   ├── scripts/
│   └── styles/
└── docs/
	 ├── CHANGELOG.md
	 └── manual_usuario.md
```

## Que hace cada modulo

### Backend

- `backend/main.py`: configura FastAPI, CORS, lifespan, routers y tarea de backup.
- `backend/config.py`: constantes globales (DB URL, host, puerto, JWT secret).
- `backend/database.py`: singleton de base de datos.
- `backend/models.py`: schema SQLAlchemy Core.
- `backend/schemas.py`: modelos Pydantic para request/response.
- `backend/validators.py`: validaciones de negocio.
- `backend/sanitizers.py`: saneamiento de strings.
- `backend/auth_helpers.py`: decodificacion JWT, roles y helpers de auth.
- `backend/repositories/`: capa de acceso a datos por dominio.
- `backend/routers/`: capa HTTP por dominio.
- `backend/tasks/backup.py`: backup periodico de SQLite.
- `backend/scripts/reset_db.py`: reset de base para desarrollo.
- `backend/tests/`: pruebas de integracion, seguridad y validadores.

### Frontend

- `frontend/views/`: pantallas principales.
- `frontend/scripts/api-client.js`: cliente HTTP centralizado.
- `frontend/scripts/login.js`: login y token.
- `frontend/scripts/dashboard.js`: resumen del sistema.
- `frontend/scripts/inventario.js`: gestion de productos.
- `frontend/scripts/compras.js`: lista de compras y exportacion.
- `frontend/scripts/reportes.js`: consulta de reportes.
- `frontend/scripts/usuarios.js`: administracion de usuarios.
- `frontend/scripts/catalogos.js`: catalogos y proveedores.
- `frontend/scripts/movements.js`: alta de movimientos.
- `frontend/scripts/xml-importer.js`: previsualizacion de importacion XML.
- `frontend/styles/`: variables, estilos globales y animaciones.

## Requisitos

- Python 3.11+
- pip
- PowerShell (si usas `start.ps1` y `stop.ps1` en Windows)
- Puertos libres `8765` (backend) y `5500` (frontend)

## Clonar repositorio

```bash
git clone https://github.com/SrAlberto-eng/AutoStock.git
cd AutoStock
```

## Configuracion de entorno

Crea el entorno virtual en la raiz del repositorio e instala las dependencias:

```bash
python -m venv .venv
.\.venv\Scripts\pip install -r backend\requirements.txt
```

`start.ps1` detecta automaticamente el `.venv` local, por lo que no es necesario activarlo manualmente antes de ejecutar los scripts.

## Como ejecutar

### Opcion A: Windows con scripts

Desde la raiz del proyecto:

```powershell
.\start.ps1
```

Servicios disponibles:

- Backend: `http://127.0.0.1:8765`
- Swagger: `http://127.0.0.1:8765/docs`
- Health: `http://127.0.0.1:8765/health`
- Frontend: `http://127.0.0.1:5500`

Para detener:

```powershell
.\stop.ps1
```

Nota: `start.ps1` usa `python` desde PATH. Para portabilidad, solo asegurate de tener el entorno virtual activado en la terminal desde la que lo ejecutas.

### Opcion B: Manual (cualquier SO)

Terminal 1 (backend):

```bash
cd backend
python main.py
```

Terminal 2 (frontend):

```bash
cd frontend
python -m http.server 5500 --bind 127.0.0.1
```

## Pruebas

Desde `backend/`:

```bash
python -m pytest -q
```

Ejemplos utiles:

```bash
python -m pytest tests/test_security.py -v
python -m pytest tests/test_integration.py -v
```

## Resumen de API

Base URL: `http://127.0.0.1:8765`

### Auth (`/api/auth`)

- `POST /login`
- `POST /logout`
- `GET /me`

### Catalogos (`/api/catalogos`)

- `GET /{tipo}` (`categorias|areas|unidades`)
- `POST /categorias`
- `POST /areas`
- `POST /unidades`
- `PATCH /{tipo}/{id}`
- `PATCH /unidades/{id}`
- `DELETE /{tipo}/{id}`

### Productos (`/api/productos`)

- `GET /`
- `POST /`
- `POST /bulk`
- `GET /{id}`
- `PATCH /{id}`
- `POST /{id}/toggle`
- `DELETE /{id}`

### Movimientos (`/api/movimientos`)

- `POST /`
- `GET /`
- `POST /{id}/revertir`

### Dashboard (`/api/dashboard`)

- `GET /resumen`

### Importacion (`/api/importacion`)

- `POST /preview`

### Usuarios (`/api/usuarios`)

- `GET /`
- `POST /`
- `PATCH /{id}`
- `POST /{id}/password`
- `POST /{id}/toggle`
- `DELETE /{id}`
- `POST /{id}/unblock`
- `POST /cambiar-password`

### Compras (`/api/compras`)

- `GET /`
- `GET /export`

### Proveedores (`/api/proveedores`)

- `GET /`
- `POST /`
- `PATCH /{id}`
- `POST /{id}/toggle`

### Reportes (`/api/reportes`)

- `GET /audit-log`
- `GET /movimientos`

### Admin (`/api/admin`)

- `POST /backup`

### Sistema

- `GET /health`

## Seguridad y runtime

- Backend escuchando solo en loopback (`127.0.0.1`).
- JWT HS256 con expiracion de 8 horas.
- Passwords hasheados con bcrypt.
- Bloqueo temporal de cuenta por intentos fallidos.
- Rate limit basico de login por IP.
- SQLite en modo WAL.
- Define `AUTOSTOCK_JWT_SECRET` para cualquier entorno no local.

## Estado actual y pendientes

- Implementado: CRUD principal de dominio, auth por rol, auditoria, compras en tiempo real y reportes.
- Pendiente 1: matching semantico real en `backend/ai/matcher.py`.
- Pendiente 2: endpoint real para guardar perfil desde UI (`frontend/scripts/layout.js`).

## Problemas comunes

1. Error de modulo faltante:
	instala dependencias en `backend/requirements.txt` con entorno activo.
2. Puerto ocupado:
	ejecuta `stop.ps1` o libera puertos `8765/5500`.
3. Token expirado:
	vuelve a iniciar sesion.
4. Base bloqueada:
	cierra procesos previos y reinicia backend.

## Licencia

Proyecto academico para UABC, 2026.
