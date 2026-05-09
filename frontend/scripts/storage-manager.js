/**
 * storage-manager.js
 * Persistencia versionada de estado UI (sin dependencias).
 */

const PREFIX = 'v1_ui_';

class StorageManager {
  saveUIState(viewName, state) {
    localStorage.setItem(PREFIX + viewName, JSON.stringify(state));
  }

  loadUIState(viewName) {
    const raw = localStorage.getItem(PREFIX + viewName);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }

  clearUIState(viewName) {
    localStorage.removeItem(PREFIX + viewName);
  }

  clearAll() {
    const toDelete = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(PREFIX)) toDelete.push(key);
    }
    toDelete.forEach(key => localStorage.removeItem(key));
  }
}

export const storageManager = new StorageManager();
