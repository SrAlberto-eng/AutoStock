/**
 * messages.js
 * Constantes de texto de la interfaz agrupadas por dominio.
 * Importar con: import { MSG } from './constants/messages.js'
 */

export const MSG = {

  AUTH: {
    FIELDS_REQUIRED:   'Por favor, completa todos los campos',
    CREDENTIALS_INVALID: 'Credenciales incorrectas',
    ACCOUNT_LOCKED:    'Cuenta bloqueada. Contacta al administrador.',
    CONNECTION_ERROR:  'Error de conexión. Verifica que el servidor esté activo.',
    API_UNAVAILABLE:   'Cliente API no disponible',
    TOKEN_MISSING:     'Respuesta de login inválida: token no recibido',
    SESSION_EXPIRED:   'Tu sesión expiró',
    LOADING:           'Iniciando sesión...',
    SUBMIT:            'Iniciar Sesión',
    /** @param {string} nombre */
    WELCOME:           (nombre) => 'Bienvenido, ' + nombre,
  },

  PASSWORD: {
    FORCE_CHANGE_REQUIRED: 'Debes cambiar tu contraseña antes de continuar',
    FORCE_CHANGE_INVALID:  'Debes ingresar una contraseña válida para continuar',
    CHANGE_FAILED:         'No se pudo cambiar la contraseña',
    CURRENT_REQUIRED:      'Ingresa tu contraseña actual',
    MISMATCH:              'Las contraseñas no coinciden',
    TOO_SHORT:             'La contraseña debe tener al menos 6 caracteres',
    TEMP_TOO_SHORT:        'La contraseña temporal debe tener al menos 6 caracteres',
    /** @param {string} password */
    TEMP_DISPLAY:          (password) => 'Contraseña temporal: ' + password,
  },

  USERS: {
    ADMIN_ONLY:   'Solo administrador puede ejecutar esta operación',
    NAME_REQUIRED: 'El nombre es requerido',
    EMAIL_INVALID: 'Ingresa un correo válido',
    ROLE_REQUIRED: 'Selecciona un rol',
    CREATED:      'Usuario creado correctamente',
    UPDATED:      'Usuario actualizado correctamente',
    DELETED:      'Usuario eliminado correctamente',
    ACTIVATED:    'Usuario activado',
    DEACTIVATED:  'Usuario desactivado',
    /** @param {boolean} isNew */
    SAVED:        (isNew) => 'Usuario ' + (isNew ? 'creado' : 'actualizado') + ' correctamente',
  },

  MOVEMENTS: {
    ENTRY_MIN_PRODUCT:        'Agrega al menos un producto con cantidad válida',
    EXIT_DESTINATION_REQUIRED: 'Selecciona un destino (área)',
    WASTE_MIN_PRODUCT:        'Agrega al menos un producto con cantidad y motivo válidos',
    WASTE_REASON_REQUIRED:    'Selecciona un motivo para cada fila de merma',
    ENTRY_SUCCESS:            'Entradas registradas correctamente',
    EXIT_SUCCESS:             'Salidas registradas correctamente',
    WASTE_SUCCESS:            'Merma registrada correctamente',
    ENTRY_ERROR:              'Error al registrar entradas',
    EXIT_ERROR:               'Error al registrar salidas',
    WASTE_ERROR:              'Error al registrar merma',
  },

  INVENTORY: {
    SAVE_REQUIRED_FIELDS:  'Completa los campos obligatorios de cada fila',
    SAVE_EXISTING_FIELDS:  'Completa producto y cantidad en las filas de productos existentes',
    NO_VALID_PRODUCTS:     'No hay productos válidos para guardar',
    SAVED:                 'Guardado',
    TOGGLE_ERROR:          'Error al cambiar estado',
    XML_NO_PRODUCTS:       'No se encontraron productos ni conceptos en el XML',
    SUPPLIER_ADD_ERROR:    'Error al agregar proveedor',
    /** @param {number} n */
    ENTRIES_COUNT:         (n) => 'Entradas registradas: ' + n,
    /** @param {string} accion */
    PRODUCT_TOGGLED:       (accion) => 'Producto ' + accion,
    /** @param {number} n */
    XML_LOADED_CFDI:       (n) => n + ' producto(s) importado(s) desde CFDI XML',
    /** @param {number} n */
    XML_LOADED:            (n) => n + ' producto(s) importado(s) desde XML',
    /** @param {string} nombre */
    SUPPLIER_ADDED:        (nombre) => 'Proveedor "' + nombre + '" agregado',
  },

  CATALOGS: {
    NAME_REQUIRED:       'El nombre es requerido',
    SAVED:               'Guardado',
    DELETE_HAS_PRODUCTS: 'No se puede eliminar: tiene productos asociados',
    PROVIDER_UPDATED:    'Proveedor actualizado',
    PROVIDER_CREATED:    'Proveedor creado',
    STATUS_UPDATED:      'Estado actualizado',
    /** @param {string} name */
    DELETED:             (name) => '"' + name + '" eliminado correctamente',
  },

  PURCHASES: {
    NO_PRODUCTS:        'No hay productos en la lista de compras.',
    NO_PRODUCTS_EXPORT: 'No hay productos para exportar.',
    NO_MATCH_FILTERS:   'No se encontraron productos con los filtros aplicados.',
    PRINT_BLOCKED:      'El navegador bloqueó la ventana de impresión.',
  },

  REPORTS: {
    NO_DATA:     'No hay datos para exportar',
    CSV_SUCCESS: 'CSV exportado correctamente',

    DATE_ALL:           'Todas las fechas',
    DATE_PRESETS_TITLE: 'Accesos rápidos',
    DATE_CUSTOM:        'Rango personalizado',
    DATE_TODAY:         'Hoy',
    DATE_YESTERDAY:     'Ayer',
    DATE_LAST_7:        'Últimos 7 días',
    DATE_LAST_30:       'Últimos 30 días',
    DATE_THIS_MONTH:    'Este mes',
    DATE_LAST_MONTH:    'Mes anterior',
    DATE_FROM:          'Desde',
    DATE_TO:            'Hasta',
    DATE_APPLY:         'Aplicar',
    DATE_CLEAR:         'Limpiar',
  },

  DASHBOARD: {
    NO_STOCK_OUT:              'Sin productos agotados',
    ALL_STOCK_OK:              'Todos los productos tienen stock suficiente',
    NO_RECENT_MOVEMENTS:       'Sin movimientos recientes',
    XML_READ_ERROR:            'No se pudo leer el archivo XML',
    XML_NO_CONCEPTS:           'No se encontraron conceptos en el XML',
    XML_SUGGESTIONS_LOADING:   'Consultando sugerencias...',
    XML_SUGGESTIONS_UNAVAILABLE: 'Sugerencias no disponibles. Completa manualmente.',
    XML_NO_AUTO_MATCH:         'Sin coincidencias automáticas. Completa manualmente.',
    TIME_NOW:                  'Ahora',
    /** @param {number} n */
    XML_LOADED:                (n) => 'XML cargado: ' + n + ' concepto(s)',
    /** @param {number} n */
    XML_AUTO_MATCHED:          (n) => 'Se aplicaron ' + n + ' sugerencia(s) automáticas.',
    /** @param {number} actual @param {number} min */
    STOCK_LABEL:               (actual, min) => 'Stock: ' + actual + ' / Mín: ' + min,
    /** @param {number} n */
    TIME_MINUTES:              (n) => 'Hace ' + n + ' min',
    /** @param {number} n */
    TIME_HOURS:                (n) => 'Hace ' + n + ' h',
  },

  LAYOUT: {
    CATALOGS_ERROR:   'Error cargando catálogos. Recarga la página.',
    PROFILE_PENDING:  'Actualización de perfil lista (endpoint pendiente)',
  },

};
