/* ============================================================
   FAMILY VAULT — Data Store (localStorage + Google Drive)
   ============================================================ */
import { readDatabase, writeDatabase, isSignedIn } from './drive.js';

const KEYS = {
  DOCS:     'fv_documents',
  MEMBERS:  'fv_members',
  ACTIVITY: 'fv_activity',
  SETTINGS: 'fv_settings',
  LOCATIONS:'fv_locations',
};

// ── Demo seed data ──────────────────────────────────────────

const DEMO_DOCS = [];

const DEMO_MEMBERS = [
  { id: 'member-1', name: 'Vault Owner', role: 'Owner', relation: 'Owner', permission: 'owner', initials: 'V', devices: [] }
];

const DEMO_ACTIVITY = [];

const DEMO_LOCATIONS = [];

const DEFAULT_SETTINGS = {
  familyName:    'My Family Vault',
  ownerInitials: 'V',
  pin:           '1234',
  autoLockMins:  5,
  seeded:        true,
};

// ── Store class ─────────────────────────────────────────────

class Store {
  constructor() {
    this._listeners = {};
    this.currentMemberId = null;
    this._init();
  }

  _init() {
    // Seed if first run
    if (!localStorage.getItem(KEYS.SETTINGS)) {
      localStorage.setItem(KEYS.DOCS,      JSON.stringify(DEMO_DOCS));
      localStorage.setItem(KEYS.MEMBERS,   JSON.stringify(DEMO_MEMBERS));
      localStorage.setItem(KEYS.ACTIVITY,  JSON.stringify(DEMO_ACTIVITY));
      localStorage.setItem(KEYS.SETTINGS,  JSON.stringify(DEFAULT_SETTINGS));
      localStorage.setItem(KEYS.LOCATIONS, JSON.stringify(DEMO_LOCATIONS));
    }
  }

  // ── Getters ──
  get documents()  { return JSON.parse(localStorage.getItem(KEYS.DOCS)      || '[]'); }
  get members()    { return JSON.parse(localStorage.getItem(KEYS.MEMBERS)    || '[]'); }
  get activity()   { return JSON.parse(localStorage.getItem(KEYS.ACTIVITY)   || '[]'); }
  get settings()   { return JSON.parse(localStorage.getItem(KEYS.SETTINGS)   || '{}'); }
  get locations()  { return JSON.parse(localStorage.getItem(KEYS.LOCATIONS)  || '[]'); }

  // ── Documents ──
  getDocument(id) {
    return this.documents.find(d => d.id === id) || null;
  }

  getDocumentsByCategory(cat) {
    return this.documents.filter(d => d.category === cat);
  }

  getExpiringDocuments(days = 30) {
    const cutoff = Date.now() + days * 86400000;
    return this.documents.filter(d => d.expiresAt && new Date(d.expiresAt).getTime() < cutoff);
  }

  addDocument(doc) {
    const docs = this.documents;
    const newDoc = {
      id: 'doc-' + Date.now(),
      addedAt: new Date().toISOString(),
      encrypted: true,
      ...doc,
    };
    docs.unshift(newDoc);
    localStorage.setItem(KEYS.DOCS, JSON.stringify(docs));

    // Log activity
    this.addActivity({ type: 'add', text: `Added <b>${newDoc.title}</b>`, docId: newDoc.id });

    this._emit('documents');
    return newDoc;
  }

  updateDocument(id, updates) {
    const docs = this.documents.map(d => d.id === id ? { ...d, ...updates } : d);
    localStorage.setItem(KEYS.DOCS, JSON.stringify(docs));
    this.addActivity({ type: 'edit', text: `Updated <b>${updates.title || id}</b>`, docId: id });
    this._emit('documents');
  }

  deleteDocument(id) {
    const doc = this.getDocument(id);
    const docs = this.documents.filter(d => d.id !== id);
    localStorage.setItem(KEYS.DOCS, JSON.stringify(docs));
    if (doc) this.addActivity({ type: 'delete', text: `Deleted <b>${doc.title}</b>`, docId: null });
    this._emit('documents');
  }

