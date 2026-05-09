import { apiClient } from './api-client.js';

class _ProductService {
  getAll(filters = {})    { return apiClient.get('/productos', { params: filters }); }
  getById(id)             { return apiClient.get('/productos/' + id); }
  create(data)            { return apiClient.post('/productos', data); }
  createBulk(items)       { return apiClient.post('/productos/bulk', { items }); }
  update(id, data)        { return apiClient.patch('/productos/' + id, data); }
  softDelete(id)          { return apiClient.delete('/productos/' + id); }
  toggle(id)              { return apiClient.post('/productos/' + id + '/toggle'); }
  checkName(name)         { return apiClient.get('/productos/check_name', { params: { name } }); }
}

class _CatalogService {
  getAll(tipo) { return apiClient.get('/catalogos/' + tipo); }

  getAllCatalogs() {
    return Promise.all([
      this.getAll('categorias'),
      this.getAll('areas'),
      this.getAll('unidades'),
    ]).then(([r0, r1, r2]) => ({
      categorias: r0?.data?.items || [],
      areas:      r1?.data?.items || [],
      unidades:   r2?.data?.items || [],
    }));
  }

  create(tipo, data)        { return apiClient.post('/catalogos/' + tipo, data); }
  update(tipo, id, data)    { return apiClient.patch('/catalogos/' + tipo + '/' + id, data); }
  remove(tipo, id)          { return apiClient.delete('/catalogos/' + tipo + '/' + id); }
}

class _MovementService {
  create(tipo, items, extra = {}) {
    return apiClient.post('/movimientos', { tipo, items, ...extra });
  }
  getAll(filters = {})    { return apiClient.get('/movimientos', { params: filters }); }
  revert(id)              { return apiClient.post('/movimientos/' + id + '/revertir'); }
  getDashboardSummary()   { return apiClient.get('/dashboard/resumen'); }
  previewImport(xmlBase64){ return apiClient.post('/importacion/preview', { xml_base64: xmlBase64 }); }
}

class _UserService {
  getAll()                 { return apiClient.get('/usuarios'); }
  create(data)             { return apiClient.post('/usuarios', data); }
  update(id, data)         { return apiClient.patch('/usuarios/' + id, data); }
  resetPassword(id)        { return apiClient.post('/usuarios/' + id + '/password'); }
  softDelete(id)           { return apiClient.delete('/usuarios/' + id); }
  unblock(id)              { return apiClient.post('/usuarios/' + id + '/unblock'); }
  toggle(id)               { return apiClient.post('/usuarios/' + id + '/toggle'); }
  getAllIncludeInactive()  { return apiClient.get('/usuarios', { params: { include_inactive: true } }); }
}

class _ProviderService {
  getAll(includeInactive = false) {
    const params = includeInactive ? { include_inactive: true } : {};
    return apiClient.get('/proveedores', { params });
  }
  create(data)             { return apiClient.post('/proveedores', data); }
  update(id, data)         { return apiClient.patch('/proveedores/' + id, data); }
  toggle(id)               { return apiClient.post('/proveedores/' + id + '/toggle'); }
}

class _PurchaseService {
  getAll()  { return apiClient.get('/compras'); }
  export()  { return apiClient.get('/compras/export'); }
}

class _ReportService {
  getMovimientosReport(filters = {}) {
    return apiClient.get('/reportes/movimientos', { params: filters });
  }
}

export const ProductService  = new _ProductService();
export const CatalogService  = new _CatalogService();
export const MovementService = new _MovementService();
export const UserService     = new _UserService();
export const ProviderService = new _ProviderService();
export const PurchaseService = new _PurchaseService();
export const ReportService   = new _ReportService();
