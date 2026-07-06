/* ============================================================
   FAMILY VAULT — Vault / Categories Screen
   ============================================================ */
import { store, CATEGORIES, getCategoryIcon, daysUntil } from '../store.js';
import { router } from '../router.js';

let activeCategory = null;

export function renderVault(container, params) {
  // Check for ?cat= query param
  const hash = window.location.hash;
  const catMatch = hash.match(/\?cat=([^&]+)/);
  activeCategory = catMatch ? decodeURIComponent(catMatch[1]) : null;

  if (activeCategory) {
    renderCategoryView(container, activeCategory);
  } else {
    renderMainVault(container);
  }
}

function renderMainVault(container) {
  const docs = store.documents;

  container.innerHTML = `
    <div class="page-header">
      <p class="eyebrow">Browse</p>
      <h1 style="font-size:22px; margin-top:3px;">The Vault</h1>
    </div>
    <div class="screen-inner" style="padding-top:8px;">

      <!-- Category grid -->
      <div class="section-head" style="margin-top:16px;"><h3>Categories</h3></div>
      <div class="cat-grid">
        ${CATEGORIES.map(cat => {
          const count = store.getDocumentsByCategory(cat.name).length;
          return `<div class="cat-tile" data-cat="${cat.name}">
            <svg viewBox="0 0 24 24">${cat.icon}</svg>
            <div class="t">${cat.name}</div>
            <div class="count">${count} doc${count !== 1 ? 's' : ''}</div>
          </div>`;
        }).join('')}
      </div>

      <!-- All documents list -->
      <div class="section-head" style="margin-top:28px;">
        <h3>All documents <span style="color:var(--text-lo); font-weight:400; font-size:13px;">(${docs.length})</span></h3>
        <select id="sort-select" class="form-select" style="width:auto; padding:6px 12px; font-size:12px;">
          <option value="recent">Newest</option>
          <option value="az">A–Z</option>
          <option value="expiry">Expiry</option>
        </select>
      </div>
      <div id="doc-list"></div>

      <!-- Physical map -->
      <div class="section-head" style="margin-top:28px;"><h3>Physical map</h3></div>
      <div class="field-card" id="physical-map"></div>

    </div>
  `;

  // Bind category tiles
  container.querySelectorAll('.cat-tile').forEach(tile => {
    tile.addEventListener('click', () => {
      activeCategory = tile.dataset.cat;
      renderCategoryView(container, activeCategory);
    });
  });

  // Sort
  container.querySelector('#sort-select').addEventListener('change', (e) => {
    renderDocList(container, e.target.value);
  });

  renderDocList(container, 'recent');
  renderPhysicalMap(container);
}

function renderDocList(container, sort = 'recent') {
  let docs = [...store.documents];

  if (sort === 'az') {
    docs.sort((a, b) => a.title.localeCompare(b.title));
  } else if (sort === 'expiry') {
    docs = docs.filter(d => d.expiresAt).sort((a, b) => new Date(a.expiresAt) - new Date(b.expiresAt));
    docs.push(...store.documents.filter(d => !d.expiresAt));
  } else {
    docs.sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt));
  }

  const el = container.querySelector('#doc-list');
  if (!el) return;

  el.innerHTML = docs.length === 0
    ? `<div class="empty-state"><svg viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2"/></svg><h3>No documents yet</h3><p>Add your first document to get started.</p></div>`
    : docs.map(doc => renderDocListRow(doc)).join('');

  el.querySelectorAll('.doc-list-row').forEach(row => {
    row.addEventListener('click', () => router.navigate('detail/' + row.dataset.docId));
  });
}

function renderDocListRow(doc) {
  const days = daysUntil(doc.expiresAt);
  let expiryHtml = '';
  if (days !== null) {
    if (days < 0) expiryHtml = `<div class="dl-expiry urgent">Expired</div>`;
    else if (days <= 30) expiryHtml = `<div class="dl-expiry urgent">${days}d left</div>`;
    else expiryHtml = `<div class="dl-expiry ok">${days}d</div>`;
  }

  return `
    <div class="doc-list-row" data-doc-id="${doc.id}">
      <div class="doc-thumb" style="width:46px;height:46px;flex:0 0 46px;">
        ${doc.fileData && doc.fileData.startsWith('data:image')
          ? `<img src="${doc.fileData}" style="width:100%;height:100%;object-fit:cover;border-radius:10px;" />`
          : `<svg viewBox="0 0 24 24" width="20" height="20">${getCategoryIcon(doc.category)}</svg>`
        }
      </div>
      <div style="flex:1; min-width:0;">
        <div class="dl-name">${doc.title}</div>
        <div class="dl-meta">${doc.category}${doc.location?.room ? ' · ' + doc.location.room : ''}</div>
      </div>
      ${expiryHtml}
    </div>
  `;
}