  searchDocuments(query) {
    if (!query.trim()) return this.documents;
    const q = query.toLowerCase();

    // Natural language shortcuts
    if (q.includes('expir')) {
      return this.getExpiringDocuments(60);
    }

    return this.documents.filter(d => {
      const searchable = [
        d.title,
        d.category,
        d.documentType,
        d.documentNumber,
        d.notes,
        d.tags?.join(' '),
        Object.values(d.fields || {}).join(' '),
        d.location?.room, d.location?.folder,
      ].join(' ').toLowerCase();
      return searchable.includes(q);
    });
  }

  // ── Members ──
  getMember(id) {
    return this.members.find(m => m.id === id) || null;
  }

  getCurrentMember() {
    return this.getMember(this.currentMemberId) || this.members[0] || null;
  }

  setCurrentMember(id) {
    this.currentMemberId = id;
    this._emit('members');
  }

  addMember(member) {
    const members = this.members;
    const newMember = { id: 'member-' + Date.now(), devices: [], ...member };
    members.push(newMember);
    localStorage.setItem(KEYS.MEMBERS, JSON.stringify(members));
    this.addActivity({ type: 'add', text: `Added family member <b>${newMember.name}</b>`, docId: null });
    this._emit('members');
    return newMember;
  }

  updateMember(id, updates) {
    const members = this.members.map(m => m.id === id ? { ...m, ...updates } : m);
    localStorage.setItem(KEYS.MEMBERS, JSON.stringify(members));
    this._emit('members');
  }

  deleteMember(id) {
    const member = this.getMember(id);
    const members = this.members.filter(m => m.id !== id);
    localStorage.setItem(KEYS.MEMBERS, JSON.stringify(members));
    if (member) this.addActivity({ type: 'delete', text: `Removed <b>${member.name}</b> from family`, docId: null });
    this._emit('members');
  }

  // ── Activity ──
  addActivity(entry) {
    const activity = this.activity;
    activity.unshift({ id: 'act-' + Date.now(), time: Date.now(), ...entry });
    if (activity.length > 50) activity.pop();
    localStorage.setItem(KEYS.ACTIVITY, JSON.stringify(activity));
    this._emit('activity');
  }

  // ── Settings ──
  updateSettings(updates) {
    const settings = { ...this.settings, ...updates };
    localStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
    this._emit('settings');
  }

  verifyPin(pin) {
    return this.settings.pin === pin;
  }

  // ── Locations ──
  addLocation(locationData) {
    const locations = this.locations;
    locations.push({ id: 'loc-' + Date.now(), ...locationData });
    localStorage.setItem(KEYS.LOCATIONS, JSON.stringify(locations));
    this._emit('locations');
  }

  // ── WebAuthn / Biometrics ──
  async registerBiometrics() {
    if (!window.PublicKeyCredential) throw new Error("Biometrics not supported on this browser.");
    
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);
    const userId = new Uint8Array(16);
    crypto.getRandomValues(userId);

