/* ============================================================
   FAMILY VAULT — Search Screen
   ============================================================ */
import { store, getCategoryIcon, daysUntil, CATEGORIES } from '../store.js';
import { router } from '../router.js';

let searchTimeout = null;
let activeFilters = { category: '', member: '', expiry: '' };

export function renderSearch(container) {
  activeFilters = { category: '', member: '', expiry: '' };

  container.innerHTML = `
    <div class="page-header">
      <p class="eyebrow">Search</p>
      <h1 style="font-size:22px; margin-top:3px;">Find anything</h1>
    </div>
    <div class="screen-inner" style="padding-top:8px;">

      <div class="search-bar">
        <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
        <input type="text" id="search-input" placeholder="Search documents, tags, owners…" autocomplete="off" />
        <button id="search-clear" style="background:none;border:none;color:var(--text-lo-2);font-size:18px;padding:0;display:none;">×</button>
      </div>

      <!-- Filter chips -->
      <div class="chip-row" style="margin-top:14px;" id="filter-chips">
        <div class="chip ${!activeFilters.expiry ? '' : 'active'}" data-filter="expiry" data-val="soon">⏰ Expiring soon</div>
        <div class="chip" data-filter="expiry" data-val="expired">❌ Expired</div>
        ${CATEGORIES.map(c => `<div class="chip" data-filter="category" data-val="${c.name}">${c.name}</div>`).join('')}
        ${store.members.map(m => `<div class="chip" data-filter="member" data-val="${m.id}">👤 ${m.name.split(' ')[0]}</div>`).join('')}
      </div>

      <!-- AI note (shown when query is NL) -->
      <div class="ai-note" id="ai-note" style="margin-top:14px; display:none;">
        <svg viewBox="0 0 24 24"><path d="M12 2l2.4 5.5L20 9l-4.5 3.9L17 19l-5-3.2L7 19l1.5-6.1L4 9l5.6-1.5z"/></svg>
        <span id="ai-note-text"></span>
      </div>

      <!-- Results -->
      <div id="search-results" style="margin-top:20px;"></div>

    </div>
  `;

  const input = container.querySelector('#search-input');
  const clearBtn = container.querySelector('#search-clear');

  // Initial: show all
  renderResults(container, store.documents);

  input.addEventListener('input', () => {
    const q = input.value.trim();
    clearBtn.style.display = q ? 'block' : 'none';
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => doSearch(container, q), 180);
  });

  clearBtn.addEventListener('click', () => {
    input.value = '';
    clearBtn.style.display = 'none';
    activeFilters = { category: '', member: '', expiry: '' };
    updateChips(container);
    renderResults(container, store.documents);
    hideAiNote(container);
  });

  // Filter chips
  container.querySelector('#filter-chips').addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    const filter = chip.dataset.filter;
    const val    = chip.dataset.val;

    // Toggle
    if (activeFilters[filter] === val) {
      activeFilters[filter] = '';
    } else {
      activeFilters[filter] = val;
    }

    updateChips(container);
    doSearch(container, input.value.trim());
  });
}

function doSearch(container, query) {
  let results = query ? store.searchDocuments(query) : store.documents;

  // Apply filters
  if (activeFilters.category) {
    results = results.filter(d => d.category === activeFilters.category);
  }
  if (activeFilters.member) {
    results = results.filter(d => d.owner === activeFilters.member);
  }
  if (activeFilters.expiry === 'soon') {
    results = results.filter(d => {
      const days = daysUntil(d.expiresAt);
      return days !== null && days >= 0 && days <= 30;
    });
  }
  if (activeFilters.expiry === 'expired') {
    results = results.filter(d => {
      const days = daysUntil(d.expiresAt);
      return days !== null && days < 0;
    });
  }

  // AI note for NL queries
  const q = query.toLowerCase();
  const aiNote = container.querySelector('#ai-note');
  const aiText = container.querySelector('#ai-note-text');

  if (q.includes('expir')) {
    aiNote.style.display = 'flex';
    aiText.innerHTML = `Understood as: <b>documents with expiry date within 60 days</b>`;
  } else if (q.includes('bank') || q.includes('property') || q.includes('insurance')) {
    aiNote.style.display = 'flex';
    aiText.innerHTML = `Searching across <b>all fields</b> matching "${query}"`;
  } else {
    aiNote.style.display = 'none';
  }

  renderResults(container, results, query);
}

function renderResults(container, docs, query = '') {
  const resultsEl = container.querySelector('#search-results');

  if (docs.length === 0) {
    resultsEl.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
        <h3>No results</h3>
        <p>Try a different search term or remove filters.</p>
      </div>
    `;
    return;
  }

  resultsEl.innerHTML = `
    <div class="section-head" style="margin-top:0;">
      <h3>${docs.length} result${docs.length !== 1 ? 's' : ''}</h3>
    </div>
    <div>
      ${docs.map(doc => renderResultRow(doc, query)).join('')}
    </div>
  `;

  resultsEl.querySelectorAll('.result-row').forEach(row => {
    row.addEventListener('click', () => router.navigate('detail/' + row.dataset.docId));
  });
}

function renderResultRow(doc, query) {
  const days = daysUntil(doc.expiresAt);
  let expiryLabel = '';
  let expiryClass = '';
  if (days !== null) {
    if (days < 0)    { expiryLabel = 'Expired'; expiryClass = 'urgent'; }
    else if (days <= 30) { expiryLabel = `${days}d left`; expiryClass = 'urgent'; }
    else             { expiryLabel = `${days}d left`; expiryClass = 'ok'; }
  }

  // Highlight matching text
  let metaText = doc.category;
  if (doc.location?.room) metaText += ` · ${doc.location.room}`;
  if (doc.owner) {
    const m = store.getMember(doc.owner);
    if (m) metaText = m.name.split(' ')[0] + ' · ' + metaText;
  }

  return `
    <div class="result-row" data-doc-id="${doc.id}">
      <div class="result-thumb doc-thumb">
        ${doc.fileData && doc.fileData.startsWith('data:image')
          ? `<img src="${doc.fileData}" style="width:100%;height:100%;object-fit:cover;border-radius:10px;" />`
          : `<svg viewBox="0 0 24 24" width="20" height="20">${getCategoryIcon(doc.category)}</svg>`
        }
      </div>
      <div style="flex:1; min-width:0;">
        <div class="result-name">${highlight(doc.title, query)}</div>
        <div class="result-meta">${metaText}</div>
      </div>
      ${expiryLabel ? `<div class="dl-expiry ${expiryClass}">${expiryLabel}</div>` : ''}
    </div>
  `;
}

function highlight(text, query) {
  if (!query) return text;
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return text.replace(regex, '<b style="color:var(--brass-soft);">$1</b>');
}

function updateChips(container) {
  container.querySelectorAll('.chip').forEach(chip => {
    const filter = chip.dataset.filter;
    const val    = chip.dataset.val;
    if (activeFilters[filter] === val) {
      chip.classList.add('active');
    } else {
      chip.classList.remove('active');
    }
  });
}

function hideAiNote(container) {
  const note = container.querySelector('#ai-note');
  if (note) note.style.display = 'none';
}
