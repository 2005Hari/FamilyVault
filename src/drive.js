/* ============================================================
   FAMILY VAULT — Google Drive File Storage
   Only handles binary file upload/download to appDataFolder.
   Authentication is now handled by Firebase Auth (firebase-sync.js).
   The Drive access token comes from the Google OAuth credential
   returned by Firebase's signInWithPopup(GoogleAuthProvider).
   ============================================================ */
import { store } from './store.js';
import { encryptBuffer, decryptBuffer } from './crypto.js';
import { getDriveToken } from './firebase-sync.js';

function getHeaders() {
  const token = getDriveToken() || localStorage.getItem('gdrive_access_token');
  if (!token) throw new Error('No Drive access token available');
  return { 'Authorization': 'Bearer ' + token };
}

// ── File Upload ─────────────────────────────────────────────

export async function uploadDocumentFile(fileBlob, fileName) {
  const metadata = {
    name: fileName,
    parents: ['appDataFolder'],
  };

  // Encrypt the file blob before uploading
  const arrayBuffer     = await fileBlob.arrayBuffer();
  const encryptedBuffer = await encryptBuffer(arrayBuffer, store.settings.pin);

  // 1. Create file metadata entry on Drive
  const metaRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method:  'POST',
    headers: { ...getHeaders(), 'Content-Type': 'application/json' },
    body:    JSON.stringify(metadata),
  });
  const newFile = await metaRes.json();
  if (!newFile.id) throw new Error('Drive metadata creation failed: ' + JSON.stringify(newFile));

  // 2. Upload the encrypted binary content to that file
  const uploadRes = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files/${newFile.id}?uploadType=media`,
    {
      method:  'PATCH',
      headers: { ...getHeaders(), 'Content-Type': 'application/octet-stream' },
      body:    encryptedBuffer,
    }
  );
  const result = await uploadRes.json();
  return result.id; // Return the Drive file ID stored in the document record
}

// ── File Download ────────────────────────────────────────────

export async function downloadDocumentFileUrl(fileId, mimeType = 'image/jpeg') {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { headers: getHeaders() }
  );

  if (!res.ok) throw new Error('Failed to fetch file from Drive');

  const encryptedBlob   = await res.blob();
  const encryptedBuffer = await encryptedBlob.arrayBuffer();

  try {
    const plaintextBuffer = await decryptBuffer(encryptedBuffer, store.settings.pin);
    const plaintextBlob   = new Blob([plaintextBuffer], { type: mimeType });
    return URL.createObjectURL(plaintextBlob);
  } catch (e) {
    console.error('Decryption failed:', e);
    throw new Error('Failed to decrypt document. Incorrect PIN?');
  }
}

// ── File Delete ──────────────────────────────────────────────

export async function deleteDocumentFile(fileId) {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}`,
    { method: 'DELETE', headers: getHeaders() }
  );
  if (!res.ok && res.status !== 204) {
    throw new Error('Failed to delete file from Drive');
  }
}

// ── Nuke All Drive Files (for reset) ────────────────────────

export async function nukeCloudDrive() {
  const listRes = await fetch(
    'https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&fields=files(id)',
    { headers: getHeaders() }
  );
  const data  = await listRes.json();
  const files = data.files || [];
  await Promise.all(
    files.map(f =>
      fetch(`https://www.googleapis.com/drive/v3/files/${f.id}`, {
        method: 'DELETE', headers: getHeaders(),
      })
    )
  );
}
