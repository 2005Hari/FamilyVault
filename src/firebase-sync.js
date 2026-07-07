/* ============================================================
   FAMILY VAULT — Firebase Sync (Firestore) + Google Drive Files
   ============================================================
   - Firebase Auth with Google Sign-In handles authentication
   - Firestore stores all vault metadata (documents list, settings, etc.)
   - Google Drive appDataFolder stores actual binary files (PDFs, images)
   - The Google OAuth token from Firebase Auth is reused for Drive API
*/

import { initializeApp } from 'firebase/app';
import {
  getFirestore, doc, setDoc, getDoc, onSnapshot
} from 'firebase/firestore';
import {
  getAuth, signInWithPopup, GoogleAuthProvider,
  signOut as _signOut, onAuthStateChanged
} from 'firebase/auth';

// ── Firebase Config ─────────────────────────────────────────
const firebaseConfig = {
  apiKey:            'AIzaSyAuwb6ioykq85iIIqCZn7jznFdVsjdLOLA',
  authDomain:        'familyvault-ede5b.firebaseapp.com',
  projectId:         'familyvault-ede5b',
  storageBucket:     'familyvault-ede5b.firebasestorage.app',
  messagingSenderId: '704477559444',
  appId:             '1:704477559444:web:43130b1b7badadf06cd281',
};

const app        = initializeApp(firebaseConfig);
const db         = getFirestore(app);
const auth       = getAuth(app);

// Google provider — also requests Drive scope so we can store files
const provider   = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/drive.appdata');

// ── Auth State ───────────────────────────────────────────────
let _currentUser     = null;
let _driveToken      = null;  // Google OAuth access token reused for Drive API
let _unsubscribeVault = null; // Firestore real-time listener unsubscribe fn

export function isSignedIn()       { return !!_currentUser; }
export function getUser()          { return _currentUser; }
export function getDriveToken()    { return _driveToken; }

// Called once on app startup — resolves when auth state is known
export function waitForAuth() {
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      _currentUser = user;
      unsub();
      resolve(user);
    });
  });
}

// ── Sign In ──────────────────────────────────────────────────
export async function signIn() {
  // Step 1: Firebase Auth — gets user identity (email, UID, profile)
  const result = await signInWithPopup(auth, provider);
  _currentUser  = result.user;

  // Step 2: Request a separate Drive-scoped token via GSI Token Client.
  // Firebase Auth's token doesn't reliably include drive.appdata scope,
  // so we must request it explicitly using the Google Identity Services library.
  _driveToken = await requestDriveToken();
  return _currentUser;
}

// Request a Google OAuth token with drive.appdata scope using GSI
function requestDriveToken() {
  return new Promise((resolve, reject) => {
    // GSI client_id — same project as Firebase
    const CLIENT_ID = '712266813967-p2tpl2l2p38nqvcur45pdmh0kqrlbtr0.apps.googleusercontent.com';

    const waitForGSI = (attempts = 0) => {
      if (window.google?.accounts?.oauth2) {
        const tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: 'https://www.googleapis.com/auth/drive.appdata',
          hint: _currentUser?.email || '',
          callback: (response) => {
            if (response.error) {
              reject(new Error('Drive token request failed: ' + response.error));
              return;
            }
            _driveToken = response.access_token;
            localStorage.setItem('gdrive_access_token', _driveToken);
            resolve(_driveToken);
          },
        });
        tokenClient.requestAccessToken({ prompt: '' }); // '' = no prompt if already consented
      } else if (attempts < 20) {
        setTimeout(() => waitForGSI(attempts + 1), 300);
      } else {
        // Fallback to cached token
        const cached = localStorage.getItem('gdrive_access_token');
        resolve(cached);
      }
    };
    waitForGSI();
  });
}


// ── Sign Out ─────────────────────────────────────────────────
export async function signOut() {
  if (_unsubscribeVault) { _unsubscribeVault(); _unsubscribeVault = null; }
  _driveToken  = null;
  _currentUser = null;
  localStorage.removeItem('gdrive_access_token');
  await _signOut(auth);
}

// ── Firestore: Write Vault ───────────────────────────────────
export async function writeVault(data) {
  if (!_currentUser) throw new Error('Not signed in');
  const ref = doc(db, 'vaults', _currentUser.uid);
  await setDoc(ref, { ...data, _updatedAt: new Date().toISOString() });
}

// ── Firestore: Read Vault Once ───────────────────────────────
export async function readVault() {
  if (!_currentUser) return null;
  const ref  = doc(db, 'vaults', _currentUser.uid);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

// ── Firestore: Real-time Listener ───────────────────────────
// Calls callback(data) whenever another device saves a change.
// Returns an unsubscribe function.
export function subscribeVault(callback) {
  if (!_currentUser) return () => {};
  const ref = doc(db, 'vaults', _currentUser.uid);
  _unsubscribeVault = onSnapshot(ref, (snap) => {
    if (snap.exists()) callback(snap.data());
  });
  return _unsubscribeVault;
}
