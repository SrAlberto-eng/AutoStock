/**
 * usuarios.js
 * Filtros de búsqueda, apertura del modal de usuario (nuevo / editar),
 * validación y guardado del formulario.
 */

let usersFilterEngine = null;
let usuariosItems = [];
const USUARIOS_VIEW_NAME = 'usuarios';
const ROLE_OPTIONS = [
  { value: 'administrador', label: 'Administrador' },
  { value: 'gerente', label: 'Gerente' },
  { value: 'encargado_area', label: 'Encargado de área' },
  { value: 'encargado_compras', label: 'Encargado de compras' },
];

function getCurrentRole() {
  return String(localStorage.getItem('as_role') || '').trim().toLowerCase();
}

function isAdminUser() {
  return getCurrentRole() === 'administrador';
}

function ensureAdminAccess() {
  if (isAdminUser()) return true;
  showToast('Solo administrador puede ejecutar esta operación', 'error');
  return false;
}

function populateRoleOptions() {
  var roleFilter = document.getElementById('filter-role');
  var roleSelect = document.getElementById('user-role');

  if (roleFilter) {
    var selectedFilter = roleFilter.value;
    roleFilter.innerHTML = '<option value="">Todos los roles</option>'
      + ROLE_OPTIONS.map(function (role) {
        return '<option value="' + role.value + '">' + window.escapeHtml(role.label) + '</option>';
      }).join('');
    roleFilter.value = selectedFilter;
  }

  if (roleSelect) {
    var selectedRole = roleSelect.value;
    roleSelect.innerHTML = '<option value="">Seleccionar rol...</option>'
      + ROLE_OPTIONS.map(function (role) {
        return '<option value="' + role.value + '">' + window.escapeHtml(role.label) + '</option>';
      }).join('');
    roleSelect.value = selectedRole;
  }
}

function saveUsuariosUIState() {
  if (!window.storageManager || typeof window.storageManager.saveUIState !== 'function') return;

  var searchInput = document.getElementById('usuarios-search');
  var roleFilter = document.getElementById('filter-role');
  var areaFilter = document.getElementById('filter-area-u');
  window.storageManager.saveUIState(USUARIOS_VIEW_NAME, {
    nombre: searchInput ? searchInput.value || '' : '',
    rol: roleFilter ? roleFilter.value || '' : '',
    area_id: areaFilter ? areaFilter.value || '' : '',
  });
}

function restoreUsuariosUIState() {
  if (!window.storageManager || typeof window.storageManager.loadUIState !== 'function') return;

  var saved = window.storageManager.loadUIState(USUARIOS_VIEW_NAME);
  if (!saved) return;

  var searchInput = document.getElementById('usuarios-search');
  var roleFilter = document.getElementById('filter-role');
  var areaFilter = document.getElementById('filter-area-u');
  if (searchInput && saved.nombre != null) searchInput.value = String(saved.nombre);
  if (roleFilter && saved.rol != null) roleFilter.value = String(saved.rol);
  if (areaFilter && saved.area_id != null) areaFilter.value = String(saved.area_id);
}

