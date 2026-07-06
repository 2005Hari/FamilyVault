/* ============================================================
   FAMILY VAULT — Google Drive API Wrapper (appDataFolder)
   ============================================================ */
// REPLACE THIS WITH YOUR ACTUAL CLIENT ID FROM GOOGLE CLOUD CONSOLE!
const CLIENT_ID = '712266813967-p2tpl2l2p38nqvcur45pdmh0kqrlbtr0.apps.googleusercontent.com';

import { store } from './store.js';
import { encryptBuffer, decryptBuffer } from './crypto.js';

const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
const SCOPES = 'https://www.googleapis.com/auth/drive.appdata';

let tokenClient;
let accessToken = localStorage.getItem('gdrive_access_token') || null;
let tokenExpiry = parseInt(localStorage.getItem('gdrive_token_expiry')) || 0;

if (Date.now() > tokenExpiry) {
  accessToken = null;
}
let gapiInited = false;

// Initialize GAPI and GSI
export async function initDrive() {
  return new Promise((resolve, reject) => {
    if (gapiInited) return resolve();

    // Check if scripts are loaded
    if (!window.gapi || !window.google) {
      setTimeout(() => initDrive().then(resolve).catch(reject), 500);
      return;
    }

    window.gapi.load('client', async () => {
      try {
        await window.gapi.client.init({
          discoveryDocs: [DISCOVERY_DOC],
        });
        
        tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: SCOPES,
          callback: '', // defined later
        });

        gapiInited = true;
        resolve();
      } catch (e) {
        reject(e);
      }
    });
  });
}

// Sign in and get access token
export function signIn() {
  return new Promise((resolve, reject) => {
    if (!tokenClient) return reject(new Error('Drive not initialized'));

    tokenClient.callback = async (resp) => {
      if (resp.error !== undefined) {
        reject(resp);
      }
      accessToken = resp.access_token;
      tokenExpiry = Date.now() + (resp.expires_in * 1000);
      localStorage.setItem('gdrive_access_token', accessToken);
      localStorage.setItem('gdrive_token_expiry', tokenExpiry.toString());
      resolve(accessToken);
    };

    if (accessToken === null) {
      tokenClient.requestAccessToken({prompt: 'consent'});
    } else {
      tokenClient.requestAccessToken({prompt: ''});
    }
  });
}

export function signOut() {
  if (accessToken) {
    window.google.accounts.oauth2.revoke(accessToken, () => {
      accessToken = null;
      localStorage.removeItem('gdrive_access_token');
      localStorage.removeItem('gdrive_token_expiry');
      window.localStorage.clear(); // Clear local cache on sign out
    });
  }
}

// Check if user is signed in
export function isSignedIn() {
  if (accessToken && Date.now() > tokenExpiry) {
    accessToken = null;
    localStorage.removeItem('gdrive_access_token');
  }
  return accessToken !== null;
}

// Helper to get headers for manual fetch requests (useful for uploads/downloads)
function getHeaders() {
  return {
    'Authorization': 'Bearer ' + accessToken,
  };
}

// ── Database JSON Operations ───────────────────────────────────

const DB_FILENAME = 'family-vault-db.json';

// Find a file by name in appDataFolder
async function findFileId(fileName) {
  const response = await window.gapi.client.drive.files.list({
    spaces: 'appDataFolder',
    q: `name='${fileName}'`,
    fields: 'files(id, name)',
  });
  const files = response.result.files;
  if (files && files.length > 0) {
    return files[0].id;
  }
  return null;
}

// Download JSON database
export async function readDatabase() {
  const fileId = await findFileId(DB_FILENAME);
  if (!fileId) return null; // Doesn't exist yet

  const response = await window.gapi.client.drive.files.get({
    fileId: fileId,
    alt: 'media',
  });
  return response.result;
}

// Upload or create JSON database
export async function writeDatabase(dataObj) {
  const fileId = await findFileId(DB_FILENAME);
  const fileContent = JSON.stringify(dataObj);

  if (fileId) {
    // Update existing file: just send the raw media
    const url = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`;
    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        ...getHeaders(),
        'Content-Type': 'application/json',
      },
      body: fileContent,
    });
    return await res.json();
  } else {
    // Create new file metadata first
    const metadata = {
      name: DB_FILENAME,
      parents: ['appDataFolder'],
    };

    const metaRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        ...getHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(metadata)
    });
    
    const newFile = await metaRes.json();

    // Upload content to the newly created file
    const url = `https://www.googleapis.com/upload/drive/v3/files/${newFile.id}?uploadType=media`;
    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        ...getHeaders(),
        'Content-Type': 'application/json',
      },
      body: fileContent,
    });
    return await res.json();
  }
}

// ── File Upload / Download (for actual scanned docs) ───────────

export async function uploadDocumentFile(fileBlob, fileName) {
  const metadata = {
    name: fileName,
    parents: ['appDataFolder'],
  };

  // Encrypt the file blob before uploading
  const arrayBuffer = await fileBlob.arrayBuffer();
  const encryptedBuffer = await encryptBuffer(arrayBuffer, store.settings.pin);

  // 1. Create file metadata
  const metaRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      ...getHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(metadata)
  });
  
  const newFile = await metaRes.json();

  // 2. Upload the encrypted binary content
  const url = `https://www.googleapis.com/upload/drive/v3/files/${newFile.id}?uploadType=media`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      ...getHeaders(),
      'Content-Type': 'application/octet-stream',
    },
    body: encryptedBuffer,
  });

  const data = await res.json();
  return data.id; // Return the Drive file ID
}

export async function downloadDocumentFileUrl(fileId, mimeType = 'image/jpeg') {
  // We have to fetch it and create an object URL to display it in an <img> tag securely
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: getHeaders(),
  });
  
  if (!res.ok) throw new Error('Failed to fetch file');
  
  // Decrypt the blob
  const encryptedBlob = await res.blob();
  const encryptedBuffer = await encryptedBlob.arrayBuffer();
  
  try {
    const plaintextBuffer = await decryptBuffer(encryptedBuffer, store.settings.pin);
    // Use the passed mimeType so the browser can render it properly (otherwise strict MIME checking breaks <img> tags)
    const plaintextBlob = new Blob([plaintextBuffer], { type: mimeType });
    return URL.createObjectURL(plaintextBlob);
  } catch (e) {
    console.error("Decryption failed:", e);
    throw new Error('Failed to decrypt document. Incorrect PIN?');
  }
}

export async function deleteDocumentFile(fileId) {
  await window.gapi.client.drive.files.delete({
    fileId: fileId
  });
}
