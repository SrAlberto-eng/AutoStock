class ProductService {
  getAll(filters = {}) {
    return window.apiClient.get('/productos', { params: filters });
  }

  getById(id) {
    return window.apiClient.get('/productos/' + id);
  }

  create(data) {
    return window.apiClient.post('/productos', data);
  }

  createBulk(items) {
    return window.apiClient.post('/productos/bulk', { items: items });
  }

  update(id, data) {
    return window.apiClient.patch('/productos/' + id, data);
  }

  softDelete(id) {
    return window.apiClient.delete('/productos/' + id);
  }

  toggle(id) {
    return window.apiClient.post('/productos/' + id + '/toggle');
  }
}

class CatalogService {
  getAll(tipo) {
    return window.apiClient.get('/catalogos/' + tipo);
  }

  getAllCatalogs() {
    return Promise.all([
      this.getAll('categorias'),
      this.getAll('areas'),
      this.getAll('unidades')
    ]).then(function (results) {
      return {
        categorias: (results[0] && results[0].data && results[0].data.items) ? results[0].data.items : [],
        areas: (results[1] && results[1].data && results[1].data.items) ? results[1].data.items : [],
        unidades: (results[2] && results[2].data && results[2].data.items) ? results[2].data.items : []
      };
    });
  }

  create(tipo, data) {
    return window.apiClient.post('/catalogos/' + tipo, data);
  }

  update(tipo, id, data) {
    return window.apiClient.patch('/catalogos/' + tipo + '/' + id, data);
  }

  remove(tipo, id) {
    return window.apiClient.delete('/catalogos/' + tipo + '/' + id);
  }
}

class MovementService {
  create(tipo, items, extra = {}) {
    return window.apiClient.post('/movimientos', {
      tipo: tipo,
      items: items,
      ...extra
    });
  }

  getAll(filters = {}) {
    return window.apiClient.get('/movimientos', { params: filters });
  }

  revert(id) {
    return window.apiClient.post('/movimientos/' + id + '/revertir');
  }

  getDashboardSummary() {
    return window.apiClient.get('/dashboard/resumen');
  }

  previewImport(xmlBase64) {
    return window.apiClient.post('/importacion/preview', {
      xml_base64: xmlBase64
    });
  }
}

class UserService {
  getAll() {
    return window.apiClient.get('/usuarios');
  }

  create(data) {
    return window.apiClient.post('/usuarios', data);
  }

  update(id, data) {
    return window.apiClient.patch('/usuarios/' + id, data);
  }

  resetPassword(id) {
    return window.apiClient.post('/usuarios/' + id + '/password');
  }

  softDelete(id) {
    return window.apiClient.delete('/usuarios/' + id);
  }

  unblock(id) {
    return window.apiClient.post('/usuarios/' + id + '/unblock');
  }

  toggle(id) {
    return window.apiClient.post('/usuarios/' + id + '/toggle');
  }

  getAllIncludeInactive() {
    return window.apiClient.get('/usuarios', { params: { include_inactive: true } });
  }
}

class ProviderService {
  getAll(includeInactive = false) {
    var params = includeInactive ? { include_inactive: true } : {};
    return window.apiClient.get('/proveedores', { params: params });
  }

  create(data) {
    return window.apiClient.post('/proveedores', data);
  }

  update(id, data) {
    return window.apiClient.patch('/proveedores/' + id, data);
  }

  toggle(id) {
    return window.apiClient.post('/proveedores/' + id + '/toggle');
  }
}

class PurchaseService {
  getAll() {
    return window.apiClient.get('/compras');
  }

  export() {
    return window.apiClient.get('/compras/export');
  }
}

class ReportService {
  getMovimientosReport(filters = {}) {
    return window.apiClient.get('/reportes/movimientos', { params: filters });
  }
}

window.ProductService = new ProductService();
window.CatalogService = new CatalogService();
window.MovementService = new MovementService();
window.UserService = new UserService();
window.ProviderService = new ProviderService();
window.PurchaseService = new PurchaseService();
window.ReportService = new ReportService();
