/**
 * api-client.js
 * Capa centralizada de comunicación HTTP para AutoStock.
 * Todos los módulos usan este cliente — nadie llama a fetch() directamente.
 *
 * Carga: <script src="../scripts/api-client.js"></script>
 * Uso:   apiClient.get('/productos', { params: { estado: 'activo' } })
 *        apiClient.post('/productos', { nombre, sku, ... })
 */

class ApiClient {
  constructor(config = {}) {
    this.baseURL    = config.baseURL    || 'http://127.0.0.1:8765/api';
    this.timeout    = config.timeout    || 30000;
    this.maxRetries = config.maxRetries !== undefined ? config.maxRetries : 1;
    /** @type {Map<string, Promise>} Deduplicación: key = "METHOD:path" */
    this.inFlight   = new Map();
  }

  // ─── Métodos Públicos ────────────────────────────────────────────────────────

  /**
   * GET request.
   * @param {string} path
   * @param {{ params?: object, headers?: object }} options
   */
  async get(path, options = {}) {
    let fullPath = path;
    if (options.params && Object.keys(options.params).length > 0) {
      const cleanParams = Object.fromEntries(
        Object.entries(options.params).filter(([_, v]) => v !== undefined && v !== null && v !== '')
      );
      if (Object.keys(cleanParams).length > 0) {
        fullPath += '?' + new URLSearchParams(cleanParams).toString();
      }
    }
    return this._request('GET', fullPath, null, options);
  }

  /**
   * POST request.
   * @param {string} path
   * @param {object} body
   * @param {{ params?: object, headers?: object }} options
   */
  async post(path, body, options = {}) {
    return this._request('POST', path, body, options);
  }

  /**
   * PATCH request.
   * @param {string} path
   * @param {object} body
   * @param {{ params?: object, headers?: object }} options
   */
  async patch(path, body, options = {}) {
    return this._request('PATCH', path, body, options);
  }

  /**
   * DELETE request.
   * @param {string} path
   * @param {{ params?: object, headers?: object }} options
   */
  async delete(path, options = {}) {
    return this._request('DELETE', path, null, options);
  }

  /**
   * Limpia estado interno y elimina token del almacenamiento local.
   * Llamar en logout manual antes de redirigir.
   */
  reset() {
    this.inFlight.clear();
    localStorage.removeItem('as_token');
  }

  // ─── Método Core (privado) ───────────────────────────────────────────────────