document.addEventListener('DOMContentLoaded', async () => {
  initActiveNav();

  var createBtn = document.getElementById('btn-new-user');
  if (createBtn && !isAdminUser()) {
    createBtn.style.display = 'none';
  }

  await ensureAreasLoaded();
  populateRoleOptions();
  populateAreaSelects();
  restoreUsuariosUIState();

  usersFilterEngine = new FilterEngine({
    rowSelector: '#usuarios-tbody tr',
    getCriteria: function () {
      return {
        searchVal: (document.getElementById('usuarios-search').value || '').trim().toLowerCase(),
        role: (document.getElementById('filter-role').value || '').toLowerCase(),
        area: (document.getElementById('filter-area-u').value || '').toLowerCase(),
      };
    },
    mapRow: function (row) {
      return {
        rowName: (row.dataset.name || '').toLowerCase(),
        rowEmail: (row.dataset.email || '').toLowerCase(),
        rowRole: (row.dataset.role || '').toLowerCase(),
        rowArea: (row.dataset.area || '').toLowerCase(),
      };
    },
    predicates: [
      function (criteria, rowData) {
        return !criteria.searchVal || rowData.rowName.includes(criteria.searchVal) || rowData.rowEmail.includes(criteria.searchVal);
      },
      function (criteria, rowData) {
        return !criteria.role || rowData.rowRole === criteria.role;
      },
      function (criteria, rowData) {
        return !criteria.area || rowData.rowArea === criteria.area;
      },
    ],
    setEmptyState: function (result) {
      const emptyMsg = document.getElementById('usuarios-empty');
      if (emptyMsg) emptyMsg.style.display = result.visible === 0 ? 'block' : 'none';
    },
  });

  usersFilterEngine.bindTriggers([
    { selector: '#usuarios-search', event: 'input' },
    { selector: '#filter-role', event: 'change' },
    { selector: '#filter-area-u', event: 'change' },
  ]);

  var searchInput = document.getElementById('usuarios-search');
  var roleFilter = document.getElementById('filter-role');
  var areaFilter = document.getElementById('filter-area-u');
  if (searchInput) searchInput.addEventListener('input', saveUsuariosUIState);
  if (roleFilter) roleFilter.addEventListener('change', saveUsuariosUIState);
  if (areaFilter) areaFilter.addEventListener('change', saveUsuariosUIState);

  // Show "Mostrar inactivos" checkbox only for admin
  var inactiveLabel = document.getElementById('label-show-inactive-users');
  if (inactiveLabel && isAdminUser()) {
    inactiveLabel.style.display = 'flex';
  }
  var showInactiveChk = document.getElementById('chk-show-inactive-users');
  if (showInactiveChk) {
    showInactiveChk.addEventListener('change', function () {
      loadUsuarios();
    });
  }

  await loadUsuarios();
  applyFilters();
  saveUsuariosUIState();
});

async function ensureAreasLoaded() {
  const state = window.store.getState();
  if (state.catalogs?.areas?.length) {
    return state.catalogs.areas;
  }

  const catalogs = await window.CatalogService.getAllCatalogs();
  window.store.setState({ catalogs: { areas: catalogs.areas || [] } });
  return catalogs.areas || [];
}

function normalizeValue(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-');
}

function getAreaNameById(areaId) {
  const areas = window.store.getState().catalogs?.areas || [];
  const match = areas.find(area => String(area.id) === String(areaId));
  return match ? match.nombre : '';
}

function populateAreaSelects() {
  const areas = window.store.getState().catalogs?.areas || [];
  const modalSelect = document.getElementById('user-area');
  const filterSelect = document.getElementById('filter-area-u');

  if (modalSelect) {
    const selected = modalSelect.value;
    modalSelect.innerHTML = '<option value="">Seleccionar área...</option>'
      + areas.map(area => `<option value="${area.id}">${window.escapeHtml(area.nombre)}</option>`).join('');
    modalSelect.value = selected;
  }

  if (filterSelect) {
    const selected = filterSelect.value;
    filterSelect.innerHTML = '<option value="">Todas las áreas</option>'
      + areas.map(area => `<option value="${normalizeValue(area.nombre)}">${window.escapeHtml(area.nombre)}</option>`).join('');
    filterSelect.value = selected;
  }
}

