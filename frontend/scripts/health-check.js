/**
 * health-check.js — Polling al endpoint /health hasta que el backend responde.
 * Usado por login.js en modo Tauri para esperar al sidecar antes de mostrar la UI.
 */

const HEALTH_URL    = 'http://127.0.0.1:8765/health';
const POLL_INTERVAL = 500;
const MAX_WAIT_MS   = 30000;

/**
 * @param {object} [options]
 * @param {string}   [options.url]       URL del health endpoint
 * @param {number}   [options.interval]  ms entre intentos (default 500)
 * @param {number}   [options.timeout]   ms máximo de espera (default 30000)
 * @param {Function} [options.onAttempt] callback(n) llamado en cada intento
 * @returns {Promise<void>} resuelve cuando el backend responde 2xx
 * @throws {Error} si se agota el timeout
 */
export async function waitForBackend(options = {}) {
  const url       = options.url      ?? HEALTH_URL;
  const interval  = options.interval ?? POLL_INTERVAL;
  const timeout   = options.timeout  ?? MAX_WAIT_MS;
  const onAttempt = options.onAttempt ?? null;

  const deadline = Date.now() + timeout;
  let attempt = 0;

  while (Date.now() < deadline) {
    attempt++;
    if (onAttempt) onAttempt(attempt);
    try {
      const ctrl  = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), interval - 50);
      const res   = await fetch(url, { method: 'GET', signal: ctrl.signal, cache: 'no-store' });
      clearTimeout(timer);
      if (res.ok) return;
    } catch (_) { /* backend aún no disponible */ }
    await new Promise(r => setTimeout(r, interval));
  }

  throw new Error(`Backend no respondió en ${timeout / 1000}s.`);
}
