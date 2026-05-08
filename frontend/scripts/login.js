/**
 * login.js
 * Toggle de contraseña, validación, spinner de carga y redirección
 * al dashboard. Fuerza cambio de contraseña si el backend lo indica.
 */
import { MSG } from './constants/messages.js';

const form          = document.getElementById('login-form');
const identifierInput = document.getElementById('identifier');
const passInput     = document.getElementById('password');
const toggleBtn     = document.getElementById('password-toggle');
const iconEye       = document.getElementById('icon-eye');
const iconEyeOff    = document.getElementById('icon-eye-off');
const submitBtn     = document.getElementById('submit-btn');
const submitLabel   = document.getElementById('submit-label');
const submitSpinner = document.getElementById('submit-spinner');
const rememberChk   = document.getElementById('remember-user');

let showPassword = false;

if (window.initThemeSwitcher) window.initThemeSwitcher();

const savedIdentifier = localStorage.getItem('as_remember_identifier');
if (savedIdentifier && identifierInput) {
  identifierInput.value = savedIdentifier;
  if (rememberChk) rememberChk.checked = true;
}

function getDashboardHref() {
  const path = window.location?.pathname || '';
  const inViews = path.includes('/views/') || path.includes('\\views\\');
  return inViews ? 'dashboard.html' : 'views/dashboard.html';
}

function setLoading(loading) {
  if (!submitBtn || !submitLabel || !submitSpinner) return;
  submitBtn.disabled           = loading;
  submitLabel.textContent      = loading ? MSG.AUTH.LOADING : MSG.AUTH.SUBMIT;
  submitSpinner.classList.toggle('hidden', !loading);
}

// ── Toggle contraseña ─────────────────────────────────────────────────────

toggleBtn?.addEventListener('click', () => {
  showPassword = !showPassword;
  passInput.type = showPassword ? 'text' : 'password';
  iconEye.classList.toggle('hidden', showPassword);
  iconEyeOff.classList.toggle('hidden', !showPassword);
  toggleBtn.style.color = showPassword ? 'var(--foreground)' : 'var(--foreground-muted)';
});

// ── Submit ────────────────────────────────────────────────────────────────

form?.addEventListener('submit', async e => {
  e.preventDefault();

  const identifier = identifierInput?.value.trim() || '';
  const password   = passInput?.value.trim()       || '';

  if (!identifier || !password) {
    showToast(MSG.AUTH.FIELDS_REQUIRED, 'error');
    return;
  }

  setLoading(true);

  try {
    if (typeof window.apiClient?.post !== 'function') throw new Error(MSG.AUTH.API_UNAVAILABLE);

    const result = await window.apiClient.post('/auth/login', { identifier, password });

    if (!result || result.success !== true) {
      showToast(result?.error || MSG.AUTH.CONNECTION_ERROR, 'error');
      return;
    }

    const data = result.data || {};
    if (!data.token) throw new Error(MSG.AUTH.TOKEN_MISSING);

    localStorage.setItem('as_token',      data.token);
    localStorage.setItem('as_expires_at', data.expires_at);
    localStorage.setItem('as_role',       data.role);
    localStorage.setItem('as_nombre',     data.nombre);
    if (data.user_id) localStorage.setItem('as_user_id', data.user_id);

    if (rememberChk?.checked) {
      localStorage.setItem('as_remember_identifier', identifier);
    } else {
      localStorage.removeItem('as_remember_identifier');
    }

    if (data.debe_cambiar_password === true) {
      localStorage.setItem('debe_cambiar_password', '1');
      showToast(MSG.PASSWORD.FORCE_CHANGE_REQUIRED, 'warning', 4000);
      setTimeout(promptForcePasswordChange, 250);
      return;
    }

    showToast(MSG.AUTH.WELCOME(data.nombre), 'success');
    window.location.href = getDashboardHref();
  } catch (err) {
    if (err?.status === 401) {
      showToast(MSG.AUTH.CREDENTIALS_INVALID, 'error');
      if (passInput) passInput.value = '';
      return;
    }
    if (err?.status === 403) {
      showToast(MSG.AUTH.ACCOUNT_LOCKED, 'error');
      if (passInput) passInput.value = '';
      return;
    }
    showToast(err?.message || MSG.AUTH.CONNECTION_ERROR, 'error');
  } finally {
    setLoading(false);
  }
});

// ── Cambio forzado de contraseña ──────────────────────────────────────────

async function promptForcePasswordChange() {
  const nueva = prompt('Ingresa tu nueva contraseña (mín. 6 chars):');
  if (!nueva || nueva.length < 6) {
    showToast(MSG.PASSWORD.FORCE_CHANGE_INVALID, 'warning', 4000);
    return;
  }

  try {
    if (typeof window.apiClient?.post !== 'function') throw new Error(MSG.AUTH.API_UNAVAILABLE);
    await window.apiClient.post('/usuarios/cambiar-password', { password: nueva });
    localStorage.removeItem('debe_cambiar_password');
    window.location.href = getDashboardHref();
  } catch (err) {
    showToast(err?.message || MSG.PASSWORD.CHANGE_FAILED, 'error');
  }
}
