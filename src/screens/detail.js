/* ============================================================
   FAMILY VAULT — Document Detail Screen
   ============================================================ */
import { store, formatDate, daysUntil, getCategoryIcon, formatTimeAgo } from '../store.js';
import { router } from '../router.js';
import { showToast, showModal } from '../app.js';
import { downloadDocumentFileUrl } from '../drive.js';

export function renderDetail(container, params) {
  const docId = params.id;
  const doc   = store.getDocument(docId);

  if (!doc) {
    container.innerHTML = `
      <div class="screen-inner" style="padding-top:40px;">
        <div class="empty-state">
          <svg viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>
          <h3>Document not found</h3>
          <p>This document may have been deleted.</p>
        </div>
        <button class="btn-ghost" id="back-btn" style="margin-top:24px;">← Back to Vault</button>
      </div>
    `;
    container.querySelector('#back-btn').addEventListener('click', () => router.navigate('vault'));
    return;
  }

  const member    = store.getMember(doc.owner);
  const days      = daysUntil(doc.expiresAt);
  const expiryBadge = doc.expiresAt
    ? (days < 0
        ? `<span class="badge badge-coral">Expired ${Math.abs(days)}d ago</span>`
        : days <= 30
        ? `<span class="badge badge-coral">Expires in ${days} days</span>`
        : `<span class="badge badge-brass">Expires ${formatDate(doc.expiresAt)}</span>`)
    : '';

  // Get activity for this doc
  const docActivity = store.activity.filter(a => a.docId === docId).slice(0, 4);

  container.innerHTML = `
    <div class="page-header">
      <div class="detail-nav">
        <button class="back-btn" id="back-btn">
          <svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg>
          Back
        </button>
        <button class="btn-icon" id="more-btn" title="More options">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="19" r="1.4" fill="currentColor"/></svg>
        </button>
      </div>
    </div>

    <div class="screen-inner" style="padding-top:0;">

      <!-- Hero -->
      <div class="detail-hero" id="detail-hero">
        ${doc.fileData && doc.fileData.startsWith('data:image')
          ? `<img src="${doc.fileData}" alt="${doc.title}" />`
          : doc.driveFileId
            ? `<div class="spinner"></div>`
            : `<svg viewBox="0 0 24 24" width="52" height="52">${getCategoryIcon(doc.category)}</svg>`
        }
      </div>

      <h1 class="detail-title">${doc.title}</h1>
      <div class="detail-badges">
        ${doc.encrypted ? '<span class="badge badge-brass">AES-256 encrypted</span>' : ''}
        ${expiryBadge}
        <span class="badge badge-dim">${doc.category}</span>
      </div>

      <!-- Fields -->
      <div class="field-card" style="margin-top:20px;">
        <div class="field-row">
          <span class="k">Owner</span>
          <span class="v">${member?.name || 'Unknown'}</span>
        </div>
        ${Object.entries(doc.fields || {}).map(([k, v]) => `
          <div class="field-row">
            <span class="k">${k}</span>
            <span class="v mono">${v}</span>
          </div>
        `).join('')}
        <div class="field-row">
          <span class="k">Added</span>
          <span class="v">${formatDate(doc.addedAt)}</span>
        </div>
        ${doc.expiresAt ? `
          <div class="field-row">
            <span class="k">Expires</span>
            <span class="v" style="color:${days !== null && days < 30 ? 'var(--coral)' : 'var(--brass-soft)'}">${formatDate(doc.expiresAt)}</span>
          </div>
        ` : ''}
      </div>

      ${doc.tags?.length ? `
        <div style="display:flex; flex-wrap:wrap; gap:8px; margin-top:14px;">
          ${doc.tags.map(t => `<div class="tag-item">${t}</div>`).join('')}
        </div>
      ` : ''}

      <!-- Location -->
      ${doc.location?.room ? `
        <div class="location-card" style="margin-top:20px;">
          <p class="eyebrow">Original location</p>
          <div class="loc-path">
            <span class="loc-crumb">Home</span>
            ${doc.location.room ? `<span class="loc-sep">›</span><span class="loc-crumb">${doc.location.room}</span>` : ''}
            ${doc.location.cupboard ? `<span class="loc-sep">›</span><span class="loc-crumb">${doc.location.cupboard}</span>` : ''}
            ${doc.location.folder ? `<span class="loc-sep">›</span><span class="loc-crumb">${doc.location.folder}</span>` : ''}
            ${doc.location.pocket ? `<span class="loc-sep">›</span><span class="loc-crumb">${doc.location.pocket}</span>` : ''}
          </div>
          <div class="qr-row">
            <div class="qr-box">
              <svg viewBox="0 0 24 24" width="28" height="28">
                <rect x="3" y="3" width="7" height="7" fill="#171C2C"/>
                <rect x="14" y="3" width="7" height="7" fill="#171C2C"/>
                <rect x="3" y="14" width="7" height="7" fill="#171C2C"/>
                <rect x="14" y="14" width="3" height="3" fill="#171C2C"/>
                <rect x="18" y="18" width="3" height="3" fill="#171C2C"/>
              </svg>
            </div>
            <div class="qr-hint">
              Scan the <b>${doc.location.folder || doc.location.cupboard || doc.location.room}</b> QR tag to see everything stored there.
            </div>
          </div>
        </div>
      ` : ''}

      <!-- Actions -->
      <div class="action-row" style="margin-top:20px;">
        <div class="action-btn" id="action-share">
          <svg viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98"/></svg>
          <div class="t">Share</div>
        </div>
        <div class="action-btn" id="action-download">
          <svg viewBox="0 0 24 24"><path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 21h16"/></svg>
          <div class="t">Download</div>
        </div>
        <div class="action-btn" id="action-edit">
          <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4z"/></svg>
          <div class="t">Edit</div>
        </div>
        <div class="action-btn danger" id="action-delete">
          <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          <div class="t">Delete</div>
        </div>
      </div>

      <!-- Vault log -->
      ${docActivity.length > 0 ? `
        <div class="section-head" style="margin-top:28px;"><h3>Vault log</h3></div>
        <div>
          ${docActivity.map(a => `
            <div class="activity-item">
              <div class="act-dot ${a.type === 'delete' ? 'warn' : ''}"></div>
              <div class="act-txt">${a.text}</div>
              <div class="act-time">${formatTimeAgo(a.time)}</div>
            </div>
          `).join('')}
        </div>
      ` : ''}

    </div>
  `;

  // Load drive image if needed
  if (doc.driveFileId) {
    downloadDocumentFileUrl(doc.driveFileId, doc.mimeType || 'image/jpeg')
      .then(url => {
        doc.loadedUrl = url; // Save for download button later
        const hero = container.querySelector('#detail-hero');
        if (hero) {
          if (doc.mimeType === 'application/pdf') {
            hero.innerHTML = `
              <object data="${url}" type="application/pdf" width="100%" height="100%" style="min-height: 250px;">
                <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; padding:20px;">
                  <svg viewBox="0 0 24 24" width="48" height="48"><path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9l-6-6z" stroke="#8a7a55" stroke-width="1.4" fill="none"/><path d="M14 3v6h6" stroke="#8a7a55" stroke-width="1.4" fill="none"/></svg>
                  <span style="color:var(--text-lo); font-size:12px; margin-top:8px;">PDF Ready for Download</span>
                </div>
              </object>`;
          } else {
            hero.innerHTML = `<img src="${url}" alt="${doc.title}" />`;
          }
        }
      })
      .catch(e => {
        console.error(e);
        const hero = container.querySelector('#detail-hero');
        if (hero) hero.innerHTML = `<span style="color:var(--coral); font-size:12px;">Failed to load document</span>`;
      });
  }

  // Back
  container.querySelector('#back-btn').addEventListener('click', () => router.back());

  // More options
  container.querySelector('#more-btn').addEventListener('click', () => {
    showModal({
      title: 'More options',
      body: `<div style="display:flex;flex-direction:column;gap:10px;margin-top:4px;">
        <button class="btn-ghost btn-sm" id="modal-encrypt" style="width:100%;justify-content:flex-start;">
          ${doc.encrypted ? '🔓 Remove encryption mark' : '🔒 Mark as encrypted'}
        </button>
        <button class="btn-ghost btn-sm" id="modal-export" style="width:100%;justify-content:flex-start;">
          📋 Copy details to clipboard
        </button>
      </div>`,
      actions: [],
    });

    setTimeout(() => {
      document.querySelector('#modal-encrypt')?.addEventListener('click', () => {
        store.updateDocument(docId, { encrypted: !doc.encrypted });
        closeModal();
        renderDetail(container, params);
        showToast(doc.encrypted ? 'Encryption mark removed' : 'Marked as encrypted', 'success');
      });
      document.querySelector('#modal-export')?.addEventListener('click', () => {
        const text = `${doc.title}\nCategory: ${doc.category}\n${Object.entries(doc.fields||{}).map(([k,v])=>`${k}: ${v}`).join('\n')}`;
        navigator.clipboard?.writeText(text).then(() => showToast('Copied to clipboard', 'success'));
        closeModal();
      });
    }, 50);
  });

  // Share
  container.querySelector('#action-share').addEventListener('click', () => {
    const shareData = {
      title: doc.title,
      text: `${doc.title} — ${doc.category}\n${Object.entries(doc.fields || {}).map(([k,v]) => `${k}: ${v}`).join('\n')}`,
    };
    if (navigator.share) {
      navigator.share(shareData).then(() => {
        store.addActivity({ type: 'share', text: `Shared <b>${doc.title}</b>`, docId });
        showToast('Shared!', 'success');
      }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(shareData.text).then(() => showToast('Details copied to clipboard', 'success'));
    }
  });

  // Download
  container.querySelector('#action-download').addEventListener('click', async () => {
    if (doc.loadedUrl || doc.fileData) {
      const url = doc.loadedUrl || doc.fileData;
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.title.replace(/\s+/g, '_') + (url.includes('pdf') ? '.pdf' : '.jpg');
      a.click();
      showToast('Download started', 'success');
    } else if (doc.driveFileId) {
      showToast('Please wait for image to load...', 'error');
    } else {
      showToast('No file attached to this document', 'error');
    }
  });

  // Edit — inline modal
  container.querySelector('#action-edit').addEventListener('click', () => {
    showEditModal(container, doc, docId, params);
  });

  // Delete
  container.querySelector('#action-delete').addEventListener('click', () => {
    showModal({
      title: 'Delete document?',
      body: `<p>Are you sure you want to permanently delete <b>${doc.title}</b>? This cannot be undone.</p>`,
      actions: [
        {
          label: 'Delete permanently',
          className: 'btn-ghost btn-danger',
          onClick: () => {
            store.deleteDocument(docId);
            showToast('Document deleted', 'success');
            router.navigate('dashboard');
          }
        },
        { label: 'Cancel', className: 'btn-ghost', onClick: () => {} }
      ],
    });
  });
}

function showEditModal(container, doc, docId, params) {
  showModal({
    title: 'Edit document',
    body: `
      <div class="form-group"><label class="form-label">Title</label>
        <input class="form-input" id="edit-title" value="${doc.title}" /></div>
      <div class="form-group"><label class="form-label">Expiry date</label>
        <input class="form-input" id="edit-expiry" type="date" value="${doc.expiresAt ? doc.expiresAt.slice(0,10) : ''}" /></div>
    `,
    actions: [
      {
        label: 'Save changes',
        className: 'btn-primary btn-sm',
        onClick: () => {
          const title  = document.querySelector('#edit-title')?.value.trim();
          const expiry = document.querySelector('#edit-expiry')?.value;
          if (!title) { showToast('Title is required', 'error'); return; }
          store.updateDocument(docId, {
            title,
            expiresAt: expiry ? new Date(expiry).toISOString() : doc.expiresAt,
          });
          showToast('Document updated', 'success');
          renderDetail(container, params);
        }
      },
      { label: 'Cancel', className: 'btn-ghost btn-sm', onClick: () => {} }
    ],
  });
}

function closeModal() {
  const overlay = document.querySelector('#modal-overlay');
  if (overlay) { overlay.classList.remove('open'); overlay.innerHTML = ''; }
}
