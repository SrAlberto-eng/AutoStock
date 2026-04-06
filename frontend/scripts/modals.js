/**
 * Script: modals.js
 * Vista asociada: Todas las vistas que usan modales
 * Dependencias: toast.js
 * Descripción: Gestor central de modales y diálogos.
 *              - modalManager.open(id): abre un modal por ID
 *              - modalManager.close(id): cierra un modal por ID
 *              - modalManager.closeAll(): cierra todos los modales abiertos
 *              Maneja: Escape para cerrar, click en backdrop, tabs dentro de modales.
 */

(function () {
  'use strict';

  /* Stack de modales abiertos */
  var openStack = [];

  /* ════════════════════════════════════════════════════════
     OPEN
     ════════════════════════════════════════════════════════ */

  function open(modalId) {
    var backdrop = document.getElementById(modalId);
    if (!backdrop) {
      console.warn('Modal no encontrado: ' + modalId);
      return;
    }

    backdrop.classList.remove('hidden');
    backdrop.dataset.state = 'open';

    // Animate panel
    var panel = backdrop.querySelector('.modal-panel, .modal-dialog, .alert-dialog-panel');
    if (panel) {
      panel.dataset.state = 'open';
    }

    document.body.style.overflow = 'hidden';
    openStack.push(modalId);

    // Init tabs inside this modal
    initTabsInModal(backdrop);

    // Call per-modal init function if it exists
    var initFnName = 'init' + toPascalCase(modalId);
    if (typeof window[initFnName] === 'function') {
      window[initFnName](backdrop);
    }
  }

  /* ════════════════════════════════════════════════════════
     CLOSE
     ════════════════════════════════════════════════════════ */

  function close(modalId) {
    var backdrop = document.getElementById(modalId);
    if (!backdrop) return;

    var panel = backdrop.querySelector('.modal-panel, .modal-dialog, .alert-dialog-panel');
    if (panel) {
      panel.dataset.state = 'closed';
    }

    // Wait for animation then hide
    setTimeout(function () {
      backdrop.classList.add('hidden');
      backdrop.dataset.state = 'closed';
    }, 150);

    // Remove from stack
    openStack = openStack.filter(function (id) { return id !== modalId; });

    if (openStack.length === 0) {
      document.body.style.overflow = '';
    }
  }

  function closeAll() {
    var toClose = openStack.slice();
    toClose.forEach(function (id) { close(id); });
  }

  /* ════════════════════════════════════════════════════════
     BACKDROP CLICK
     ════════════════════════════════════════════════════════ */

  document.addEventListener('click', function (e) {
    // If click is directly on a backdrop (not on its children)
    var target = e.target;
    if (target.classList.contains('modal-backdrop') ||
        target.classList.contains('alert-dialog-backdrop')) {
      var modalId = target.id;
      if (modalId) close(modalId);
    }
  });

  /* ════════════════════════════════════════════════════════
     ESCAPE KEY
     ════════════════════════════════════════════════════════ */

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && openStack.length > 0) {
      var topModal = openStack[openStack.length - 1];
      close(topModal);
    }
  });

  /* ════════════════════════════════════════════════════════
     TABS INSIDE MODALS
     ════════════════════════════════════════════════════════ */

  function initTabsInModal(container) {
    var tabTriggers = container.querySelectorAll('.modal-tab-trigger, .tab-trigger');
    if (tabTriggers.length === 0) return;

    tabTriggers.forEach(function (trigger) {
      trigger.addEventListener('click', function () {
        var tabGroup = trigger.closest('[data-tab-group], .tabs-container, .modal-tabs-container');
        var targetPanel = trigger.dataset.tabTarget;
        if (!targetPanel) return;

        var scope = tabGroup || container;

        // Deactivate all in scope
        scope.querySelectorAll('.modal-tab-trigger, .tab-trigger').forEach(function (t) {
          t.classList.remove('active');
          t.setAttribute('aria-selected', 'false');
        });
        scope.querySelectorAll('.tab-panel, .modal-tab-panel').forEach(function (p) {
          p.classList.remove('active');
          p.setAttribute('aria-hidden', 'true');
        });

        // Activate selected
        trigger.classList.add('active');
        trigger.setAttribute('aria-selected', 'true');

        var panel = scope.querySelector('#' + targetPanel) || container.querySelector('#' + targetPanel);
        if (panel) {
          panel.classList.add('active');
          panel.setAttribute('aria-hidden', 'false');
        }
      });
    });
  }

  /* ════════════════════════════════════════════════════════
     CLOSE BUTTONS (data-modal-close attribute)
     ════════════════════════════════════════════════════════ */

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-modal-close]');
    if (btn) {
      var modalId = btn.dataset.modalClose;
      close(modalId);
    }

    var openBtn = e.target.closest('[data-modal-open]');
    if (openBtn) {
      var openId = openBtn.dataset.modalOpen;
      open(openId);
    }
  });

  /* ════════════════════════════════════════════════════════
     HELPERS
     ════════════════════════════════════════════════════════ */

  function toPascalCase(str) {
    return str.replace(/(^|[-_])([a-z])/g, function (_, __, c) {
      return c.toUpperCase();
    });
  }

  /* ════════════════════════════════════════════════════════
     PUBLIC API
     ════════════════════════════════════════════════════════ */

  window.modalManager = {
    open: open,
    close: close,
    closeAll: closeAll
  };

})();