async function loadUsuarios() {
  try {
    var showInactive = document.getElementById('chk-show-inactive-users');
    var includeInactive = showInactive && showInactive.checked;
    var res = includeInactive
      ? await window.UserService.getAllIncludeInactive()
      : await window.UserService.getAll();
    const items = res.data?.items || [];
    usuariosItems = items;
    renderTablaUsuarios(items);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderRoleBadge(rol) {
  const normalized = normalizeValue(rol);
  const badgeClass = normalized === 'administrador' ? 'badge badge-primary' : 'badge badge-muted';
  return `<span class="${badgeClass}">${window.escapeHtml(rol)}</span>`;
}

function renderEstadoUsuario(user) {
  const now = new Date();
  const bloqueadoHasta = user.bloqueado_hasta ? new Date(user.bloqueado_hasta) : null;

  if (bloqueadoHasta && !Number.isNaN(bloqueadoHasta.getTime()) && bloqueadoHasta > now) {
    return 'Bloqueado';
  }
  if (user.debe_cambiar_password === true) {
    return 'Sin acceso registrado';
  }
  if (user.sesion_activa === true) {
    return 'Activo';
  }
  return 'Sin registro';
}

function renderTablaUsuarios(items) {
  const tbody = document.getElementById('usuarios-tbody');
  const emptyMsg = document.getElementById('usuarios-empty');
  const miRol = localStorage.getItem('as_role');
  const esAdmin = miRol === 'administrador';
  const currentUserId = getCurrentUserId();
  if (!tbody) {
    return;
  }

  tbody.innerHTML = items.map(user => {
    const areaNombre = user.area_nombre || getAreaNameById(user.area_id) || 'Sin área';
    const estadoUsuario = renderEstadoUsuario(user);
    const activo = user.activo !== false && user.activo !== 0;
    const activoBadge = activo
      ? '<span class="badge badge-success">Activo</span>'
      : '<span class="badge badge-muted">Inactivo</span>';
    const isSelf = currentUserId !== null && user.id === currentUserId;
    const toggleBtn = (esAdmin && !isSelf)
      ? `<button class="btn btn-ghost btn-icon" onclick="toggleUser(${user.id})" aria-label="${activo ? 'Desactivar' : 'Activar'} usuario">` +
        (activo
          ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>'
          : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>')
        + '</button>'
      : '';
    const acciones = (esAdmin && !isSelf)
      ? `
          <div style="display:flex; gap:4px; justify-content:flex-end;">
            <button class="btn btn-ghost btn-icon" onclick="editUser(this)" aria-label="Editar usuario">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path><path d="m15 5 4 4"></path></svg>
            </button>
            <button class="btn btn-ghost btn-icon" onclick="resetUserPassword(${user.id}, '${window.escapeHtml(user.nombre)}')" aria-label="Resetear contraseña">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="18" height="11" x="3" y="11" rx="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
            </button>
            ${toggleBtn}
          </div>
        `
      : '';
    const rowStyle = activo ? '' : ' style="opacity:0.55;"';
    return `
      <tr
        data-user-id="${user.id}"
        data-name="${window.escapeHtml(user.nombre)}"
        data-email="${window.escapeHtml(user.email)}"
        data-role="${window.escapeHtml(user.rol)}"
        data-role-id="${window.escapeHtml(user.role_id)}"
        data-area="${window.escapeHtml(normalizeValue(areaNombre))}"
        data-area-id="${window.escapeHtml(user.area_id || '')}"
        ${rowStyle}
      >
        <td>
          <div style="display:flex; align-items:center; gap:8px;">
            <div class="avatar avatar-sm"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg></div>
            ${window.escapeHtml(user.nombre)}
          </div>
        </td>
        <td>${window.escapeHtml(user.email)}</td>
        <td class="text-center">${renderRoleBadge(user.rol)}</td>
        <td>${window.escapeHtml(areaNombre)}</td>
        <td class="text-center">${window.escapeHtml(estadoUsuario)}</td>
        <td class="text-center">${activoBadge}</td>
        <td class="td-actions">
          ${acciones}
        </td>
      </tr>
    `;
  }).join('');

  if (emptyMsg) emptyMsg.style.display = items.length === 0 ? 'block' : 'none';
  if (usersFilterEngine) usersFilterEngine.apply();
}

// ── Filtering ──────────────────────────────────────────────────────────────
function applyFilters() {
  if (usersFilterEngine) usersFilterEngine.apply();
}

// ── Open modal for new user ────────────────────────────────────────────────
function openUserModal() {
  if (!ensureAdminAccess()) return;
  clearUserModal();
  populateAreaSelects();
  populateRoleOptions();
  document.getElementById('modal-user-title').textContent = 'Nuevo usuario';
  document.getElementById('modal-user-desc').textContent  = 'Completa los datos del nuevo usuario.';
  const passSection = document.getElementById('user-password-section');
  if (passSection) passSection.style.display = 'block';
  modalManager.open('modal-user');
}

// ── Open modal to edit existing user ──────────────────────────────────────
function editUser(btn) {
  if (!ensureAdminAccess()) return;
  const row = btn.closest('tr');
  if (!row) return;

  clearUserModal();
  populateAreaSelects();
  populateRoleOptions();
  document.getElementById('modal-user-title').textContent = 'Editar usuario';
  document.getElementById('modal-user-desc').textContent  = 'Modifica los datos del usuario.';

  document.getElementById('user-editing-id').value = row.dataset.userId || '';
  document.getElementById('user-name').value  = row.dataset.name  || '';
  document.getElementById('user-email').value = row.dataset.email || '';
  document.getElementById('user-role').value  = row.dataset.role  || '';
  document.getElementById('user-area').value  = row.dataset.areaId  || '';

  // Hide temp password for edits
  const passSection = document.getElementById('user-password-section');
  if (passSection) passSection.style.display = 'none';

  modalManager.open('modal-user');
}

// ── Clear form ─────────────────────────────────────────────────────────────
function clearUserModal() {
  ['user-editing-id', 'user-name', 'user-email', 'user-temp-pass'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const roleEl = document.getElementById('user-role');
  const areaEl = document.getElementById('user-area');
  if (roleEl) roleEl.value = '';
  if (areaEl) areaEl.value = '';
}

function getCurrentUserId() {
  var raw = localStorage.getItem('as_user_id');
  return raw ? Number(raw) : null;
}

// ── Save user ──────────────────────────────────────────────────────────────
async function saveUser() {
  if (!ensureAdminAccess()) return;
  const editingId = document.getElementById('user-editing-id').value.trim();
  const name  = document.getElementById('user-name').value.trim();
  const email = document.getElementById('user-email').value.trim();
  const role  = document.getElementById('user-role').value;
  const areaId = document.getElementById('user-area').value;
  const passSection = document.getElementById('user-password-section');
  const isNew = !editingId && passSection && passSection.style.display !== 'none';

  if (!name) {
    showToast('El nombre es requerido', 'error');
    document.getElementById('user-name').focus();
    return;
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showToast('Ingresa un correo válido', 'error');
    document.getElementById('user-email').focus();
    return;
  }
  if (!role) {
    showToast('Selecciona un rol', 'error');
    document.getElementById('user-role').focus();
    return;
  }
  if (isNew) {
    const pass = document.getElementById('user-temp-pass').value;
    if (!pass || pass.length < 6) {
      showToast('La contraseña temporal debe tener al menos 6 caracteres', 'error');
      document.getElementById('user-temp-pass').focus();
      return;
    }
  }

  const payload = {
    nombre: name,
    email: email,
    rol: role,
    area_id: areaId ? Number(areaId) : null,
  };

  if (isNew) {
    payload.password = document.getElementById('user-temp-pass').value;
    payload.password_temporal = true;
  }

  try {
    if (isNew) {
      await window.UserService.create(payload);
    } else {
      await window.UserService.update(Number(editingId), payload);
    }

    showToast(`Usuario ${isNew ? 'creado' : 'actualizado'} correctamente`, 'success');
    modalManager.close('modal-user');
    clearUserModal();
    await loadUsuarios();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function resetUserPassword(id, nombre) {
  if (!ensureAdminAccess()) return;
  var displayName = nombre || ('usuario #' + id);
  if (!confirm('¿Generar nueva contraseña temporal para "' + displayName + '"?')) return;
  try {
    const res = await window.UserService.resetPassword(id);
    showToast('Contraseña temporal: ' + res.data.password_temporal, 'info', 8000);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function toggleUser(id) {
  if (!ensureAdminAccess()) return;
  var user = usuariosItems.find(function (u) { return u.id === id; });
  if (!user) return;
  var activo = user.activo !== false && user.activo !== 0;
  var nombre = user.nombre || '';
  var accion = activo ? 'desactivar' : 'activar';

  if (!confirm('¿' + accion.charAt(0).toUpperCase() + accion.slice(1) + ' al usuario "' + nombre + '"?')) return;

  try {
    await window.UserService.toggle(id);
    showToast('Usuario ' + (activo ? 'desactivado' : 'activado'), 'success');
    await loadUsuarios();
  } catch (err) {
    var msg = (err && err.message) ? err.message : 'Error al cambiar estado';
    showToast(msg, 'error');
  }
}

async function deleteUser(btn) {
  if (!ensureAdminAccess()) return;
  const row = btn.closest('tr');
  if (!row) return;

  const id = Number(row.dataset.userId);
  if (!id) return;

  try {
    const res = await window.UserService.softDelete(id);
    if (!res.data?.deleted) {
      throw new Error('No se pudo eliminar el usuario');
    }

    usuariosItems = usuariosItems.filter(user => user.id !== id);
    row.remove();
    if (usersFilterEngine) usersFilterEngine.apply();
    const emptyMsg = document.getElementById('usuarios-empty');
    if (emptyMsg) emptyMsg.style.display = usuariosItems.length === 0 ? 'block' : 'none';
    showToast('Usuario eliminado correctamente', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}
