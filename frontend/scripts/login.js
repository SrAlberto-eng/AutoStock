/**
 * Script: login.js
 * Vista asociada: views/login.html
 * Dependencias: toast.js
 * Descripción: Lógica de la pantalla de inicio de sesión.
 *              - Toggle de visibilidad de contraseña
 *              - Validación del formulario (campos no vacíos)
 *              - Spinner de carga durante el proceso
 *              - Redirección a dashboard.html tras login exitoso
 */
import { MSG } from './constants/messages.js';

  var form         = document.getElementById('login-form');
  var identifierInput   = document.getElementById('identifier');
  var passInput    = document.getElementById('password');
  var toggleBtn    = document.getElementById('password-toggle');
  var iconEye      = document.getElementById('icon-eye');
  var iconEyeOff   = document.getElementById('icon-eye-off');
  var submitBtn    = document.getElementById('submit-btn');
  var submitLabel  = document.getElementById('submit-label');
  var submitSpinner= document.getElementById('submit-spinner');

  var rememberChk  = document.getElementById('remember-user');
  var showPassword = false;

  if (window.initThemeSwitcher) window.initThemeSwitcher();

  // Restore remembered identifier
  var savedIdentifier = localStorage.getItem('as_remember_identifier');
  if (savedIdentifier && identifierInput) {
    identifierInput.value = savedIdentifier;
    if (rememberChk) rememberChk.checked = true;
  }

  function getDashboardHref() {
    var path = (window.location && window.location.pathname) ? window.location.pathname : '';
    var inViewsDir = path.indexOf('/views/') !== -1 || path.indexOf('\\views\\') !== -1;
    return inViewsDir ? 'dashboard.html' : 'views/dashboard.html';
  }

  /* ─── Toggle contraseña ─────────────────────────────── */
  if (toggleBtn) {
    toggleBtn.addEventListener('click', function () {
      showPassword = !showPassword;
      passInput.type = showPassword ? 'text' : 'password';
      iconEye.classList.toggle('hidden', showPassword);
      iconEyeOff.classList.toggle('hidden', !showPassword);
      toggleBtn.style.color = showPassword ? 'var(--foreground)' : 'var(--foreground-muted)';
    });
  }

  /* ─── Submit ─────────────────────────────────────────── */
  if (form) {
    form.addEventListener('submit', async function (e) {
      e.preventDefault();

      var identifier = identifierInput ? identifierInput.value.trim() : '';
      var password = passInput  ? passInput.value.trim()  : '';

      if (!identifier || !password) {
        showToast(MSG.AUTH.FIELDS_REQUIRED, 'error');
        return;
      }

      // Show loading state
      setLoading(true);

      try {
        if (!window.apiClient || typeof window.apiClient.post !== 'function') {
          throw new Error(MSG.AUTH.API_UNAVAILABLE);
        }

        var result = await window.apiClient.post('/auth/login', {
          identifier: identifier,
          password: password
        });

        if (!result || result.success !== true) {
          showToast((result && result.error) || MSG.AUTH.CONNECTION_ERROR, 'error');
          return;
        }

        var data = result.data || {};
        if (!data.token) {
          throw new Error(MSG.AUTH.TOKEN_MISSING);
        }

        localStorage.setItem('as_token',      data.token);
        localStorage.setItem('as_expires_at', data.expires_at);
        localStorage.setItem('as_role',       data.role);
        localStorage.setItem('as_nombre',     data.nombre);
        if (data.user_id) localStorage.setItem('as_user_id', data.user_id);

        // Remember user
        if (rememberChk && rememberChk.checked) {
          localStorage.setItem('as_remember_identifier', identifier);
        } else {
          localStorage.removeItem('as_remember_identifier');
        }

        if (data.debe_cambiar_password === true) {
          localStorage.setItem('debe_cambiar_password', '1');
          showToast(MSG.PASSWORD.FORCE_CHANGE_REQUIRED, 'warning', 4000);
          setTimeout(function () {
            promptForcePasswordChange();
          }, 250);
          return;
        }

        showToast(MSG.AUTH.WELCOME(data.nombre), 'success');
        setLoading(false);
        window.location.href = getDashboardHref();
        return;
      } catch (err) {
        if (err && err.status === 401) {
          showToast(MSG.AUTH.CREDENTIALS_INVALID, 'error');
          if (passInput) passInput.value = '';
          return;
        }

        if (err && err.status === 403) {
          showToast(MSG.AUTH.ACCOUNT_LOCKED, 'error');
          if (passInput) passInput.value = '';
          return;
        }

        var errorResult = {
          success: false,
          data: null,
          error: (err && err.message) || MSG.AUTH.CONNECTION_ERROR
        };
        showToast(errorResult.error, 'error');
      } finally {
        setLoading(false);
      }
    });
  }

  function setLoading(loading) {
    if (!submitBtn || !submitLabel || !submitSpinner) return;
    submitBtn.disabled = loading;
    submitLabel.textContent = loading ? MSG.AUTH.LOADING : MSG.AUTH.SUBMIT;
    submitSpinner.classList.toggle('hidden', !loading);
  }

  async function promptForcePasswordChange() {
    var nueva = prompt('Ingresa tu nueva contraseña (mín. 6 chars):');
    if (!nueva || nueva.length < 6) {
      showToast(MSG.PASSWORD.FORCE_CHANGE_INVALID, 'warning', 4000);
      return;
    }

    try {
      if (!window.apiClient || typeof window.apiClient.post !== 'function') {
        throw new Error(MSG.AUTH.API_UNAVAILABLE);
      }

      await window.apiClient.post('/usuarios/cambiar-password', { password: nueva });
      localStorage.removeItem('debe_cambiar_password');
      window.location.href = getDashboardHref();
    } catch (err) {
      showToast((err && err.message) || MSG.PASSWORD.CHANGE_FAILED, 'error');
    }
  }
