# Changelog

Todos los cambios notables se documentan en este archivo.
Formato basado en [Keep a Changelog](https://keepachangelog.com/es/1.0.0/).

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
