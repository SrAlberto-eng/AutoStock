/**
 * storage-manager.js
 * Persistencia versionada de estado UI (sin dependencias).
 */

(function () {
  'use strict';

  var PREFIX = 'v1_ui_';

  function StorageManager() {}

  StorageManager.prototype.saveUIState = function (viewName, state) {
    localStorage.setItem(PREFIX + viewName, JSON.stringify(state));
  };

  StorageManager.prototype.loadUIState = function (viewName) {
    var raw = localStorage.getItem(PREFIX + viewName);
    if (!raw) return null;

    try {
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  };

  StorageManager.prototype.clearUIState = function (viewName) {
    localStorage.removeItem(PREFIX + viewName);
  };

  StorageManager.prototype.clearAll = function () {
    var toDelete = [];
    for (var i = 0; i < localStorage.length; i += 1) {
      var key = localStorage.key(i);
      if (key && key.indexOf(PREFIX) === 0) {
        toDelete.push(key);
      }
    }

    toDelete.forEach(function (key) {
      localStorage.removeItem(key);
    });
  };

  if (typeof window !== 'undefined') {
    window.storageManager = new StorageManager();
  }
})();
