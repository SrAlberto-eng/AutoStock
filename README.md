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
| Desktop | Tauri v2 (Rust) + PyInstaller onedir |
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
├── package.json                  # Scripts de Tauri (dev / build)
├── build-backend.ps1             # Compila el sidecar PyInstaller y lo copia a src-tauri/binaries/
├── start.ps1                     # Arranca backend + frontend en modo desarrollo (sin Tauri)
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
│   ├── backend.spec              # Spec de PyInstaller para compilar el sidecar
│   ├── main.py
│   ├── config.py                 # Detecta modo frozen; usa %APPDATA%\AutoStock en produccion
│   ├── database.py
│   ├── models.py
│   ├── schemas.py
│   ├── validators.py
│   └── requirements.txt
├── frontend/
│   ├── views/
│   ├── scripts/
│   │   └── health-check.js       # Polling al /health hasta que el sidecar responde
│   └── styles/
├── src-tauri/                    # Proyecto Rust de Tauri v2
│   ├── src/main.rs               # Spawn/kill del sidecar, ventana principal
│   ├── capabilities/
│   ├── build.rs                  # Copia _internal/ al directorio de build de Cargo
│   ├── Cargo.toml
│   └── tauri.conf.json
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

Todos los scripts son ES Modules. Cada vista carga un unico `<script type="module">` sin dependencias clasicas en `<script src>`.

- `frontend/views/`: pantallas principales (una por modulo).
- `frontend/scripts/api-client.js`: cliente HTTP centralizado con retry, dedup y reinyeccion de Bearer.
- `frontend/scripts/services.js`: 7 servicios de dominio sobre `apiClient`.
- `frontend/scripts/store.js`: estado global compartido (user, products, catalogs, suppliers).
- `frontend/scripts/storage-manager.js`: persistencia de estado UI en `localStorage`.
- `frontend/scripts/sanitizers.js`: `escapeHtml` para prevenir XSS al inyectar HTML.
- `frontend/scripts/layout.js`: session guard, sidebar, navegacion activa y modal de perfil.
- `frontend/scripts/modals.js`: gestor de modales con stack, Escape, backdrop y registro de callbacks de init.
- `frontend/scripts/toast.js`: notificaciones success/error/info.
- `frontend/scripts/filter-engine.js`: motor de filtrado local con predicados.
- `frontend/scripts/filter-chips.js`: chips de filtro activos vinculados al motor.
- `frontend/scripts/select-ui.js`: helper para construir `<select>` accesibles.
- `frontend/scripts/xml-importer.js`: parsing de XML CFDI y dropzone.
- `frontend/scripts/theme-switcher.js`: toggle dark/light persistente, compartido con login.
- `frontend/scripts/movements.js`: logica compartida de modales entrada/salida/merma.
- `frontend/scripts/constants/messages.js`: constantes de texto de la interfaz por dominio.
- `frontend/scripts/login.js`: flujo de login y cambio de contrasena forzado.
- `frontend/scripts/dashboard.js`: tarjetas de resumen, movimientos recientes e importacion XML CFDI.
- `frontend/scripts/inventario.js`: tabla de productos, filtros, modal de detalle, alta en lote.
- `frontend/scripts/compras.js`: lista de compras en tiempo real, ajuste de cantidad e impresion.
- `frontend/scripts/reportes.js`: reporte de movimientos con filtros y exportacion CSV.
- `frontend/scripts/usuarios.js`: administracion de usuarios por rol.
- `frontend/scripts/catalogos.js`: CRUD de categorias, areas, unidades y proveedores.
- `frontend/styles/`: variables CSS, estilos globales y animaciones.

## Requisitos

### Desarrollo (modo script)
- Python 3.11+, pip
- PowerShell
- Puertos libres `8765` (backend) y `5500` (frontend)

### Desarrollo y compilacion con Tauri
- Todo lo anterior, mas:
- Node.js 18+ y npm
- Rust (instalar con `winget install Rustlang.Rustup` y reiniciar terminal)

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

### Opcion A: App de escritorio con Tauri (recomendado)

Requiere Rust y Node.js instalados.

**Primera vez — compilar el sidecar de Python:**

```powershell
python -m venv .venv
.\.venv\Scripts\pip install -r backend\requirements.txt
.\build-backend.ps1
```

**Modo desarrollo** (abre la ventana de la app con WebView):

```powershell
npm install      # solo la primera vez
npm run dev
```

**Generar instalador `.msi`** (requiere iconos en `src-tauri/icons/`):

```powershell
npx tauri icon ruta\a\icono.png   # genera todos los tamaños
npm run build                      # produce el .msi en src-tauri/target/release/bundle/msi/
```

En produccion la base de datos, logs y backups se guardan en `%APPDATA%\AutoStock\`.

### Opcion B: Windows con scripts (desarrollo clasico)

```powershell
.\start.ps1
```

Servicios disponibles:

- Backend: `http://127.0.0.1:8765`
- Swagger: `http://127.0.0.1:8765/docs`
- Frontend: `http://127.0.0.1:5500`

```powershell
.\stop.ps1   # detener
```

### Opcion C: Manual (cualquier SO)

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

### Implementado

- CRUD principal de dominio, auth por rol, auditoria y compras en tiempo real.
- Reportes de movimientos con filtros y exportacion CSV.
- Toggle dark/light persistente en todas las vistas incluido login.
- Frontend completamente migrado a ES Modules: cero globals en `window`, cero `onclick` en HTML, un solo `<script type="module">` por vista.
- Empaquetado como app de escritorio con Tauri v2: sidecar PyInstaller, overlay de inicio con health check, datos en `%APPDATA%\AutoStock\`.

### Pendiente

- Matching semantico real en `backend/ai/matcher.py` (actualmente heuristico).
- Endpoint para guardar perfil desde UI (boton existe, `saveProfile()` es placeholder).
- Vista de audit-log (endpoint `GET /api/reportes/audit-log` existe, frontend no lo consume aun).
- Generacion de iconos e instalador `.msi` final.

## Problemas comunes

1. Error de modulo faltante:
   instala dependencias en `backend/requirements.txt` con entorno activo.
2. Puerto ocupado:
   ejecuta `stop.ps1` o libera puertos `8765/5500`.
3. Token expirado:
   vuelve a iniciar sesion.
4. Base bloqueada:
   cierra procesos previos y reinicia backend.
5. Overlay de Tauri no desaparece:
   puede haber un proceso `autostock-backend` huerfano usando el puerto 8765; terminalo en el Administrador de tareas y reinicia la app.
6. Sidecar no arranca tras `npm run dev`:
   ejecuta `.\build-backend.ps1` para regenerar el binario y luego reinicia `npm run dev`.

## Licencia

Proyecto academico para UABC, 2026.
