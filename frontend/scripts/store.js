const initialState = {
  user: null,           // { id, nombre, role } del localStorage
  products: [],         // array de productos cargados
  catalogs: {
    categorias: [],
    areas: [],
    unidades: []
  },
  ui: {
    loading: false,
    error: null
  }
};

class Store {
  constructor() {
    this.listeners = [];
    this.state = this._cloneInitialState();

    if (localStorage.getItem('as_token')) {
      this.state.user = {
        nombre: localStorage.getItem('as_nombre'),
        role: localStorage.getItem('as_role')
      };
    }
  }

  _cloneInitialState() {
    return {
      ...initialState,
      products: [...initialState.products],
      catalogs: { ...initialState.catalogs },
      ui: { ...initialState.ui }
    };
  }

  setState(updates) {
    const nextState = {
      ...this.state,
      ...updates
    };

    if (updates && updates.catalogs) {
      nextState.catalogs = {
        ...this.state.catalogs,
        ...updates.catalogs
      };
    }

    if (updates && updates.ui) {
      nextState.ui = {
        ...this.state.ui,
        ...updates.ui
      };
    }

    this.state = nextState;
    this._notify();
  }

  subscribe(listener) {
    this.listeners.push(listener);

    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  getState() {
    return { ...this.state };
  }

  reset() {
    this.state = this._cloneInitialState();
    this._notify();
  }

  _notify() {
    const snapshot = this.getState();
    this.listeners.forEach((listener) => listener(snapshot));
  }
}

window.store = new Store();