    const credential = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: "Family Vault" },
        user: {
          id: userId,
          name: this.currentMemberId || "owner",
          displayName: this.getCurrentMember()?.name || "Vault User"
        },
        pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
        authenticatorSelection: { 
          authenticatorAttachment: "platform", 
          userVerification: "required",
          requireResidentKey: true // Make it a discoverable passkey
        },
        timeout: 60000,
      }
    });

    if (credential) {
      this.updateSettings({ biometricEnrolled: true });
      return true;
    }
    return false;
  }

  async verifyBiometrics() {
    if (!window.PublicKeyCredential) throw new Error("Biometrics not supported");
    if (!this.settings.biometricEnrolled) throw new Error("No biometrics registered");
    
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);

    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        userVerification: "required",
      }
    });

    return !!assertion;
  }

  // ── Stats ──
  getStats() {
    const docs = this.documents;
    const expiring = this.getExpiringDocuments(30);
    const totalBytes = docs.reduce((acc, d) => {
      if (d.fileData) acc += d.fileData.length * 0.75; // base64 rough estimate
      return acc;
    }, 0);
    return {
      total: docs.length,
      expiringSoon: expiring.length,
      storageBytes: totalBytes,
      storageLabel: totalBytes > 1e6 ? (totalBytes / 1e6).toFixed(1) + ' MB'
                  : totalBytes > 1e3 ? (totalBytes / 1e3).toFixed(0) + ' KB'
                  : docs.length + ' items',
    };
  }

  // ── Location docs ──
  getDocsByLocation(room, cupboard = null) {
    return this.documents.filter(d => {
      if (!d.location) return false;
      if (d.location.room !== room) return false;
      if (cupboard && d.location.cupboard !== cupboard) return false;
      return true;
    });
  }

  // ── Export / Import ──
  exportData() {
    return JSON.stringify({
      documents: this.documents,
      members:   this.members,
      activity:  this.activity,
      settings:  this.settings,
      locations: this.locations,
      exportedAt: new Date().toISOString(),
      version: 1,
    }, null, 2);
  }

  importData(jsonStr) {
    const data = JSON.parse(jsonStr);
    if (data.documents) {
      this.documents = data.documents;
      localStorage.setItem(KEYS.DOCS, JSON.stringify(data.documents));
    }
    if (data.members) {
      this.members = data.members;
      localStorage.setItem(KEYS.MEMBERS, JSON.stringify(data.members));
    }
    if (data.activity) {
      this.activity = data.activity;
      localStorage.setItem(KEYS.ACTIVITY, JSON.stringify(data.activity));
    }
    if (data.settings) {
      this.settings = data.settings;
      localStorage.setItem(KEYS.SETTINGS, JSON.stringify(data.settings));
    }
    if (data.locations) {
      this.locations = data.locations;
      localStorage.setItem(KEYS.LOCATIONS, JSON.stringify(data.locations));
    }
    this._emit('all', true); // skipSync = true
  }

  clearAll() {
    Object.values(KEYS).forEach(k => localStorage.removeItem(k));
    this._init();
    this._emit('all');
  }

  // ── Reactivity ──
  subscribe(key, cb) {
    if (!this._listeners[key]) this._listeners[key] = [];
    this._listeners[key].push(cb);
    return () => {
      this._listeners[key] = this._listeners[key].filter(l => l !== cb);
    };
  }

  _emit(key, skipSync = false) {
    (this._listeners[key] || []).forEach(cb => cb());
    (this._listeners['all'] || []).forEach(cb => cb());
    if (!skipSync) this._syncToDrive();
  }

  // ── Google Drive Sync ──
  _getDataHash(data = null) {
    if (!data) {
      return JSON.stringify({
        documents: this.documents,
        members:   this.members,
        activity:  this.activity,
        settings:  this.settings,
        locations: this.locations
      });
    }
    return JSON.stringify({
      documents: data.documents || [],
      members:   data.members || [],
      activity:  data.activity || [],
      settings:  data.settings || {},
      locations: data.locations || []
    });
  }

  async pullFromDrive(isBackground = false) {
    if (!isSignedIn()) return;
    try {
      let data = await readDatabase();
      if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch (e) { console.error('Parse err', e); }
      }
      if (data) {
        // If the remote data has the old dummy data, NUKE IT on Drive by overwriting it with local
        if (data.documents && data.documents.some(d => d.title === "Dad's Passport" || d.title === "Car Insurance")) {
           console.log("Found dummy data on Drive! Nuking it...");
           await this._syncToDrive(true);
           return;
        }

        const remoteHash = this._getDataHash(data);
        const localHash = this._getDataHash();
        
        if (remoteHash !== localHash) {
          this.importData(JSON.stringify(data));
          if (isBackground) {
            const { showToast } = await import('./app.js');
            showToast('Vault updated with new changes from Drive', 'success');
            
            // Auto-refresh the current view if we are not editing
            const { router } = await import('./router.js');
            const path = router.currentPath();
            if (path && path !== 'add' && !path.startsWith('detail')) {
              router.navigate(path, true);
            }
          }
        }
      } else {
        // First time, upload our current local data
        await this._syncToDrive(true);
      }
    } catch (e) {
      console.error('Failed to pull from drive', e);
    }
  }

  startPolling() {
    if (this._polling) return;
    this._polling = setInterval(() => {
      // Prevent overwriting if we are currently saving or adding a document
      if (this._isSyncing) return;
      if (window.location.hash.includes('add')) return;
      
      this.pullFromDrive(true);
    }, 15000); // Check every 15 seconds
  }

  async _syncToDrive(force = false) {
    if (!isSignedIn()) return;
    
    // Prevent overlapping syncs
    if (this._isSyncing) return;
    this._isSyncing = true;
    
    try {
      // Show sync indicator in the UI if possible
      const appEl = document.getElementById('app');
      let syncBadge = document.getElementById('sync-badge');
      if (appEl && !syncBadge) {
        syncBadge = document.createElement('div');
        syncBadge.id = 'sync-badge';
        syncBadge.innerHTML = `<div class="spinner" style="width:12px;height:12px;border-width:2px;margin-right:6px;"></div> <span style="font-size:11px;">Saving to Drive...</span>`;
        syncBadge.style.cssText = 'position:fixed; top:10px; right:10px; background:var(--surface-raised); border:1px solid var(--line); padding:4px 8px; border-radius:12px; display:flex; align-items:center; z-index:9999; color:var(--text-hi); box-shadow:0 4px 12px rgba(0,0,0,0.5);';
        appEl.appendChild(syncBadge);
      }

      const data = JSON.parse(this.exportData());
      await writeDatabase(data);
      
      if (syncBadge) {
        syncBadge.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" style="margin-right:4px;"><path d="M20 6L9 17l-5-5" stroke="var(--teal)" stroke-width="2.5" stroke-linecap="round" fill="none"/></svg> <span style="font-size:11px;color:var(--text-hi);">Saved</span>`;
        setTimeout(() => syncBadge.remove(), 2000);
      }
    } catch (e) {
      console.error('Failed to sync to drive', e);
      const syncBadge = document.getElementById('sync-badge');
      if (syncBadge) syncBadge.remove();
    } finally {
      this._isSyncing = false;
    }
  }
}

