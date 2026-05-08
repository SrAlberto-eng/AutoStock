/**
 * utils.js
 * Utilidades puras reutilizables (sin DOM, sin window).
 * Importar con: import { slugify, badge, ... } from './utils.js'
 */

/**
 * Convierte un string a slug: lowercase, sin acentos, espacios → guiones,
 * guiones extremos eliminados.
 */
export function slugify(str) {
  return String(str || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]+/g, '')
    .replace(/^-+|-+$/g, '');
}

/**
 * Normaliza texto para búsquedas: lowercase + quita acentos, sin guiones.
 */
export function normalizeSearch(str) {
  return String(str || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/**
 * Genera un <span class="badge badge-{variant}"> con texto escapado.
 * @param {string} text
 * @param {'success'|'danger'|'warning'|'primary'|'muted'} variant
 */
export function badge(text, variant) {
  return '<span class="badge badge-' + variant + '">' + window.escapeHtml(String(text)) + '</span>';
}

/**
 * Formatea un ISO string a fecha y hora corta en español (MX).
 */
export function formatDateTime(isoStr) {
  if (!isoStr) return '—';
  return new Date(isoStr).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
}

/**
 * Formatea un ISO string a solo fecha corta en español (MX).
 */
export function toDateOnly(isoStr) {
  if (!isoStr) return '—';
  return new Date(isoStr).toLocaleDateString('es-MX', { dateStyle: 'short' });
}
