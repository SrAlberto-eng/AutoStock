# Changelog

Todos los cambios notables se documentan en este archivo.
Formato basado en [Keep a Changelog](https://keepachangelog.com/es/1.0.0/).

---

## [1.4.0] - 2026-05-13

### Added
- **Empaquetado de escritorio con Tauri v2:** la app se distribuye como instalador `.msi` para Windows sin requerir Python ni Node.js en la máquina destino.
  - `src-tauri/` — proyecto Rust con `tauri.conf.json`, `Cargo.toml`, `build.rs`, `src/main.rs` y `capabilities/default.json`.
  - `package.json` — scripts `dev` y `build` vía `@tauri-apps/cli`.
  - `build-backend.ps1` — script de compilación PyInstaller: genera el onedir, detecta el target triple de Rust y copia el binario a `src-tauri/binaries/`.
  - `backend/backend.spec` — spec de PyInstaller en modo `--onedir`; incluye `alembic/` y `alembic.ini` como data files; lista exhaustiva de `hiddenimports` para jose, bcrypt, pydantic-core, alembic, SQLAlchemy, uvicorn y módulos locales.
- **Sidecar de backend:** Tauri spawna `autostock-backend-x86_64-pc-windows-msvc.exe` al iniciar y lo mata al cerrar la ventana. Los archivos del onedir (DLLs, `_internal/`) se copian automáticamente a `target/{profile}/` vía `build.rs`.
- **Overlay de inicio en frontend:** `frontend/scripts/health-check.js` exporta `waitForBackend()` que hace polling a `GET /health` cada 500 ms (timeout 30 s). El overlay cubre la pantalla de login hasta que el sidecar responde, mostrando contador de intentos y mensaje de error si se agota el tiempo.

### Changed
- **`backend/config.py`** — reescrito para detectar modo frozen (`sys._MEIPASS`). En producción usa `%APPDATA%\AutoStock` para DB, logs y backups; en desarrollo mantiene el directorio `backend/` local. Exporta `BASE_DIR`, `APP_DATA_DIR`, `BACKUP_DIR` y `LOG_DIR`.
- **`backend/main.py`** — Alembic se configura con `script_location` explícito desde `config.BASE_DIR` para funcionar en contexto frozen. El hilo de backup recibe `config.BACKUP_DIR` como argumento. CORS ampliado con `http://tauri.localhost` (Windows WebView2 producción) y regex `http://(localhost|127\.0\.0\.1)(:\d+)?` (servidor de desarrollo de Tauri).
- **`backend/logging_config.py`** — `setup_file_logger` resuelve la ruta de log desde `config.LOG_DIR`; eliminado el helper `_resolve_backend_path` que usaba rutas relativas rotas en modo frozen.
- **`backend/tasks/backup.py`** — `backup_database` acepta `backup_dir` opcional; si es `None` lo obtiene de `config.BACKUP_DIR`.
- **`backend/alembic/env.py`** — detección de modo frozen para insertar `sys._MEIPASS` en `sys.path`; importación de `models.metadata` envuelta en `try/except ImportError` (`target_metadata = None` es válido para `upgrade head` sin `--autogenerate`).
- **`.gitignore`** — añadidas entradas `backend/dist/`, `backend/build/`, `src-tauri/target/`, `src-tauri/binaries/`, `src-tauri/gen/` y `node_modules/`.

---

## [1.3.0] - 2026-05-09

### Added
- **Date range picker en Reportes:** reemplaza los dos `<input type="date">` sueltos por un componente integrado (`date-range-picker.js`) con botón-trigger, dropdown de presets y rango personalizado.
  - Presets rápidos: Hoy, Ayer, Últimos 7 días, Últimos 30 días, Este mes, Mes anterior.
  - Botón × en el trigger para limpiar el rango sin abrir el dropdown.
  - Preset activo resaltado al reabrir el dropdown.
  - Rango persistido en `localStorage` y restaurado al recargar.
  - Componente reutilizable: acepta `containerId`, `onChange`, `initialFrom`, `initialTo`.

### Fixed
- Rango personalizado normalizaba silenciosamente `from`/`to` si el usuario los ingresaba invertidos (swap automático antes de disparar `onChange`).
- `z-index` del dropdown reemplazado de valor hardcoded (`200`) por token `var(--z-dropdown)` para respetar la escala de capas del sistema.
- Formato de fecha en el trigger mostraba "09-may" (guión de locale `es-MX`); corregido construyendo día y mes por separado para obtener "09 may".

---

## [1.2.0] - 2026-05-08

### Changed
- **Migración completa a ES Modules (Fases 4a–4d):** todos los scripts de infraestructura del frontend convertidos de IIFE con `window.*` a módulos ES con `import`/`export`. Cada HTML ahora carga un único `<script type="module">`.
- `modals.js`: patrón de registro de callbacks (`registerInit`) reemplaza la llamada dinámica `window[initFnName]()`. Delegación `data-modal-open` elimina todos los `onclick` para abrir modales.
- `movements.js`: convertido a ES Module; `data-action="remove"` en filas reemplaza `onclick="removeEntryRow(X)"`.
- `layout.js`: convertido a ES Module; `init()` corre al nivel de módulo (los módulos son `defer`).
- `select-ui.js`: importa `escapeHtml` desde `sanitizers.js` en lugar de leer `window.escapeHtml`.
- Todos los mensajes de toast en `movements.js` reemplazados por constantes `MSG.MOVEMENTS.*`.

### Fixed
- Sidebar no persistía entre vistas: `storageManager` ya no expone en `window`; corregido con acceso directo a `localStorage` (`v1_ui_sidebar`).
- Dashboard: tarjeta "Total productos" aparecía vacía cuando `_ensureProductsLoaded` rechazaba por `window.store` indefinido tras la migración.
- Filtro "Ver todos" en inventario no aplicaba: valor almacenado era `'Agotado'` pero los chips usaban `'agotado'`/`'bajo_minimo'`.
- Punto de alerta en inventario para productos "bajo mínimo" era azul (`.movement-dot--salida`) en lugar de amarillo; añadida clase `.movement-dot--warning` con `var(--status-warning)`.
- Lista de compras no incluía productos agotados (`stock_actual = 0, stock_min = 0`): condición ampliada a `stock_actual < stock_min OR stock_actual = 0`.
- Distribución de columnas inconsistente en compras: añadido `table-layout:fixed` + `<colgroup>`.

---

## [1.1.0] - 2026-05-08

### Added
- Toggle dark/light mode en todas las vistas, incluido login.
- Módulo `frontend/scripts/theme-switcher.js` compartido: expone `window.initThemeSwitcher()` para que login pueda usar el toggle sin cargar `layout.js` (que tiene session guard).
- Botón de tema en login posicionado fixed top-right.

### Changed
- Tema seleccionado persiste entre vistas y sesiones via `localStorage` (`v1_ui_theme`).
- `doLogout()` preserva `v1_ui_theme` antes de limpiar el estado de sesión, para que el tema no se pierda al cerrar sesión.
- Modo light rediseñado: fondo off-white (`#F0F0F3`), cards blancas, texto de alto contraste (`#0F0F12` / `#2C2C3A`).
- Badges de estado (activo/agotado/bajo stock) con colores semánticos adecuados en modo light.
- Íconos de stat cards con mayor contraste en modo light.
- Todos los colores hardcodeados en JS y HTML (`#E6E6E6`, `#A6A6A6`, `#1E2022`) reemplazados por variables CSS.

### Fixed
- Ícono del toggle aparecía vacío al cargar la página (no se inicializaba el SVG inicial).
- Tema no persistía al navegar entre vistas (se leía con `JSON.parse` un valor que ya era string plano).
- Texto tenue en modo light por colores hardcodeados en dark que ignoraban las variables CSS.
- Cards de "Agotados" y "Bajo stock" del dashboard mostraban texto tenue en modo light.

---

## [1.0.0] - 2026-04-01

### Added
- Autenticación con JWT (HS256, 8h), sesiones persistidas y bloqueo por intentos fallidos.
- CRUD de productos con estados de stock calculados (activo, agotado, bajo stock).
- Movimientos de inventario: entrada, salida y merma con validaciones operativas.
- Reversión de salidas y mermas del mismo día (solo administrador).
- Dashboard con indicadores del día y alertas de inventario.
- Catálogos: categorías, áreas, unidades de medida y proveedores.
- Gestión de usuarios: alta, edición, baja lógica y reset de contraseña.
- Lista de compras generada en tiempo real desde stock mínimo.
- Reporte de movimientos con filtros y exportación CSV.
- Auditoría de acciones del sistema.
- Importación de facturas XML (CFDI) con matching heurístico de productos.
- Backup automático de SQLite cada 24h (máx. 7 copias).
- Control de acceso por rol: administrador, gerente, encargado_area, encargado_compras.