export const store = new Store();

// ── Helpers ─────────────────────────────────────────────────

export function formatTimeAgo(ts) {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return m + 'm';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h';
  const d = Math.floor(h / 24);
  if (d < 30) return d + 'd';
  return Math.floor(d / 30) + 'mo';
}

export function formatDate(isoStr) {
  if (!isoStr) return '—';
  return new Date(isoStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function daysUntil(isoStr) {
  if (!isoStr) return null;
  return Math.ceil((new Date(isoStr).getTime() - Date.now()) / 86400000);
}

export const CATEGORIES = [
  { name: 'Identity',  icon: `<rect x="4" y="3" width="16" height="18" rx="2"/><circle cx="12" cy="10" r="2.5"/><path d="M8 17c0-2 2-3 4-3s4 1 4 3"/>` },
  { name: 'Education', icon: `<path d="M22 10L12 4 2 10l10 6 10-6z"/><path d="M6 12v5a6 6 0 0012 0v-5"/>` },
  { name: 'Property',  icon: `<path d="M3 10l9-7 9 7v9a2 2 0 01-2 2H5a2 2 0 01-2-2v-9z"/><path d="M9 21V13h6v8"/>` },
  { name: 'Vehicles',  icon: `<path d="M4 17V7l8-4 8 4v10l-8 4-8-4z"/>` },
  { name: 'Medical',   icon: `<path d="M9 3h6l2 4H7l2-4z"/><rect x="4" y="7" width="16" height="14" rx="2"/><path d="M12 11v4M10 13h4"/>` },
  { name: 'Banking',   icon: `<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18M7 14h2M13 14h4"/>` },
  { name: 'Insurance', icon: `<path d="M12 2l2.4 5.5 5.6 1.5-4.5 3.9 1.5 6.1L12 16.3 7 19l1.5-6.1L4 9l5.6-1.5z"/>` },
  { name: 'Bills',     icon: `<path d="M6 2h9l3 3v17H6z"/><path d="M9 8h6M9 12h6M9 16h4"/>` },
];

export function getCategoryIcon(catName) {
  const cat = CATEGORIES.find(c => c.name === catName);
  return cat ? cat.icon : CATEGORIES[0].icon;
}

export function getCategoryColor(catName) {
  const colors = {
    'Identity':  '#E4C77E',
    'Education': '#4FA491',
    'Property':  '#8B73C4',
    'Vehicles':  '#D9756C',
    'Medical':   '#4FA491',
    'Banking':   '#E4C77E',
    'Insurance': '#B68D40',
    'Bills':     '#9AA0AE',
  };
  return colors[catName] || '#E4C77E';
}
