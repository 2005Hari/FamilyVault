/* ============================================================
   FAMILY VAULT — Settings Screen
   ============================================================ */
import { store } from '../store.js';
import { router } from '../router.js';
import { showToast, showModal } from '../app.js';

export function renderSettings(container) {
  const settings = store.settings;
  const stats    = store.getStats();

  container.innerHTML = `
    <div class="page-header">
      <p class="eyebrow">Configuration</p>
      <h1 style="font-size:22px; margin-top:3px;">Settings</h1>
    </div>
    <div class="screen-inner" style="padding-top:12px;">

      <!-- Profile -->
      <div style="display:flex; align-items:center; gap:16px; margin-bottom:28px; padding:16px; background:var(--surface); border:1px solid var(--line); border-radius:var(--r-lg);">
        <div class="avatar lg">${settings.ownerInitials || 'F'}</div>
        <div>
          <div style="font-size:15px; font-weight:600;">${settings.familyName || 'Family Vault'}</div>
          <div style="font-size:12px; color:var(--text-lo); margin-top:3px;">${stats.total} documents · ${store.members.length} members</div>
        </div>
      </div>

      <!-- Vault settings -->
      <p class="eyebrow" style="margin-bottom:10px; padding-left:4px;">Vault</p>
      <div class="settings-section">
        <div class="settings-row" id="s-family-name">
          <div class="s-icon brass"><svg viewBox="0 0 24 24"><path d="M3 10l9-7 9 7v9a2 2 0 01-2 2H5a2 2 0 01-2-2v-9z"/></svg></div>
          <div class="s-label">Family name</div>
          <div class="s-value">${settings.familyName || '—'}</div>
          <div class="s-arrow">›</div>
        </div>
        <div class="settings-row" id="s-change-pin">
          <div class="s-icon teal"><svg viewBox="0 0 24 24"><path d="M7 11V8a5 5 0 0110 0v3"/><rect x="3" y="11" width="18" height="10" rx="2"/></svg></div>
          <div class="s-label">Change PIN</div>
          <div class="s-value">4 digits</div>
          <div class="s-arrow">›</div>
        </div>
        <div class="settings-row" id="s-auto-lock">
          <div class="s-icon purple"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg></div>
          <div class="s-label">Auto-lock</div>
          <div class="s-value" id="auto-lock-val">${settings.autoLockMins} minutes</div>
          <div class="s-arrow">›</div>
        </div>
        <div class="settings-row" id="s-face-id">
          <div class="s-icon brass"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/><path d="M9 9h.01M15 9h.01M12 15h.01"/></svg></div>
          <div class="s-label">Biometric Unlock</div>
          <div class="s-value" style="color:${settings.biometricEnrolled ? 'var(--brass)' : 'var(--text-lo)'}">${settings.biometricEnrolled ? 'Enabled' : 'Off'}</div>
          <div class="s-arrow">›</div>
        </div>
      </div>

      <!-- Data -->
      <p class="eyebrow" style="margin:20px 0 10px; padding-left:4px;">Data</p>
      <div class="settings-section">
        <div class="settings-row" id="s-export">
          <div class="s-icon teal"><svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></div>
          <div class="s-label">Export backup</div>
          <div class="s-value">JSON</div>
          <div class="s-arrow">›</div>
        </div>
        <div class="settings-row" id="s-import">
          <div class="s-icon brass"><svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg></div>
          <div class="s-label">Import backup</div>
          <div class="s-value"></div>
          <div class="s-arrow">›</div>
        </div>
        <div class="settings-row" id="s-clear">
          <div class="s-icon coral"><svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg></div>
          <div class="s-label" style="color:var(--coral);">Clear all data</div>
          <div class="s-value"></div>
          <div class="s-arrow">›</div>
        </div>
      </div>

      <!-- Lock -->
      <button class="btn-ghost" id="s-lock" style="margin-top:8px;">
        🔒 Lock vault now
      </button>

      <button class="btn-ghost" id="s-signout" style="margin-top:8px; color:var(--coral);">
        🚪 Sign out of Google Drive
      </button>

      <!-- About -->
      <div style="text-align:center; margin-top:32px; padding-bottom:16px;">
        <p style="font-family:'Fraunces',serif; font-size:20px; margin-bottom:4px;">Family Vault</p>
        <p style="font-size:12px; color:var(--text-lo-2);">Version 1.0.0 · Built with ❤️</p>
        <p style="font-size:11px; color:var(--text-lo-2); margin-top:6px;">Data stored locally · No cloud sync</p>
      </div>

      <input type="file" id="import-file-input" accept=".json" style="display:none;" />

    </div>
  `;

  // Family name
  container.querySelector('#s-family-name').addEventListener('click', () => {
    showModal({
      title: 'Family name',
      body: `<div class="form-group"><label class="form-label">Name</label>
        <input class="form-input" id="new-family-name" value="${settings.familyName}" /></div>`,
      actions: [
        {
          label: 'Save',
          className: 'btn-primary btn-sm',
          onClick: () => {
            const val = document.querySelector('#new-family-name')?.value.trim();
            if (!val) return;
            store.updateSettings({ familyName: val });
            showToast('Family name updated', 'success');
            renderSettings(container);
          }
        },
        { label: 'Cancel', className: 'btn-ghost btn-sm', onClick: () => {} }
      ],
    });
  });

  // Change PIN
  container.querySelector('#s-change-pin').addEventListener('click', () => {
    showChangePinModal(container);
  });

  // Auto-lock
  container.querySelector('#s-auto-lock').addEventListener('click', () => {
    showModal({
      title: 'Auto-lock timer',
      body: `<div class="form-group"><label class="form-label">Lock after inactivity</label>
        <select class="form-select" id="auto-lock-select">
          ${[1,2,5,10,15,30].map(m => `<option value="${m}" ${m === settings.autoLockMins ? 'selected' : ''}>${m} minutes</option>`).join('')}
        </select></div>`,
      actions: [
        {
          label: 'Save',
          className: 'btn-primary btn-sm',
          onClick: () => {
            const val = parseInt(document.querySelector('#auto-lock-select')?.value);
            store.updateSettings({ autoLockMins: val });
            showToast(`Auto-lock set to ${val} minutes`, 'success');
            renderSettings(container);
          }
        },
        { label: 'Cancel', className: 'btn-ghost btn-sm', onClick: () => {} }
      ],
    });
  });

  // Face ID / Biometrics
  container.querySelector('#s-face-id').addEventListener('click', async () => {
    if (settings.biometricEnrolled) {
      // Disable
      store.updateSettings({ biometricEnrolled: false });
      showToast('Biometric unlock disabled', '');
      renderSettings(container);
    } else {
      // Enable
      try {
        const success = await store.registerBiometrics();
        if (success) {
          showToast('Biometric unlock enabled!', 'success');
          renderSettings(container);
        }
      } catch (e) {
        showToast(e.message || 'Biometric registration failed', 'error');
      }
    }
  });

  // Export
  container.querySelector('#s-export').addEventListener('click', () => {
    const data     = store.exportData();
    const blob     = new Blob([data], { type: 'application/json' });
    const url      = URL.createObjectURL(blob);
    const a        = document.createElement('a');
    a.href         = url;
    a.download     = `family-vault-backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Backup downloaded', 'success');
  });

  // Import
  const importInput = container.querySelector('#import-file-input');
  container.querySelector('#s-import').addEventListener('click', () => importInput.click());
  importInput.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        store.importData(ev.target.result);
        showToast('Backup imported successfully', 'success');
        renderSettings(container);
      } catch {
        showToast('Invalid backup file', 'error');
      }
    };
    reader.readAsText(file);
  });

  // Clear all
  container.querySelector('#s-clear').addEventListener('click', () => {
    showModal({
      title: '⚠️ Clear all data?',
      body: `<p>This will permanently delete <b>all documents, members, and settings</b>. This cannot be undone.</p>
      <p style="margin-top:12px; color:var(--coral); font-size:12.5px;">Type <b>DELETE</b> to confirm.</p>
      <input class="form-input" id="clear-confirm" type="text" placeholder="Type DELETE" style="margin-top:10px;" />`,
      actions: [
        {
          label: 'Clear everything',
          className: 'btn-ghost btn-danger',
          onClick: () => {
            const val = document.querySelector('#clear-confirm')?.value;
            if (val !== 'DELETE') { showToast('Type DELETE to confirm', 'error'); return; }
            store.clearAll();
            showToast('Vault cleared', 'success');
            router.navigate('lock');
          }
        },
        { label: 'Cancel', className: 'btn-ghost', onClick: () => {} }
      ],
    });
  });

  // Lock now
  container.querySelector('#s-lock').addEventListener('click', () => {
    document.getElementById('app-tabbar')?.classList.add('hidden');
    router.navigate('lock');
  });

  // Sign out
  container.querySelector('#s-signout').addEventListener('click', async () => {
    const { signOut } = await import('../drive.js');
    showModal({
      title: 'Sign out?',
      body: '<p>This will disconnect your Google Drive and clear your local PIN session.</p>',
      actions: [
        {
          label: 'Sign out',
          className: 'btn-primary btn-sm',
          onClick: () => {
            signOut();
            store.clearAll();
            showToast('Signed out successfully', 'success');
            router.navigate('lock');
          }
        },
        { label: 'Cancel', className: 'btn-ghost btn-sm', onClick: () => {} }
      ],
    });
  });
}

function showChangePinModal(container) {
  showModal({
    title: 'Change PIN',
    body: `
      <div class="form-group"><label class="form-label">Current PIN</label>
        <input class="form-input" id="cur-pin" type="password" inputmode="numeric" maxlength="4" placeholder="Current PIN" /></div>
      <div class="form-group"><label class="form-label">New PIN</label>
        <input class="form-input" id="new-pin" type="password" inputmode="numeric" maxlength="4" placeholder="4-digit PIN" /></div>
      <div class="form-group"><label class="form-label">Confirm new PIN</label>
        <input class="form-input" id="conf-pin" type="password" inputmode="numeric" maxlength="4" placeholder="Repeat PIN" /></div>
      <div style="margin-top:16px; padding:12px; background:var(--surface); border:1px solid var(--coral); border-radius:var(--r-md);">
        <p style="color:var(--coral); font-size:12px; font-weight:600; margin-bottom:4px;">⚠️ Warning: Encryption Key Change</p>
        <p style="font-size:11px; color:var(--text-lo); line-height:1.4;">Your PIN is used to encrypt your files. If you change your PIN, any documents you uploaded <b>before</b> this change will no longer be readable. You will need to delete and re-upload them.</p>
      </div>
    `,
    actions: [
      {
        label: 'Change PIN',
        className: 'btn-primary btn-sm',
        onClick: () => {
          const cur  = document.querySelector('#cur-pin')?.value;
          const np   = document.querySelector('#new-pin')?.value;
          const conf = document.querySelector('#conf-pin')?.value;
          if (!store.verifyPin(cur))    { showToast('Current PIN is incorrect', 'error'); return; }
          if (np.length < 4)            { showToast('New PIN must be 4 digits', 'error'); return; }
          if (np !== conf)              { showToast('PINs don\'t match', 'error'); return; }
          store.updateSettings({ pin: np });
          showToast('PIN changed successfully', 'success');
        }
      },
      { label: 'Cancel', className: 'btn-ghost btn-sm', onClick: () => {} }
    ],
  });
}
