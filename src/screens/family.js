/* ============================================================
   FAMILY VAULT — Family Members Screen
   ============================================================ */
import { store } from '../store.js';
import { router } from '../router.js';
import { showToast, showModal } from '../app.js';

const PERMISSIONS = ['owner', 'edit', 'upload', 'read'];
const PERM_LABELS = { owner: 'Owner', edit: 'Edit', upload: 'Upload', read: 'Read only' };

export function renderFamily(container) {
  const members = store.members;
  const allDevices = members.flatMap(m => (m.devices || []).map(d => ({ device: d, member: m })));

  container.innerHTML = `
    <div class="page-header">
      <p class="eyebrow">People</p>
      <h1 style="font-size:22px; margin-top:3px;">Family members</h1>
    </div>
    <div class="screen-inner" style="padding-top:8px;">

      <!-- Members list -->
      <div class="section-head" style="margin-top:16px;"><h3>Members (${members.length})</h3></div>
      <div class="field-card" id="members-list">
        ${members.map(m => renderMemberRow(m)).join('')}
      </div>

      <button class="btn-ghost" id="add-member-btn" style="margin-top:16px;">
        + Invite family member
      </button>

      <!-- Trusted devices -->
      <div class="section-head" style="margin-top:28px;"><h3>Trusted devices</h3></div>
      <div class="field-card">
        ${allDevices.length === 0
          ? `<div style="padding:16px 0; color:var(--text-lo); font-size:13px;">No devices registered.</div>`
          : allDevices.map((d, i) => renderDeviceRow(d, i === 0)).join('')
        }
      </div>

      <!-- Info -->
      <div class="ai-note" style="margin-top:20px;">
        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>
        <span>Permissions: <b>Owner</b> = full access · <b>Edit</b> = add & edit · <b>Upload</b> = add only · <b>Read</b> = view only</span>
      </div>

    </div>
  `;

  // Permission badges — cycle on click
  container.querySelectorAll('.perm-badge[data-member-id]').forEach(badge => {
    badge.addEventListener('click', () => {
      const memberId = badge.dataset.memberId;
      const member   = store.getMember(memberId);
      if (!member || member.permission === 'owner') return;

      const current = member.permission;
      const idx     = PERMISSIONS.indexOf(current);
      const next    = PERMISSIONS[(idx + 1) % PERMISSIONS.length];
      if (next === 'owner') return; // Can't cycle to owner

      store.updateMember(memberId, { permission: next });
      showToast(`${member.name}'s access set to ${PERM_LABELS[next]}`, 'success');
      renderFamily(container);
    });
  });

  // Delete member
  container.querySelectorAll('.member-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const memberId = btn.dataset.memberId;
      const member   = store.getMember(memberId);
      if (!member) return;

      showModal({
        title: 'Remove member?',
        body: `<p>Remove <b>${member.name}</b> from the family vault? They will lose access to all shared documents.</p>`,
        actions: [
          {
            label: 'Remove',
            className: 'btn-ghost btn-danger',
            onClick: () => {
              store.deleteMember(memberId);
              showToast(`${member.name} removed`, 'success');
              renderFamily(container);
            }
          },
          { label: 'Cancel', className: 'btn-ghost', onClick: () => {} }
        ],
      });
    });
  });

  // Add member
  container.querySelector('#add-member-btn').addEventListener('click', () => {
    showAddMemberModal(container);
  });
}

function renderMemberRow(member) {
  const isOwner = member.permission === 'owner';
  const permClass = isOwner ? 'owner' : member.permission === 'edit' ? 'edit' : '';

  return `
    <div class="member-row">
      <div class="avatar">${member.initials || member.name.charAt(0)}</div>
      <div class="m-info">
        <div class="m-name">${member.name}</div>
        <div class="m-role">${member.role || member.relation || ''}</div>
      </div>
      <span class="perm-badge ${permClass}" data-member-id="${member.id}" title="${isOwner ? 'Owner cannot be changed' : 'Click to change permission'}">${PERM_LABELS[member.permission] || member.permission}</span>
      ${!isOwner ? `<button class="btn-icon member-delete-btn" data-member-id="${member.id}" title="Remove member" style="margin-left:4px;">
        <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
      </button>` : ''}
    </div>
  `;
}

function renderDeviceRow(data, isThis) {
  return `
    <div class="device-item">
      <div class="device-icon">
        <svg viewBox="0 0 24 24"><rect x="5" y="2" width="14" height="20" rx="2"/><circle cx="12" cy="18" r="1" fill="currentColor"/></svg>
      </div>
      <div class="device-name">${data.device}</div>
      ${isThis
        ? `<div class="device-this">This device</div>`
        : `<div class="device-time">Active</div>`
      }
    </div>
  `;
}

function showAddMemberModal(container) {
  showModal({
    title: 'Add family member',
    body: `
      <div class="form-group">
        <label class="form-label">Full name</label>
        <input class="form-input" id="add-name" type="text" placeholder="e.g. Rohan Deshmukh" />
      </div>
      <div class="form-group">
        <label class="form-label">Relation</label>
        <select class="form-select" id="add-relation">
          <option value="Spouse">Spouse</option>
          <option value="Son">Son</option>
          <option value="Daughter">Daughter</option>
          <option value="Parent">Parent</option>
          <option value="Sibling">Sibling</option>
          <option value="Other">Other</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Permission level</label>
        <select class="form-select" id="add-permission">
          <option value="read">Read only — can view documents</option>
          <option value="upload">Upload — can add documents</option>
          <option value="edit" selected>Edit — can add and modify</option>
        </select>
      </div>
    `,
    actions: [
      {
        label: 'Add member',
        className: 'btn-primary btn-sm',
        onClick: () => {
          const name       = document.querySelector('#add-name')?.value.trim();
          const relation   = document.querySelector('#add-relation')?.value;
          const permission = document.querySelector('#add-permission')?.value;
          if (!name) { showToast('Please enter a name', 'error'); return; }

          store.addMember({
            name,
            relation,
            role: relation,
            permission,
            initials: name.charAt(0).toUpperCase(),
          });
          showToast(`${name} added to family vault`, 'success');
          renderFamily(container);
        }
      },
      { label: 'Cancel', className: 'btn-ghost btn-sm', onClick: () => {} }
    ],
  });
}
