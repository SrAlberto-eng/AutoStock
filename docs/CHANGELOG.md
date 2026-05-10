# Changelog

Todos los cambios notables se documentan en este archivo.
Formato basado en [Keep a Changelog](https://keepachangelog.com/es/1.0.0/).

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
