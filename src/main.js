/* ============================================================
   FAMILY VAULT — Main Entry Point
   ============================================================ */
import { registerSW } from 'virtual:pwa-register';

// Register service worker for PWA
registerSW({ immediate: true });

import './styles/index.css';
import './styles/components.css';
import './styles/screens.css';

import { router } from './router.js';
import { store } from './store.js';
import { buildShell, setActiveNavItem, updateSidebarBrand, showToast } from './app.js';

import { renderLock }      from './screens/lock.js';
import { renderDashboard } from './screens/dashboard.js';
import { renderAdd }       from './screens/add.js';
import { renderDetail }    from './screens/detail.js';
import { renderSearch }    from './screens/search.js';
import { renderVault }     from './screens/vault.js';
import { renderFamily }    from './screens/family.js';
import { renderSettings }  from './screens/settings.js';

// ── Auto-lock timer ──────────────────────────────────────────

let inactivityTimer = null;

function resetInactivityTimer() {
  clearTimeout(inactivityTimer);
  const mins = store.settings.autoLockMins || 5;
  inactivityTimer = setTimeout(() => {
    const currentPath = router.currentPath();
    if (currentPath && currentPath !== 'lock') {
      document.getElementById('app-tabbar')?.classList.add('hidden');
      router.navigate('lock', true);
      showToast('Vault locked due to inactivity', '');
    }
  }, mins * 60 * 1000);
}

['click', 'keydown', 'touchstart', 'scroll'].forEach(evt => {
  document.addEventListener(evt, resetInactivityTimer, { passive: true });
});

// ── Render helper ────────────────────────────────────────────

function renderScreen(renderFn, params = {}) {
  const area = document.getElementById('screen-area');
  if (!area) return;

  // Scroll to top
  area.scrollTo({ top: 0 });

  // Mount screen
  const wrapper = document.createElement('div');
  wrapper.className = 'screen-enter';
  wrapper.style.minHeight = '100%';
  area.innerHTML = '';
  area.appendChild(wrapper);
  renderFn(wrapper, params);
}

// ── Router config ────────────────────────────────────────────

function setupRoutes() {
  router
    .on('lock', () => {
      setActiveNavItem('lock');
      document.getElementById('app-tabbar')?.classList.add('hidden');
      if (document.getElementById('app-sidebar')) document.getElementById('app-sidebar').style.display = 'none';
      renderScreen(renderLock);
    })
    .on('dashboard', () => {
      setActiveNavItem('dashboard');
      document.getElementById('app-tabbar')?.classList.remove('hidden');
      if (document.getElementById('app-sidebar')) document.getElementById('app-sidebar').style.display = '';
      updateSidebarBrand();
      renderScreen(renderDashboard);
      resetInactivityTimer();
    })
    .on('search', () => {
      setActiveNavItem('search');
      document.getElementById('app-tabbar')?.classList.remove('hidden');
      if (document.getElementById('app-sidebar')) document.getElementById('app-sidebar').style.display = '';
      renderScreen(renderSearch);
      resetInactivityTimer();
      // Focus search input after render
      setTimeout(() => {
        document.querySelector('#search-input')?.focus();
      }, 100);
    })
    .on('add', () => {
      setActiveNavItem('add');
      document.getElementById('app-tabbar')?.classList.remove('hidden');
      if (document.getElementById('app-sidebar')) document.getElementById('app-sidebar').style.display = '';
      renderScreen(renderAdd);
      resetInactivityTimer();
    })
    .on('detail/:id', (params) => {
      setActiveNavItem('');
      document.getElementById('app-tabbar')?.classList.remove('hidden');
      if (document.getElementById('app-sidebar')) document.getElementById('app-sidebar').style.display = '';
      renderScreen(renderDetail, params);
      resetInactivityTimer();
    })
    .on('vault', () => {
      setActiveNavItem('vault');
      document.getElementById('app-tabbar')?.classList.remove('hidden');
      if (document.getElementById('app-sidebar')) document.getElementById('app-sidebar').style.display = '';
      renderScreen(renderVault, {});
      resetInactivityTimer();
    })
    .on('family', () => {
      setActiveNavItem('family');
      document.getElementById('app-tabbar')?.classList.remove('hidden');
      if (document.getElementById('app-sidebar')) document.getElementById('app-sidebar').style.display = '';
      renderScreen(renderFamily);
      resetInactivityTimer();
    })
    .on('settings', () => {
      setActiveNavItem('settings');
      document.getElementById('app-tabbar')?.classList.remove('hidden');
      if (document.getElementById('app-sidebar')) document.getElementById('app-sidebar').style.display = '';
      renderScreen(renderSettings);
      resetInactivityTimer();
    });
}

// ── Init ─────────────────────────────────────────────────────

async function init() {
  // Force-unregister service workers to prevent stale PWA caching
  if ('serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (let r of registrations) {
        await r.unregister();
      }
    } catch(e) { console.error(e); }
  }

  // If the old dummy data is still stuck in the database, forcefully wipe it out
  if (store.documents.some(d => d.title === "Dad's Passport" || d.title === "Car Insurance")) {
    store.clearAll();
  }

  buildShell();
  setupRoutes();
  router.start();
}

init();
