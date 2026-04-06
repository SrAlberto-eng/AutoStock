# AutoStock

Sistema de inventario offline con backend en FastAPI + SQLite y frontend en HTML/CSS/JS vanilla.

## Estado actual (Marzo 2026)

- Backend operativo con autenticacion JWT, control de sesiones y bloqueo por intentos fallidos.
- CRUD funcional para catalogos, productos, movimientos, compras, usuarios y reportes.
- Frontend conectado al backend mediante `frontend/scripts/api-client.js`.
- Importacion XML disponible con matching simple por texto.
- Match semantico con IA: aun no implementado (planeado para Fase 4).

## Stack

- Backend: Python 3.11+, FastAPI, SQLAlchemy Core, Alembic
- Base de datos: SQLite (WAL)
- Auth: JWT (python-jose) + bcrypt
- Frontend: HTML5, CSS3, JavaScript ES6 (sin framework)

## Estructura del proyecto

```text
AutoStock/
├── .agent/                              # Documentacion de plan interno (no runtime)
├── .pytest_cache/                       # [INUTIL EN REPO] Cache de pruebas (generado)
├── backend/
│   ├── alembic/                         # Migraciones de base de datos
│   ├── ai/
│   │   └── matcher.py                   # [PENDIENTE] NotImplementedError (Fase 4)
│   ├── repositories/                    # Acceso a datos por dominio
│   ├── routers/                         # Endpoints API
│   ├── scripts/
│   ├── tasks/
│   │   └── backup.py                    # Backups periodicos
│   ├── tests/
│   ├── __pycache__/                     # [INUTIL EN REPO] Cache de Python (generado)
│   ├── .pytest_cache/                   # [INUTIL EN REPO] Cache de pytest (generado)
│   ├── autostock.db                     # [NO VERSIONAR] BD local de entorno
│   ├── autostock.db-shm                 # [INUTIL EN REPO] Artefacto SQLite WAL
│   ├── autostock.db-wal                 # [INUTIL EN REPO] Artefacto SQLite WAL
│   ├── backend/                         # [LEGADO] Ruta historica de artefactos
│   │   ├── backups/                     # [INUTIL EN REPO] Backups generados
│   │   └── logs/                        # [INUTIL EN REPO] Logs generados
│   ├── logs/                            # [INUTIL EN REPO] Logs runtime
│   ├── main.py                          # Entrada FastAPI
│   ├── config.py
│   ├── database.py
│   ├── models.py
│   ├── schemas.py
│   ├── validators.py
│   └── requirements.txt
├── docs/
│   ├── CHANGELOG.md
│   └── manual_usuario.md
├── frontend/
│   ├── index.html
│   ├── scripts/
│   │   ├── api-client.js
│   │   ├── layout.js                    # [PENDIENTE] saveProfile() aun sin endpoint real
│   │   └── ...
│   ├── styles/
│   └── views/
└── README.md
```

## Cosas inutiles o prescindibles en la estructura actual

Estas rutas no deberian versionarse en Git (son artefactos generados):

- `/.pytest_cache/`
- `/backend/.pytest_cache/`
- `/backend/__pycache__/`
- `/backend/logs/`
- `/backend/backend/logs/`
- `/backend/backend/backups/`
- `/backend/autostock.db`
- `/backend/autostock.db-wal`
- `/backend/autostock.db-shm`

Nota: la carpeta `/backend/backend/` aparece por ejecuciones historicas con rutas relativas antiguas. Puede limpiarse si ya no se usa en tu flujo.

## Faltantes por implementar

1. IA de matching semantico en importacion XML
- Archivo: `backend/ai/matcher.py`
- Estado: los metodos `cargar_catalogo()` y `sugerir()` lanzan `NotImplementedError`.
- Impacto: la importacion usa matching simple por palabras en vez de embeddings.

2. Actualizacion real de perfil desde UI
- Archivo: `frontend/scripts/layout.js`
- Estado: `saveProfile()` valida localmente, muestra toast de exito y cierra modal, pero marca TODO y mensaje de endpoint pendiente.
- Falta: endpoint backend y conexion desde frontend para guardar nombre/correo/password.

3. Higiene de artefactos de runtime
- Ruta: `backend/backend/` y carpetas de logs/backups en repo.
- Falta: consolidar ruta unica de salida para logs/backups y excluir artefactos en `.gitignore`.

## Como ejecutar

## 1) Backend

Desde la raiz del proyecto:

```bash
cd backend
python -m pip install -r requirements.txt
python main.py
```

Backend disponible en:

- API: `http://127.0.0.1:8765`
- Swagger: `http://127.0.0.1:8765/docs`
- Health: `http://127.0.0.1:8765/health`

## 2) Frontend

Puedes abrir `frontend/index.html` directamente o servir carpeta localmente.

Ejemplo rapido con Python:

```bash
cd frontend
python -m http.server 8080
```

Abrir `http://127.0.0.1:8080`.

## Testing backend

```bash
cd backend
python -m pytest -q
```

## Observaciones de seguridad y runtime

- El backend corre en loopback (`127.0.0.1`) por diseno.
- Configura `AUTOSTOCK_JWT_SECRET` en entorno para despliegue real.
- SQLite WAL esta habilitado al iniciar la app.

## Sugerencia de limpieza inmediata del repositorio

1. Agregar/ajustar `.gitignore` para caches, DB local, WAL/SHM, logs y backups.
2. Eliminar del repo los artefactos ya versionados (`__pycache__`, `.pytest_cache`, `logs`, `backups`, `autostock.db*`).
3. Mantener solo codigo fuente, migraciones, docs y tests.