  /**
   * Ejecuta el request HTTP real.
   * @private
   * @param {string} method
   * @param {string} path      - Ruta relativa (se concatena con baseURL)
   * @param {object|null} body
   * @param {object} options   - { headers, timeout, _retryCount }
   * @returns {Promise<{ success: boolean, data: any, error: null, timestamp: string }>}
   */
  async _request(method, path, body, options) {
    const url        = this.baseURL + path;
    const reqTimeout = options.timeout || this.timeout;
    const dedupeKey  = `${method}:${path}`;
    const isDev      = typeof window !== 'undefined' &&
                       (window.location.hostname === 'localhost' ||
                        window.location.hostname === '127.0.0.1');

    // ── Deduplicación ─────────────────────────────────────────────────────────
    if (this.inFlight.has(dedupeKey)) {
      console.warn(`[ApiClient] Duplicado en flight ignorado: ${dedupeKey}`);
      return this.inFlight.get(dedupeKey);
    }

    // ── AbortController para timeout ──────────────────────────────────────────
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), reqTimeout);

    if (isDev) {
      console.log('[API →]', method, url, body !== null ? body : '');
    }

    const headers     = this._getHeaders(options.headers);
    const fetchOptions = {
      method,
      headers,
      signal: controller.signal,
      ...(body !== null && { body: JSON.stringify(body) })
    };

    const promise = fetch(url, fetchOptions)
      .then(response => this._handleResponse(response, isDev, path))
      .catch(err     => this._handleFetchError(err, method, path, body, options));

    this.inFlight.set(dedupeKey, promise);

    try {
      return await promise;
    } finally {
      clearTimeout(timeoutId);
      this.inFlight.delete(dedupeKey);
    }
  }

  // ─── Métodos Privados de Procesamiento ──────────────────────────────────────

  /**
   * Construye los headers del request, inyectando el Bearer token si existe.
   * @private
   * @param {object} customHeaders
   */
  _getHeaders(customHeaders = {}) {
    const headers = {
      'Content-Type': 'application/json'
    };

    const token = localStorage.getItem('as_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return Object.assign(headers, customHeaders);
  }

  /**
   * Procesa la respuesta HTTP y lanza ApiError en caso de fallo.
   * @private
   * @param {Response} response
   * @param {boolean}  isDev
   */
  async _handleResponse(response, isDev, requestPath) {
    let data;
    try {
      data = await response.json();
    } catch (_) {
      data = {};
    }

    if (isDev) {
      console.log('[API ←]', response.status, data);
    }

    if (response.status === 401) {
      var path = String(requestPath || '').toLowerCase();
      var shouldRedirectToLogin = path.indexOf('/auth/login') === -1;
      if (shouldRedirectToLogin) {
        this._handleUnauthorized();
      }
      throw new ApiError(401, 'Sesión expirada o inválida');
    }

    if (response.status === 403) {
      const msg = (data && data.error) ? data.error : 'No tienes permisos para esta operación';
      throw new ApiError(403, msg);
    }

    if (response.status >= 400 && response.status < 500) {
      const msg = (data && data.error) ? data.error : ('Error ' + response.status);
      throw new ApiError(response.status, msg, (data && data.data) ? data.data : null);
    }

    if (response.status >= 500) {
      throw new ApiError(response.status, 'Error del servidor. Intenta de nuevo.');
    }

    // 2xx
    return this._parseResponse(data, response.status);
  }

  /**
   * Construye el objeto de respuesta uniforme para casos exitosos.
   * @private
   * @param {object} data
   * @param {number} status
   */
  _parseResponse(data, status) {
    return {
      success:   status >= 200 && status < 300,
      data:      (data && data.data !== undefined) ? data.data : data,
      error:     null,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Maneja errores de red / timeout, con un reintento en caso de AbortError.
   * @private
   * @param {Error}  err
   * @param {string} method
   * @param {string} path
   * @param {object|null} body
   * @param {object} options
   */
  async _handleFetchError(err, method, path, body, options) {
    if (err.name === 'AbortError') {
      const retryCount = options._retryCount || 0;
      if (retryCount < this.maxRetries) {
        console.warn(`[ApiClient] Timeout. Reintentando ${method} ${path} (intento ${retryCount + 1})...`);
        await this._sleep(100);
        return this._request(method, path, body,
          Object.assign({}, options, { _retryCount: retryCount + 1 }));
      }
      throw new ApiError(0, 'Timeout de conexión.');
    }

    if (err.message && err.message.includes('Failed to fetch')) {
      throw new ApiError(0, 'No se pudo conectar al servidor.');
    }

    throw new ApiError(0, err.message || 'Error desconocido');
  }

  /**
   * Limpia la sesión local y redirige al login cuando se recibe un 401.
   * @private
   */
  _handleUnauthorized() {
    localStorage.removeItem('as_token');
    localStorage.removeItem('as_expires_at');
    localStorage.removeItem('as_role');
    localStorage.removeItem('as_nombre');

    if (typeof showToast === 'function') {
      showToast('Tu sesión expiró. Por favor inicia sesión.', 'warning');
    }

    window.location.href = '../views/login.html';
  }

  /**
   * Pausa la ejecución por `ms` milisegundos.
   * @private
   * @param {number} ms
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ─── Clase de Error Personalizada ─────────────────────────────────────────────

class ApiError extends Error {
  /**
   * @param {number} status   - HTTP status code (0 = error de red)
   * @param {string} message  - Mensaje legible
   * @param {any}    data     - Payload adicional del servidor (opcional)
   */
  constructor(status, message, data = null) {
    super(message);
    this.status = status;
    this.data   = data;
    this.name   = 'ApiError';
  }
}

// ─── Singleton Global ─────────────────────────────────────────────────────────

if (typeof window !== 'undefined') {
  window.apiClient = new ApiClient();
  window.ApiError  = ApiError;
}
