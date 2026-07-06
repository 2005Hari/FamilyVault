/* ============================================================
   FAMILY VAULT — Dashboard Screen
   ============================================================ */
import { store, formatTimeAgo, daysUntil, getCategoryIcon, CATEGORIES } from '../store.js';
import { router } from '../router.js';

export function renderDashboard(container) {
  const settings  = store.settings;
  const stats     = store.getStats();
  const expiring  = store.getExpiringDocuments(30);
  const recentDocs = store.documents.slice(0, 6);
  const activity  = store.activity.slice(0, 5);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const currentMember = store.getCurrentMember();

  container.innerHTML = `
    <div class="page-header">
      <div class="greet-row">
        <div>
          <p class="eyebrow">${greeting}</p>
          <h1 style="font-size:22px; margin-top:3px;">${settings.familyName || 'Family Vault'}</h1>
        </div>
        <div class="avatar" id="dash-avatar" title="Switch profile or settings">${currentMember?.initials || 'F'}</div>
      </div>
    </div>

    <div class="screen-inner">
      ${expiring.length > 0 ? `
      <div class="expiry-banner">
        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>
        <div class="msg"><b>${expiring.length} document${expiring.length > 1 ? 's' : ''}</b> expiring within 30 days — <a href="#search" style="color:var(--coral);">Review now</a></div>
      </div>
      ` : ''}

      <!-- Stats -->
      <div class="stat-row">
        <div class="stat-card">
          <div class="num">${stats.total}</div>
          <div class="lbl">Documents</div>
        </div>
        <div class="stat-card">
          <div class="num" style="color:${expiring.length > 0 ? 'var(--coral)' : 'var(--text-hi)'}">${expiring.length}</div>
          <div class="lbl">Expiring soon</div>
        </div>
        <div class="stat-card">
          <div class="num" style="font-size:${stats.storageLabel.length > 6 ? '16px' : '22px'}">${stats.storageLabel}</div>
          <div class="lbl">Storage</div>
        </div>
      </div>

      <!-- Recently Added -->
      <div class="section-head">
        <h3>Recently added</h3>
        <span class="see-all" id="see-all-docs">See all</span>
      </div>
      <div class="doc-scroll" id="recent-docs">
        ${recentDocs.length === 0 ? `<div style="color:var(--text-lo); font-size:13px; padding:20px 0;">No documents yet — add one!</div>` :
          recentDocs.map(doc => renderDocCard(doc)).join('')}
      </div>

      <!-- Categories -->
      <div class="section-head">
        <h3>Categories</h3>
        <span class="see-all" id="see-all-cats">See all</span>
      </div>
      <div class="cat-grid">
        ${CATEGORIES.slice(0, 8).map(cat => {
          const count = store.getDocumentsByCategory(cat.name).length;
          return `<div class="cat-tile" data-cat="${cat.name}">
            <svg viewBox="0 0 24 24">${cat.icon}</svg>
            <div class="t">${cat.name}</div>
            <div class="count">${count}</div>
          </div>`;
        }).join('')}
      </div>

      <!-- Recent Activity -->
      <div class="section-head"><h3>Recent activity</h3></div>
      <div id="activity-list">
        ${activity.length === 0
          ? '<p style="color:var(--text-lo); font-size:13px; padding:16px 0;">No activity yet.</p>'
          : activity.map(act => renderActivity(act)).join('')
        }
      </div>
    </div>
  `;

  // Events
  container.querySelector('#dash-avatar').addEventListener('click', () => router.navigate('settings'));
  container.querySelector('#see-all-docs').addEventListener('click', () => router.navigate('vault'));
  container.querySelector('#see-all-cats').addEventListener('click', () => router.navigate('vault'));

  container.querySelectorAll('.doc-card').forEach(card => {
    card.addEventListener('click', () => router.navigate('detail/' + card.dataset.docId));
  });

  container.querySelectorAll('.cat-tile').forEach(tile => {
    tile.addEventListener('click', () => router.navigate('vault?cat=' + tile.dataset.cat));
  });

  container.querySelectorAll('[data-act-doc]').forEach(el => {
    el.addEventListener('click', () => router.navigate('detail/' + el.dataset.actDoc));
  });
}

function renderDocCard(doc) {
  const days = daysUntil(doc.expiresAt);
  return `
    <div class="doc-card" data-doc-id="${doc.id}">
      ${doc.encrypted ? '<div class="tag-thread"></div>' : ''}
      <div class="doc-thumb" style="height:72px;">
        ${doc.fileData
          ? `<img src="${doc.fileData}" alt="${doc.title}" />`
          : `<svg viewBox="0 0 24 24" width="28" height="28">${getCategoryIcon(doc.category)}</svg>`
        }
      </div>
      <div class="name">${doc.title}</div>
      <div class="cat">${doc.category}</div>
      ${days !== null && days < 60 ? `<div class="cat" style="color:${days < 30 ? 'var(--coral)' : 'var(--brass-soft)'}; margin-top:4px;">${days < 0 ? 'Expired' : days + 'd left'}</div>` : ''}
    </div>
  `;
}

function renderActivity(act) {
  const isExpiry = act.type === 'expiry';
  const isBrass  = act.type === 'backup' || act.type === 'share';
  const dotClass = isExpiry ? 'warn' : isBrass ? 'brass' : '';
  const clickable = act.docId ? `style="cursor:pointer;" data-act-doc="${act.docId}"` : '';

  return `
    <div class="activity-item" ${clickable}>
      <div class="act-dot ${dotClass}"></div>
      <div class="act-txt">${act.text}</div>
      <div class="act-time">${formatTimeAgo(act.time)}</div>
    </div>
  `;
}
