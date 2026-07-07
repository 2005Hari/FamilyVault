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

// Google provider — requests Drive scope in the same popup
const provider   = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/drive.appdata');
// Force full consent screen so Drive scope is ALWAYS granted (not cached without it)
provider.setCustomParameters({ prompt: 'consent', access_type: 'online' });

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
  // Firebase Auth popup — requests Drive scope via prompt:consent
  const result  = await signInWithPopup(auth, provider);
  _currentUser  = result.user;

  // Extract Drive-scoped access token directly from Firebase credential
  const cred   = GoogleAuthProvider.credentialFromResult(result);
  _driveToken  = cred?.accessToken || null;
  if (_driveToken) {
    localStorage.setItem('gdrive_access_token', _driveToken);
  }
  return _currentUser;
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
