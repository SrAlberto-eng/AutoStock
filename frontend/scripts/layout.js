/**
 * Script: layout.js
 * Vista asociada: Todas las vistas con AppLayout (dashboard, inventario, etc.)
 * Dependencias: toast.js
 * Descripción: Controla el layout principal de la aplicación.
 *              - initSidebar(): colapso/expansión del sidebar con transición CSS
 *              - initMobileMenu(): overlay en móvil, cierre en resize
 *              - initActiveNav(): marca el enlace activo según la URL actual
 *              - initProfileDropdown(): menú desplegable del perfil en el topbar
 */

(function () {
  'use strict';

  /* ─── Estado ─────────────────────────────────────────── */
  var sidebarCollapsed = false;
  var mobileOpen       = false;

  /* ─── Refs cacheadas (se llenan en init) ─────────────── */
  var sidebar, mainContent, mobileOverlay, toggleBtn, toggleLabel,
      toggleIcon, mobileMenuBtn, profileTrigger, profileDropdown;


  /* Arreglo de connfiguracion de los módulos del sidebar */
  const MENU_ITEMS = [
    {
      id: 'dashboard',
      href: 'dashboard.html',
      label: 'Dashboard',
      icon: '<svg class="nav-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>',
      route: '/dashboard'
    },
    {
      id: 'inventario',
      href: 'inventario.html',
      label: 'Inventario General',
      icon: '<svg class="nav-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>',
      route: '/inventario'
    },
    {
      id: 'compras',
      href: 'compras.html',
      label: 'Lista de Compras',
      icon: '<svg class="nav-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>',
      route: '/compras'
    },
    {
      id: 'reportes',
      href: 'reportes.html',
      label: 'Reportes',
      icon: '<svg class="nav-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" x2="18" y1="20" y2="10"/><line x1="12" x2="12" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="14"/></svg>',
      route: '/reportes'
    },
    {
      id: 'usuarios',
      href: 'usuarios.html',
      label: 'Usuarios',
      icon: '<svg class="nav-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
      route: '/usuarios'
    },
    {
      id: 'catalogos',
      href: 'catalogos.html',
      label: 'Catálogos',
      icon: '<svg class="nav-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>',
      route: '/catalogos'
    },
  ]

  /* ════════════════════════════════════════════════════════
     SIDEBAR
     ════════════════════════════════════════════════════════ */

  function setSidebarCollapsed(collapsed) {
    sidebarCollapsed = collapsed;
    if (!sidebar || !mainContent) return;

    if (collapsed) {
      sidebar.classList.add('collapsed');
      mainContent.classList.add('sidebar-collapsed');
    } else {
      sidebar.classList.remove('collapsed');
      mainContent.classList.remove('sidebar-collapsed');
    }

    // Toggle button label/icon
    if (toggleLabel) toggleLabel.textContent = collapsed ? '' : 'Colapsar';
    if (toggleIcon)  updateToggleIcon(collapsed);
  }

  function updateToggleIcon(collapsed) {
    if (!toggleIcon) return;
    // PanelLeftOpen when collapsed (click to expand), PanelLeftClose when expanded (click to collapse)
    toggleIcon.innerHTML = collapsed
      ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/><path d="m14 9 3 3-3 3"/></svg>'
      : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/><path d="m16 15-3-3 3-3"/></svg>';
  }

  function initSidebar() {
    sidebar    = document.getElementById('app-sidebar');
    mainContent= document.getElementById('main-content');
    toggleBtn  = document.getElementById('sidebar-toggle');
    toggleLabel= document.getElementById('sidebar-toggle-label');
    toggleIcon = document.getElementById('sidebar-toggle-icon');

    if (!sidebar || !toggleBtn) return;

    var savedSidebar = window.storageManager && typeof window.storageManager.loadUIState === 'function'
      ? window.storageManager.loadUIState('sidebar')
      : null;

    if (savedSidebar && savedSidebar.collapsed === true) {
      setSidebarCollapsed(true);
    }

    // Enable transitions only after initial state is painted (avoids flash)
    requestAnimationFrame(function () {
      sidebar.classList.add('sidebar-ready');
      if (mainContent) mainContent.classList.add('sidebar-ready');
    });

    toggleBtn.addEventListener('click', function () {
      setSidebarCollapsed(!sidebarCollapsed);
      if (!window.storageManager) return;

      if (sidebarCollapsed && typeof window.storageManager.saveUIState === 'function') {
        window.storageManager.saveUIState('sidebar', { collapsed: true });
      } else if (!sidebarCollapsed && typeof window.storageManager.clearUIState === 'function') {
        window.storageManager.clearUIState('sidebar');
      }
    });

    // Prevent reload when clicking the link to the current page
    document.querySelectorAll('#app-sidebar .nav-item').forEach(function (link) {
      link.addEventListener('click', function (e) {
        var destino = e.currentTarget.getAttribute('href');
        var actual = window.location.pathname;
        if (destino && actual.endsWith(destino)) {
          e.preventDefault();
        }
      });
    });
  }

  /* ════════════════════════════════════════════════════════
     MOBILE MENU
     ════════════════════════════════════════════════════════ */

  function setMobileOpen(open) {
    mobileOpen = open;
    if (!sidebar) return;

    if (open) {
      sidebar.classList.add('mobile-open');
      if (mobileOverlay) mobileOverlay.classList.add('visible');
      document.body.style.overflow = 'hidden';
    } else {
      sidebar.classList.remove('mobile-open');
      if (mobileOverlay) mobileOverlay.classList.remove('visible');
      document.body.style.overflow = '';
    }
  }

  function initMobileMenu() {
    mobileOverlay = document.getElementById('mobile-overlay');
    mobileMenuBtn = document.getElementById('mobile-menu-btn');

    if (mobileMenuBtn) {
      mobileMenuBtn.addEventListener('click', function () {
        setMobileOpen(!mobileOpen);
      });
    }

    if (mobileOverlay) {
      mobileOverlay.addEventListener('click', function () {
        setMobileOpen(false);
      });
    }

    // Auto-close on desktop resize
    window.addEventListener('resize', function () {
      if (window.innerWidth >= 1024 && mobileOpen) {
        setMobileOpen(false);
      }
    });
  }

  /* ════════════════════════════════════════════════════════
     ACTIVE NAV
     ════════════════════════════════════════════════════════ */

  function initActiveNav() {
    var navLinks = document.querySelectorAll('#app-sidebar .nav-item');
    var currentPath = window.location.pathname;

    // Also handle file:// protocol — use the filename
    if (window.location.protocol === 'file:') {
      var parts = window.location.pathname.split('/');
      currentPath = '/' + parts[parts.length - 1].replace('.html', '');
    }

    navLinks.forEach(function (link) {
      var href = link.getAttribute('href') || '';
      // Normalise href (remove .html, ensure leading slash)
      var normHref = href.replace('.html', '');
      if (!normHref.startsWith('/')) normHref = '/' + normHref;

      var normPath = currentPath.replace('.html', '');

      if (normPath === normHref || normPath.startsWith(normHref + '/') ||
          (normHref.length > 1 && normPath.includes(normHref.replace('/', '')))) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });
  }

  // Expose selected helpers for page-specific scripts that invoke them directly.
  window.initActiveNav = initActiveNav;

  /* ════════════════════════════════════════════════════════
     PROFILE DROPDOWN
     ════════════════════════════════════════════════════════ */

  function initProfileDropdown() {
    profileTrigger  = document.getElementById('profile-trigger');
    profileDropdown = document.getElementById('profile-dropdown');

    if (!profileTrigger || !profileDropdown) return;

    profileTrigger.addEventListener('click', function (e) {
      e.stopPropagation();
      var isOpen = !profileDropdown.classList.contains('hidden');
      closeAllDropdowns();
      if (!isOpen) {
        profileDropdown.classList.remove('hidden');
        profileDropdown.dataset.state = 'open';
      }
    });

    // Override inline logout onclick on all dropdown danger buttons
    if (profileDropdown) {
      profileDropdown.querySelectorAll('.dropdown-item-danger').forEach(function (btn) {
        btn.onclick = function (e) {
          e.preventDefault();
          doLogout();
        };
      });
    }

    // Close on outside click
    document.addEventListener('click', function () {
      closeAllDropdowns();
    });
  }

  function closeAllDropdowns() {
    document.querySelectorAll('.dropdown-menu').forEach(function (dd) {
      dd.classList.add('hidden');
      dd.dataset.state = 'closed';
      dd.style.top = '';
      dd.style.left = '';
      dd.style.position = '';
    });
  }
  window.closeAllDropdowns = closeAllDropdowns;

  /* ════════════════════════════════════════════════════════
     SESSION GUARD & PERMISSIONS
     ════════════════════════════════════════════════════════ */

  function isLoginPage() {
    return window.location.pathname.indexOf('login.html') !== -1 ||
           window.location.pathname.indexOf('index.html') !== -1 ||
           window.location.pathname === '/';
  }

  function normalizeRoute(path) {
    var value = String(path || '').trim().toLowerCase();
    if (!value) return '';
    value = value.replace(/\\/g, '/');
    if (value.indexOf('?') !== -1) value = value.split('?')[0];
    if (value.indexOf('#') !== -1) value = value.split('#')[0];
    if (value.indexOf('/views/') !== -1) {
      value = '/' + (value.split('/').pop() || '');
    }
    if (value.endsWith('.html')) value = value.slice(0, -5);
    if (!value.startsWith('/')) value = '/' + value;
    return value;
  }

  function currentRouteName() {
    var currentPath = window.location.pathname;
    if (window.location.protocol === 'file:') {
      var parts = window.location.pathname.split('/');
      currentPath = '/' + (parts[parts.length - 1] || '');
    }
    return normalizeRoute(currentPath);
  }

  function firstAllowedRoute(allowedRoutes) {
    var inViewsDir = window.location.pathname.indexOf('/views/') !== -1 ||
      window.location.pathname.indexOf('\\views\\') !== -1;
    var prefix = inViewsDir ? '' : 'views/';
    var defaultOrder = ['/dashboard', '/inventario', '/compras', '/reportes', '/catalogos', '/usuarios'];
    for (var i = 0; i < defaultOrder.length; i += 1) {
      if (allowedRoutes.indexOf(defaultOrder[i]) !== -1) {
        return prefix + defaultOrder[i].replace(/^\//, '') + '.html';
      }
    }
    return prefix + 'dashboard.html';
  }

  function applyNavPermissions(role) {
    var allowedByRole = {
      administrador: ['/dashboard', '/inventario', '/compras', '/reportes', '/usuarios', '/catalogos'],
      gerente: ['/dashboard', '/inventario', '/compras', '/reportes'],
      encargado_area: ['/dashboard', '/inventario'],
      encargado_compras: ['/compras', '/reportes']
    };

    var normalizedRole = String(role || '').trim().toLowerCase();
    if (['administrador', 'gerente', 'encargado_area', 'encargado_compras'].indexOf(normalizedRole) === -1 ) {
      doLogout();
      return false;
    }

    var allowedRoutes = allowedByRole[normalizedRole];
    var navContainer = document.getElementById('sidebar-nav');

    // 1. Limpiamos sidebar
    if (navContainer) navContainer.innerHTML = '';

    // 2. Insertamos solo los nav items permitidos en base al rol
    MENU_ITEMS.forEach(function(item) {
      if (allowedRoutes.indexOf(item.route) != -1) {
        var link = document.createElement('a');
        link.href = item.href;
        link.className = 'nav-item';
        link.title = item.label;
        link.innerHTML = item.icon + '<span class="nav-item-label">' + item.label + '</span>';

        if (navContainer) navContainer.appendChild(link);
      }
    })

    // 3. Comprobar si está en una ruta no permitida y redirigir 
    var currentRoute = currentRouteName();
    if (currentRoute && currentRoute !== '/' && allowedRoutes.indexOf(currentRoute) === -1) {
      window.location.href = firstAllowedRoute(allowedRoutes);
      return false;
    }

    return true;
  }

  function doLogout() {
    var token = localStorage.getItem('as_token');
    if (token) {
      window.apiClient.post('/auth/logout').catch(function () { /* fire and forget */ });
    }
    localStorage.removeItem('as_token');
    localStorage.removeItem('as_expires_at');
    localStorage.removeItem('as_role');
    localStorage.removeItem('as_nombre');
    if (window.storageManager && typeof window.storageManager.clearAll === 'function') {
      window.storageManager.clearAll();
    }
    window.location.href = '../views/login.html';
  }

  function roleLabel(role) {
    var labels = {
      administrador: 'Administrador',
      gerente: 'Gerente',
      encargado_area: 'Encargado de área',
      encargado_compras: 'Encargado de compras'
    };
    return labels[role] || role || '';
  }

  function getUserSnapshot() {
    return {
      nombre: localStorage.getItem('as_nombre') || '',
      email: localStorage.getItem('as_email') || '',
      role: localStorage.getItem('as_role') || ''
    };
  }

  function setUserInTopbar(user) {
    var nombre = user && user.nombre ? user.nombre : '';
    var email = user && user.email ? user.email : '';

    document.querySelectorAll('#profile-dropdown .profile-menu-header .font-medium').forEach(function (el) {
      el.textContent = nombre || 'Usuario';
    });
    document.querySelectorAll('#profile-dropdown .profile-menu-header .text-xs.text-muted').forEach(function (el) {
      el.textContent = email || 'Sin correo';
    });
  }

  function setUserInProfileModal(user) {
    var nombre = user && user.nombre ? user.nombre : '';
    var email = user && user.email ? user.email : '';
    var role = user && user.role ? user.role : '';

    var nameEl = document.getElementById('p-name');
    if (nameEl) nameEl.value = nombre;

    var emailEl = document.getElementById('p-email');
    if (emailEl) emailEl.value = email;

    var roleEl = document.getElementById('p-role');
    if (roleEl) roleEl.value = roleLabel(role);

    var areaEl = document.getElementById('p-area');
    if (areaEl && !areaEl.value) areaEl.value = 'General';
  }

  function ensureProfileMenuAction() {
    document.querySelectorAll('#profile-dropdown').forEach(function (dropdown) {
      var existing = Array.prototype.find.call(dropdown.querySelectorAll('.dropdown-item'), function (btn) {
        return (btn.textContent || '').trim().toLowerCase() === 'mi perfil';
      });

      if (!existing) {
        var insertBefore = dropdown.querySelector('.dropdown-item-danger') || dropdown.querySelector('.separator');
        var sep = document.createElement('hr');
        sep.className = 'separator';

        var btn = document.createElement('button');
        btn.className = 'dropdown-item';
        btn.setAttribute('role', 'menuitem');
        btn.textContent = 'Mi Perfil';
        btn.addEventListener('click', function () {
          hydrateProfileFromLocalStorage();
          hydrateProfileFromApi();
          if (window.modalManager) window.modalManager.open('modal-profile');
        });

        if (insertBefore) {
          dropdown.insertBefore(sep, insertBefore);
          dropdown.insertBefore(btn, insertBefore);
        } else {
          dropdown.appendChild(sep);
          dropdown.appendChild(btn);
        }
      } else {
        existing.onclick = function (e) {
          e.preventDefault();
          hydrateProfileFromLocalStorage();
          hydrateProfileFromApi();
          if (window.modalManager) window.modalManager.open('modal-profile');
        };
      }
    });
  }

  function profileModalMarkup() {
    return ''
      + '<div class="modal-dialog modal-panel">'
      + '  <div class="modal-header">'
      + '    <h2 id="modal-profile-title" class="modal-title">Mi Perfil</h2>'
      + '  </div>'
      + '  <div class="modal-body">'
      + '    <div class="modal-tabs-container">'
      + '      <div class="modal-tabs-list" role="tablist">'
      + '        <button class="modal-tab-trigger active" role="tab" aria-selected="true" data-tab-target="profile-info-panel">Información</button>'
      + '        <button class="modal-tab-trigger" role="tab" aria-selected="false" data-tab-target="profile-password-panel">Contraseña</button>'
      + '      </div>'
      + '      <div id="profile-info-panel" class="tab-panel modal-tab-panel active" role="tabpanel">'
      + '        <div style="display:flex; flex-direction:column; align-items:center; margin-bottom:20px;">'
      + '          <div class="avatar avatar-xl" style="margin-bottom:12px;">'
      + '            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>'
      + '          </div>'
      + '        </div>'
      + '        <div class="field-group">'
      + '          <div class="field"><label class="field-label" for="p-name">Nombre</label><input id="p-name" class="input" type="text" readonly></div>'
      + '          <div class="field"><label class="field-label" for="p-email">Correo</label><input id="p-email" class="input" type="email" readonly></div>'
      + '          <div class="field"><label class="field-label" for="p-role">Rol</label><input id="p-role" class="input" type="text" readonly></div>'
      + '          <div class="field"><label class="field-label" for="p-area">Área</label><input id="p-area" class="input" type="text" value="General" readonly></div>'
      + '        </div>'
      + '      </div>'
      + '      <div id="profile-password-panel" class="tab-panel modal-tab-panel" role="tabpanel" aria-hidden="true">'
      + '        <div class="field-group">'
      + '          <div class="field"><label class="field-label" for="p-curr-pass">Contraseña actual</label><input id="p-curr-pass" class="input" type="password" placeholder="••••••••"></div>'
      + '          <div class="field"><label class="field-label" for="p-new-pass">Nueva contraseña</label><input id="p-new-pass" class="input" type="password" placeholder="••••••••"></div>'
      + '          <div class="field"><label class="field-label" for="p-confirm-pass">Confirmar contraseña</label><input id="p-confirm-pass" class="input" type="password" placeholder="••••••••"></div>'
      + '        </div>'
      + '      </div>'
      + '    </div>'
      + '  </div>'
      + '  <div class="modal-footer">'
      + '    <button type="button" class="btn btn-outline" data-modal-close="modal-profile">Cerrar</button>'
      + '    <button type="button" class="btn btn-primary" onclick="saveProfile()">Guardar</button>'
      + '  </div>'
      + '</div>';
  }

  function ensureUnifiedProfileModal() {
    var existing = document.getElementById('modal-profile');
    if (existing) existing.remove();

    var modal = document.createElement('div');
    modal.id = 'modal-profile';
    modal.className = 'modal-backdrop hidden';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'modal-profile-title');
    modal.setAttribute('data-state', 'closed');
    modal.innerHTML = profileModalMarkup();
    document.body.appendChild(modal);
  }

  function ensureSaveProfileAction() {
    if (typeof window.saveProfile === 'function') return;
    window.saveProfile = function () {
      var currPass = document.getElementById('p-curr-pass');
      var newPass = document.getElementById('p-new-pass');
      var confirm = document.getElementById('p-confirm-pass');

      if (newPass && newPass.value) {
        if (!currPass || !currPass.value) {
          if (typeof showToast === 'function') showToast('Ingresa tu contraseña actual', 'error');
          return;
        }
        if (newPass.value !== (confirm ? confirm.value : '')) {
          if (typeof showToast === 'function') showToast('Las contraseñas no coinciden', 'error');
          return;
        }
        if (newPass.value.length < 6) {
          if (typeof showToast === 'function') showToast('La contraseña debe tener al menos 6 caracteres', 'error');
          return;
        }
      }

      // TODO F5: guardar perfil
      if (typeof showToast === 'function') {
        showToast('Actualización de perfil lista (endpoint pendiente)', 'success');
      }
      if (window.modalManager) window.modalManager.close('modal-profile');
    };
  }

  function hydrateProfileFromLocalStorage() {
    var user = getUserSnapshot();
    setUserInTopbar(user);
    setUserInProfileModal(user);
  }

  async function hydrateProfileFromApi() {
    var token = localStorage.getItem('as_token');
    if (!token || !window.apiClient) return;

    try {
      var response = await window.apiClient.get('/auth/me');
      var me = response && response.data ? response.data : null;
      if (!me) return;

      if (me.nombre) localStorage.setItem('as_nombre', me.nombre);
      if (me.email) localStorage.setItem('as_email', me.email);
      
      var oldRole = localStorage.getItem('as_role');
      if (me.role) {
        localStorage.setItem('as_role', me.role);
        // Si el rol guardado estaba desincronizado (o modificado manualmente), reevaluamos los permisos:
        if (oldRole !== me.role) {
          applyNavPermissions(me.role);
          initActiveNav();
        }
      }

      setUserInTopbar({
        nombre: me.nombre || '',
        email: me.email || '',
        role: me.role || ''
      });
      setUserInProfileModal({
        nombre: me.nombre || '',
        email: me.email || '',
        role: me.role || ''
      });
    } catch (_) {
      // Si falla /auth/me mantenemos fallback local.
    }
  }

  /* ════════════════════════════════════════════════════════
     INIT
     ════════════════════════════════════════════════════════ */

  function init() {
    window.addEventListener('storage', function(e) {
      if (e.key === 'as_token' && !e.newValue) {
        // El token fue eliminado en otra pestaña (logout)
        window.location.href = '../views/login.html';
      }
    });

    // ── Session guard ────────────────────────────────────
    if (!isLoginPage()) {
      var token = localStorage.getItem('as_token');
      if (!token) {
        window.location.href = '../views/login.html';
        return;
      }

      var expiresAt = localStorage.getItem('as_expires_at');
      if (expiresAt && Date.now() / 1000 > parseInt(expiresAt, 10)) {
        localStorage.removeItem('as_token');
        localStorage.removeItem('as_expires_at');
        localStorage.removeItem('as_role');
        localStorage.removeItem('as_nombre');
        if (typeof showToast === 'function') showToast('Tu sesión expiró', 'warning');
        window.location.href = '../views/login.html';
        return;
      }

      var role = localStorage.getItem('as_role');
      var canStayOnPage = applyNavPermissions(role);
      if (!canStayOnPage) return;

      ensureUnifiedProfileModal();
      ensureSaveProfileAction();
      ensureProfileMenuAction();
      hydrateProfileFromLocalStorage();
      hydrateProfileFromApi();

      // No bloquear la UI mientras cargan los catálogos
      initPageData(); // Sin await — carga en background
    }
    // ─────────────────────────────────────────────────────

    initSidebar();
    initMobileMenu();
    initActiveNav();
    initProfileDropdown();
  }

  // Ejecutamos inicialización de inmediato (ya que layout.js carga al final del body)
  // Esto evita el parpadeo (FOUC) provocado por esperar a DOMContentLoaded
  init();

  async function initPageData() {
    try {
      store.setState({ ui: { loading: true } });

      var catalogs = await window.CatalogService.getAllCatalogs();
      store.setState({
        catalogs: catalogs,
        ui: { loading: false }
      });
    } catch (err) {
      store.setState({ ui: { loading: false, error: err.message } });
      // Solo mostrar toast si es un error real (no 401,
      // el apiClient ya maneja ese caso con redirect)
      if (err.status !== 401) {
        showToast('Error cargando catálogos. Recarga la página.', 'error');
      }
    }
  }

})();
