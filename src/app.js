/* ============================================================
   FAMILY VAULT — App Shell (sidebar, tab bar, navigation, toasts, modals)
   ============================================================ */
import { router } from './router.js';
import { store } from './store.js';

// ── Build the app shell ──────────────────────────────────────

export function buildShell() {
  const app = document.getElementById('app');

  app.innerHTML = `
    <!-- Sidebar (desktop) -->
    <aside class="sidebar" id="app-sidebar">
      <div class="sidebar-brand">
        <div class="sidebar-brand-icon">
          <svg viewBox="0 0 24 24"><path d="M7 11V8a5 5 0 0110 0v3"/><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="16" r="1.5" fill="#1a1305"/></svg>
        </div>
        <div>
          <div class="sidebar-brand-name" id="sidebar-family-name">Family Vault</div>
          <div class="sidebar-brand-sub" id="sidebar-sub">Secure · Organized</div>
        </div>
      </div>

      <nav class="sidebar-nav">
        ${sidebarItem('dashboard', homeIcon(), 'Home')}
        ${sidebarItem('search',    searchIcon(), 'Search')}
        ${sidebarItem('vault',     vaultIcon(), 'Vault')}
        ${sidebarItem('family',    familyIcon(), 'Family')}
        ${sidebarItem('settings',  settingsIcon(), 'Settings')}
      </nav>

      <div class="sidebar-bottom">
        ${sidebarItem('add', addSidebarIcon(), 'Add document', 'brass')}
        <div class="sidebar-item" id="sidebar-lock" style="cursor:pointer;">
          <svg viewBox="0 0 24 24" style="width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:1.7;"><path d="M7 11V8a5 5 0 0110 0v3"/><rect x="3" y="11" width="18" height="10" rx="2"/></svg>
          <span>Lock vault</span>
        </div>
      </div>
    </aside>

    <!-- Main content -->
    <div class="main-content">
      <div class="screen-area" id="screen-area"></div>

      <!-- Mobile tab bar -->
      <nav class="tabbar hidden" id="app-tabbar">
        ${tabBtn('dashboard', homeIcon(), 'Home')}
        ${tabBtn('search',    searchIcon(), 'Search')}
        <button class="tab-btn tab-btn-add" id="tab-add" data-route="add">
          <div class="fab"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></div>
          <span>Add</span>
        </button>
        ${tabBtn('vault',  vaultIcon(), 'Vault')}
        ${tabBtn('family', familyIcon(), 'Family')}
      </nav>
    </div>
  `;

  bindShellEvents();
  updateSidebarBrand();
}

function sidebarItem(route, iconSvg, label, colorClass = '') {
  return `<button class="sidebar-item" data-route="${route}">
    <svg viewBox="0 0 24 24">${iconSvg}</svg>
    <span>${label}</span>
  </button>`;
}

function tabBtn(route, iconSvg, label) {
  return `<button class="tab-btn" data-route="${route}">
    <svg viewBox="0 0 24 24">${iconSvg}</svg>
    <span>${label}</span>
  </button>`;
}

function bindShellEvents() {
  // Sidebar navigation
  document.querySelectorAll('.sidebar-item[data-route]').forEach(btn => {
    btn.addEventListener('click', () => router.navigate(btn.dataset.route));
  });

  // Tab bar navigation
  document.querySelectorAll('.tab-btn[data-route]').forEach(btn => {
    btn.addEventListener('click', () => router.navigate(btn.dataset.route));
  });

  document.querySelector('#tab-add')?.addEventListener('click', () => router.navigate('add'));

  // Lock
  document.querySelector('#sidebar-lock')?.addEventListener('click', () => {
    document.getElementById('app-tabbar')?.classList.add('hidden');
    router.navigate('lock');
  });
}

export function setActiveNavItem(route) {
  // Sidebar
  document.querySelectorAll('.sidebar-item[data-route]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.route === route);
  });

  // Tab bar
  document.querySelectorAll('.tab-btn[data-route]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.route === route);
  });

  // Show/hide sidebar and tabbar depending on route
  const isLock = route === 'lock';
  document.getElementById('app-sidebar')?.style && (
    document.getElementById('app-sidebar').style.display = isLock ? 'none' : ''
  );
}

export function updateSidebarBrand() {
  const settings = store.settings;
  const nameEl = document.getElementById('sidebar-family-name');
  const subEl  = document.getElementById('sidebar-sub');
  if (nameEl) nameEl.textContent = settings.familyName || 'Family Vault';
  if (subEl) {
    const stats = store.getStats();
    subEl.textContent = `${stats.total} docs · ${store.members.length} members`;
  }

  // Expiry badge on Search nav item
  const expiring = store.getExpiringDocuments(30).length;
  const searchItems = document.querySelectorAll('[data-route="search"]');
  searchItems.forEach(item => {
    const existing = item.querySelector('.nav-badge');
    if (existing) existing.remove();
    if (expiring > 0) {
      const badge = document.createElement('span');
      badge.className = 'nav-badge';
      badge.textContent = expiring;
      item.appendChild(badge);
    }
  });
}

// ── Toast notifications ──────────────────────────────────────

export function showToast(message, type = '') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
    toast.style.transition = 'opacity 0.2s, transform 0.2s';
    setTimeout(() => toast.remove(), 220);
  }, 2800);
}

// ── Notifications ────────────────────────────────────────────

export async function checkAndNotifyExpirations() {
  if (!('Notification' in window)) return;
  
  if (Notification.permission === 'default') {
    await Notification.requestPermission();
  }
  
  if (Notification.permission === 'granted') {
    const expiring = store.getExpiringDocuments(30);
    if (expiring.length > 0) {
      new Notification('Family Vault', {
        body: `You have ${expiring.length} document(s) expiring within 30 days.`,
        icon: '/icon.svg'
      });
    }
  }
}

// ── Modal ────────────────────────────────────────────────────

export function showModal({ title, body, actions = [] }) {
  const overlay = document.getElementById('modal-overlay');
  if (!overlay) return;

  overlay.innerHTML = `
    <div class="modal">
      <h3>${title}</h3>
      <div style="margin-top:10px;">${body}</div>
      ${actions.length ? `<div class="modal-actions">${actions.map((a, i) =>
        `<button class="modal-action-btn ${a.className || 'btn-ghost'}" data-action-idx="${i}" style="flex:1;">${a.label}</button>`
      ).join('')}</div>` : ''}
    </div>
  `;

  overlay.classList.add('open');

  // Close on overlay click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  }, { once: true });

  // Bind action buttons
  overlay.querySelectorAll('.modal-action-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = actions[parseInt(btn.dataset.actionIdx)];
      if (action?.onClick) action.onClick();
      closeModal();
    });
  });
}

export function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  if (overlay) {
    overlay.classList.remove('open');
    overlay.innerHTML = '';
  }
}

// ── Icon helpers ─────────────────────────────────────────────

function homeIcon()     { return `<path d="M4 11L12 4l8 7"/><path d="M6 10v9h12v-9"/>`; }
function searchIcon()   { return `<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>`; }
function vaultIcon()    { return `<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>`; }
function familyIcon()   { return `<circle cx="9" cy="8" r="2.5"/><circle cx="16" cy="8" r="2"/><path d="M3 20c0-3 2.5-5 6-5s6 2 6 5"/><path d="M16 14c2.5 0.5 4 2 4 4"/>`; }
function settingsIcon() { return `<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>`; }
function addSidebarIcon() { return `<path d="M12 5v14M5 12h14"/>`; }
