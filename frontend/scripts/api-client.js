/**
 * api-client.js
 * Capa centralizada de comunicación HTTP para AutoStock.
 */
import { showToast } from './toast.js';

class ApiClient {
  constructor(config = {}) {
    this.baseURL    = config.baseURL    || 'http://127.0.0.1:8765/api';
    this.timeout    = config.timeout    || 30000;
    this.maxRetries = config.maxRetries !== undefined ? config.maxRetries : 1;
    /** @type {Map<string, Promise>} Deduplicación: key = "METHOD:path" */
    this.inFlight   = new Map();
  }

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

  async post(path, body, options = {}) {
    return this._request('POST', path, body, options);
  }

  async patch(path, body, options = {}) {
    return this._request('PATCH', path, body, options);
  }

  async delete(path, options = {}) {
    return this._request('DELETE', path, null, options);
  }

  reset() {
    this.inFlight.clear();
    localStorage.removeItem('as_token');
  }

  async _request(method, path, body, options) {
    const url        = this.baseURL + path;
    const reqTimeout = options.timeout || this.timeout;
    const dedupeKey  = `${method}:${path}`;
    const isDev      = window.location.hostname === 'localhost' ||
                       window.location.hostname === '127.0.0.1';

    if (this.inFlight.has(dedupeKey)) {
      console.warn(`[ApiClient] Duplicado en flight ignorado: ${dedupeKey}`);
      return this.inFlight.get(dedupeKey);
    }

    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), reqTimeout);

    if (isDev) console.log('[API →]', method, url, body !== null ? body : '');

    const fetchOptions = {
      method,
      headers: this._getHeaders(options.headers),
      signal:  controller.signal,
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

  _getHeaders(customHeaders = {}) {
    const headers = { 'Content-Type': 'application/json' };
    const token = localStorage.getItem('as_token');
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return Object.assign(headers, customHeaders);
  }

  async _handleResponse(response, isDev, requestPath) {
    let data;
    try {
      data = await response.json();
    } catch (_) {
      data = {};
    }

    if (isDev) console.log('[API ←]', response.status, data);

    if (response.status === 401) {
      const path = String(requestPath || '').toLowerCase();
      if (!path.includes('/auth/login')) this._handleUnauthorized();
      throw new ApiError(401, 'Sesión expirada o inválida');
    }

    if (response.status === 403) {
      const msg = data?.error || 'No tienes permisos para esta operación';
      throw new ApiError(403, msg);
    }

    if (response.status >= 400 && response.status < 500) {
      const msg = data?.error || ('Error ' + response.status);
      throw new ApiError(response.status, msg, data?.data || null);
    }

    if (response.status >= 500) {
      throw new ApiError(response.status, 'Error del servidor. Intenta de nuevo.');
    }

    return this._parseResponse(data, response.status);
  }

  _parseResponse(data, status) {
    return {
      success:   status >= 200 && status < 300,
      data:      data?.data !== undefined ? data.data : data,
      error:     null,
      timestamp: new Date().toISOString()
    };
  }

  async _handleFetchError(err, method, path, body, options) {
    if (err.name === 'AbortError') {
      const retryCount = options._retryCount || 0;
      if (retryCount < this.maxRetries) {
        console.warn(`[ApiClient] Timeout. Reintentando ${method} ${path} (intento ${retryCount + 1})...`);
        await this._sleep(100);
        return this._request(method, path, body, { ...options, _retryCount: retryCount + 1 });
      }
      throw new ApiError(0, 'Timeout de conexión.');
    }

    if (err.message?.includes('Failed to fetch')) {
      throw new ApiError(0, 'No se pudo conectar al servidor.');
    }

    throw new ApiError(0, err.message || 'Error desconocido');
  }

  _handleUnauthorized() {
    localStorage.removeItem('as_token');
    localStorage.removeItem('as_expires_at');
    localStorage.removeItem('as_role');
    localStorage.removeItem('as_nombre');

    showToast('Tu sesión expiró. Por favor inicia sesión.', 'warning');
    window.location.href = '../views/login.html';
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

class ApiError extends Error {
  constructor(status, message, data = null) {
    super(message);
    this.status = status;
    this.data   = data;
    this.name   = 'ApiError';
  }
}

export const apiClient = new ApiClient();
export { ApiError };
