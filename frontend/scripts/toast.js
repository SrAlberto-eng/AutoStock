/**
 * Script: toast.js
 * Vista asociada: Todos los archivos HTML
 * Dependencias: Ninguna
 * Descripción: Sistema de notificaciones toast global.
 *              Expone la función global showToast(message, type)
 *              para mostrar mensajes de éxito, error e información.
 *              Se auto-elimina después de 3 segundos con animación.
 */

(function () {
  'use strict';

  /**
   * Muestra una notificación toast en la esquina inferior derecha.
   * @param {string} message - Texto a mostrar
   * @param {'success'|'error'|'info'} type - Tipo de notificación
   * @param {number} [duration=3000] - Duración en ms antes de desaparecer
   */
  function showToast(message, type, duration) {
    type     = type     || 'info';
    duration = duration || 3000;

    var container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }

    var toast = document.createElement('div');
    toast.className = 'toast toast-' + type;

    // Icon SVG per type
    var iconSvg = '';
    if (type === 'success') {
      iconSvg = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
    } else if (type === 'error') {
      iconSvg = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
    } else {
      iconSvg = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
    }

    toast.innerHTML = iconSvg + '<span>' + message + '</span>';

    container.appendChild(toast);

    // Auto-remove after duration
    var removeTimeout = setTimeout(function () {
      removeToast(toast);
    }, duration);

    // Click to dismiss early
    toast.addEventListener('click', function () {
      clearTimeout(removeTimeout);
      removeToast(toast);
    });
  }

  function removeToast(toast) {
    if (!toast || !toast.parentNode) return;
    toast.classList.add('hiding');
    toast.addEventListener('animationend', function () {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, { once: true });
    // Fallback if animation doesn't fire
    setTimeout(function () {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 300);
  }

  // Expose globally
  window.showToast = showToast;

})();
