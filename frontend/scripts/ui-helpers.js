/**
 * ui-helpers.js
 * Fragmentos de HTML reutilizables entre módulos.
 * Importar con: import { tipoBadge, statusBadge, activoBadge } from './ui-helpers.js'
 */
import { badge, toStatusKey } from './utils.js';

/**
 * Badge para tipo de movimiento.
 * @param {'entrada'|'salida'|'merma'} tipo
 */
export function tipoBadge(tipo) {
  if (tipo === 'entrada') return badge('Entrada', 'success');
  if (tipo === 'salida')  return badge('Salida',  'primary');
  return badge('Merma', 'warning');
}

/**
 * Badge para estado de stock de un producto.
 * @param {string} estado - valor crudo del backend ('agotado', 'poca existencia', 'normal')
 */
export function statusBadge(estado) {
  const key = toStatusKey(estado);
  if (key === 'agotado')    return badge('Agotado',    'danger');
  if (key === 'bajo_minimo') return badge('Bajo mínimo', 'warning');
  return badge('Normal', 'success');
}

/**
 * Badge para estado activo / inactivo de cualquier entidad.
 * @param {boolean|number} activo
 */
export function activoBadge(activo) {
  return activo !== false && activo !== 0
    ? badge('Activo',   'success')
    : badge('Inactivo', 'muted');
}
