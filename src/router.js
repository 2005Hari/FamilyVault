/* ============================================================
   FAMILY VAULT — Hash-based Router
   ============================================================ */

const routes = {};
let currentRoute = null;
const history = [];

export const router = {
  /**
   * Register a route handler.
   * @param {string} path - e.g. 'dashboard', 'detail/:id'
   * @param {Function} handler - called with (params) when route activates
   */
  on(path, handler) {
    routes[path] = handler;
    return this;
  },

  currentPath() {
    return currentRoute;
  },

  /**
   * Navigate to a route.
   * @param {string} path - e.g. 'dashboard', or 'detail/doc-1'
   * @param {boolean} replace - replace instead of push in history
   */
  navigate(path, replace = false) {
    if (!replace) {
      if (currentRoute) history.push(currentRoute);
    }
    currentRoute = path;
    window.location.hash = path;
  },

  back() {
    if (history.length > 0) {
      const prev = history.pop();
      currentRoute = prev;
      window.location.hash = prev;
    } else {
      this.navigate('dashboard');
    }
  },

  _match(pattern, path) {
    const pParts = pattern.split('/');
    const rParts = path.split('/');
    if (pParts.length !== rParts.length) return null;
    const params = {};
    for (let i = 0; i < pParts.length; i++) {
      if (pParts[i].startsWith(':')) {
        params[pParts[i].slice(1)] = rParts[i];
      } else if (pParts[i] !== rParts[i]) {
        return null;
      }
    }
    return params;
  },

  _dispatch(hash) {
    const path = hash.startsWith('#') ? hash.slice(1) : hash;

    for (const [pattern, handler] of Object.entries(routes)) {
      const params = this._match(pattern, path);
      if (params !== null) {
        currentRoute = path;
        handler(params);
        return true;
      }
    }
    // Fallback to dashboard
    this.navigate('dashboard', true);
    return false;
  },

  start() {
    window.addEventListener('hashchange', () => {
      this._dispatch(window.location.hash);
    });

    // Initial route
    const hash = window.location.hash;
    if (!hash || hash === '#') {
      this.navigate('lock', true);
    } else {
      this._dispatch(hash);
    }
  },

  currentPath() {
    return currentRoute;
  },
};
