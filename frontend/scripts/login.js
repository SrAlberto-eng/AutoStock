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

(function () {
  'use strict';

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
      toggleBtn.style.color = showPassword ? '#E6E6E6' : '#A6A6A6';
    });
  }

  /* ─── Submit ─────────────────────────────────────────── */
  if (form) {
    form.addEventListener('submit', async function (e) {
      e.preventDefault();

      var identifier = identifierInput ? identifierInput.value.trim() : '';
      var password = passInput  ? passInput.value.trim()  : '';

      if (!identifier || !password) {
        showToast('Por favor, completa todos los campos', 'error');
        return;
      }

      // Show loading state
      setLoading(true);

      try {
        if (!window.apiClient || typeof window.apiClient.post !== 'function') {
          throw new Error('Cliente API no disponible');
        }

        var result = await window.apiClient.post('/auth/login', {
          identifier: identifier,
          password: password
        });

        if (!result || result.success !== true) {
          showToast((result && result.error) || 'Error de conexión. Verifica que el servidor esté activo.', 'error');
          return;
        }

        var data = result.data || {};
        if (!data.token) {
          throw new Error('Respuesta de login inválida: token no recibido');
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
          showToast('Debes cambiar tu contraseña antes de continuar', 'warning', 4000);
          setTimeout(function () {
            promptForcePasswordChange();
          }, 250);
          return;
        }

        showToast('Bienvenido, ' + data.nombre, 'success');
        setLoading(false);
        window.location.href = getDashboardHref();
        return;
      } catch (err) {
        if (err && err.status === 401) {
          showToast('Credenciales incorrectas', 'error');
          if (passInput) passInput.value = '';
          return;
        }

        if (err && err.status === 403) {
          showToast('Cuenta bloqueada. Contacta al administrador.', 'error');
          if (passInput) passInput.value = '';
          return;
        }

        // Normaliza errores al formato { success, data, error }
        var errorResult = {
          success: false,
          data: null,
          error: (err && err.message) || 'Error de conexión. Verifica que el servidor esté activo.'
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
    submitLabel.textContent = loading ? 'Iniciando sesión...' : 'Iniciar Sesión';
    submitSpinner.classList.toggle('hidden', !loading);
  }

  async function promptForcePasswordChange() {
    var nueva = prompt('Ingresa tu nueva contraseña (mín. 6 chars):');
    if (!nueva || nueva.length < 6) {
      showToast('Debes ingresar una contraseña válida para continuar', 'warning', 4000);
      return;
    }

    try {
      if (!window.apiClient || typeof window.apiClient.post !== 'function') {
        throw new Error('Cliente API no disponible');
      }

      await window.apiClient.post('/usuarios/cambiar-password', { password: nueva });
      localStorage.removeItem('debe_cambiar_password');
      window.location.href = getDashboardHref();
    } catch (err) {
      showToast((err && err.message) || 'No se pudo cambiar la contraseña', 'error');
    }
  }

})();