function renderPhysicalMap(container) {
  const el = container.querySelector('#physical-map');
  if (!el) return;

  const locations = store.locations;
  if (locations.length === 0) {
    el.innerHTML = `<div style="padding:16px; color:var(--text-lo); font-size:13px;">No physical locations mapped yet.</div>`;
    return;
  }

  el.innerHTML = locations.map(loc => {
    const count = store.getDocsByLocation(loc.room).length;
    return `
      <div class="physical-tree-item" data-room="${loc.room}">
        <div class="loc-icon">
          <svg viewBox="0 0 24 24"><path d="M3 10l9-7 9 7v9a2 2 0 01-2 2H5a2 2 0 01-2-2v-9z"/><path d="M9 21V13h6v8"/></svg>
        </div>
        <div class="loc-name">${loc.room}</div>
        <div class="loc-count">${count} doc${count !== 1 ? 's' : ''}</div>
        <div class="loc-arrow">›</div>
      </div>
    `;
  }).join('');

  el.querySelectorAll('.physical-tree-item').forEach(item => {
    item.addEventListener('click', () => renderLocationView(container, item.dataset.room));
  });
}

// ── Category filtered view ───────────────────────────────────

function renderCategoryView(container, category) {
  const docs = store.getDocumentsByCategory(category);
  const cat  = CATEGORIES.find(c => c.name === category);

  container.innerHTML = `
    <div class="page-header">
      <div style="display:flex; align-items:center; gap:14px; margin-bottom:6px;">
        <button class="back-btn" id="back-btn">
          <svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg>
          Vault
        </button>
      </div>
      <div style="display:flex; align-items:center; gap:12px; margin-top:12px;">
        <div style="width:42px;height:42px;background:var(--surface-2);border-radius:12px;display:flex;align-items:center;justify-content:center;">
          <svg viewBox="0 0 24 24" width="20" height="20" stroke="var(--brass-soft)" fill="none" stroke-width="1.5">${cat?.icon || ''}</svg>
        </div>
        <div>
          <p class="eyebrow" style="margin-bottom:2px;">Category</p>
          <h1 style="font-size:22px;">${category}</h1>
        </div>
      </div>
    </div>

    <div class="screen-inner" style="padding-top:4px;">
      <div class="section-head" style="margin-top:16px;">
        <h3>${docs.length} document${docs.length !== 1 ? 's' : ''}</h3>
        <div style="display:flex;gap:8px;">
          <button class="btn-icon" id="sort-az" title="Sort A-Z">A–Z</button>
        </div>
      </div>
      <div id="cat-doc-list">
        ${docs.length === 0
          ? `<div class="empty-state"><svg viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2"/></svg><h3>No ${category} documents</h3><p>Add your first document to this category.</p></div>`
          : docs.map(doc => renderDocListRow(doc)).join('')
        }
      </div>
    </div>
  `;

  container.querySelector('#back-btn').addEventListener('click', () => {
    activeCategory = null;
    renderMainVault(container);
  });

  container.querySelectorAll('.doc-list-row').forEach(row => {
    row.addEventListener('click', () => router.navigate('detail/' + row.dataset.docId));
  });

  let azSorted = false;
  container.querySelector('#sort-az')?.addEventListener('click', () => {
    azSorted = !azSorted;
    const sortedDocs = azSorted ? [...docs].sort((a,b) => a.title.localeCompare(b.title)) : docs;
    container.querySelector('#cat-doc-list').innerHTML = sortedDocs.map(doc => renderDocListRow(doc)).join('');
    container.querySelectorAll('.doc-list-row').forEach(row => {
      row.addEventListener('click', () => router.navigate('detail/' + row.dataset.docId));
    });
  });
}

// ── Location filtered view ───────────────────────────────────

function renderLocationView(container, room) {
  const docs = store.getDocsByLocation(room);

  container.innerHTML = `
    <div class="page-header">
      <button class="back-btn" id="back-btn">
        <svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg>
        Vault
      </button>
      <div style="margin-top:14px;">
        <p class="eyebrow">Physical location</p>
        <h1 style="font-size:22px;">${room}</h1>
      </div>
    </div>

    <div class="screen-inner" style="padding-top:4px;">
      <div class="section-head" style="margin-top:16px;"><h3>${docs.length} document${docs.length !== 1 ? 's' : ''} stored here</h3></div>
      <div>
        ${docs.length === 0
          ? `<div class="empty-state"><p>No documents in this location yet.</p></div>`
          : docs.map(doc => renderDocListRow(doc)).join('')
        }
      </div>
    </div>
  `;

  container.querySelector('#back-btn').addEventListener('click', () => renderMainVault(container));
  container.querySelectorAll('.doc-list-row').forEach(row => {
    row.addEventListener('click', () => router.navigate('detail/' + row.dataset.docId));
  });
}
