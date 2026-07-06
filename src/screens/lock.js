/* ============================================================
   FAMILY VAULT — Lock Screen
   ============================================================ */
import { store } from '../store.js';
import { router } from '../router.js';
import { showToast, checkAndNotifyExpirations } from '../app.js';
import { signIn, isSignedIn, initDrive } from '../drive.js';

let pinBuffer = '';
let isOnboarding = false;
let onboardStep = 1; // 1=family name, 2=set PIN, 3=confirm PIN
let onboardData = {};

export function renderLock(container) {
  if (!isSignedIn()) {
    renderGoogleSignIn(container);
  } else {
    // Proactively pull from Drive in the background while they enter PIN
    store.pullFromDrive();
    checkVaultState(container);
  }
}

function renderGoogleSignIn(container) {
  container.innerHTML = `
    <div class="lock-screen" style="display:flex; flex-direction:column; justify-content:center; align-items:center;">
      <div class="lock-dial" style="margin-bottom:30px;">
        <svg viewBox="0 0 170 170" fill="none">
          <circle cx="85" cy="85" r="80" stroke="#2A2416" stroke-width="1"/>
          <g class="dial-outer">
            <circle cx="85" cy="85" r="66" stroke="#B68D40" stroke-width="1" stroke-dasharray="2 7" opacity="0.5"/>
          </g>
          <circle cx="85" cy="85" r="50" stroke="#E4C77E" stroke-width="1.2" opacity="0.6"/>
          <circle cx="85" cy="85" r="32" fill="#171C2C" stroke="#E4C77E" stroke-width="1.4"/>
          <path d="M76 82v-6a9 9 0 0118 0v6" stroke="#E4C77E" stroke-width="1.8" fill="none" stroke-linecap="round"/>
          <rect x="72" y="82" width="26" height="19" rx="3" fill="#0E1220" stroke="#E4C77E" stroke-width="1.6"/>
        </svg>
      </div>
      <h1 class="lock-title">Family Vault</h1>
      <p class="lock-sub muted" style="margin-bottom:40px; text-align:center;">Securely synced to your Google Drive</p>
      
      <button class="btn-primary" id="google-signin-btn" style="padding:12px 24px; font-size:16px;">
        Sign in with Google
      </button>
      <div id="drive-loading" style="display:none; margin-top:20px; color:var(--text-lo);">
        <div class="spinner" style="display:inline-block; vertical-align:middle; margin-right:8px;"></div>
        Syncing with Drive...
      </div>
    </div>
  `;

  // Pre-init drive API
  initDrive();

  container.querySelector('#google-signin-btn').addEventListener('click', async () => {
    try {
      await signIn();
      container.querySelector('#google-signin-btn').style.display = 'none';
      container.querySelector('#drive-loading').style.display = 'block';
      
      await store.pullFromDrive();
      checkVaultState(container);
    } catch (e) {
      showToast('Sign in failed or cancelled', 'error');
      container.querySelector('#google-signin-btn').style.display = 'block';
      container.querySelector('#drive-loading').style.display = 'none';
    }
  });
}

function checkVaultState(container) {
  const settings = store.settings;
  isOnboarding = !settings.seeded && !settings.pin;

  if (isOnboarding) {
    renderOnboarding(container);
  } else {
    renderPinScreen(container);
  }
}

function renderPinScreen(container) {
  pinBuffer = '';
  const settings = store.settings;

  container.innerHTML = `
    <div class="lock-screen">
      <div class="lock-dial">
        <svg viewBox="0 0 170 170" fill="none">
          <circle cx="85" cy="85" r="80" stroke="#2A2416" stroke-width="1"/>
          <g class="dial-outer">
            <circle cx="85" cy="85" r="66" stroke="#B68D40" stroke-width="1" stroke-dasharray="2 7" opacity="0.5"/>
          </g>
          <circle cx="85" cy="85" r="50" stroke="#E4C77E" stroke-width="1.2" opacity="0.6"/>
          <g stroke="#B68D40" stroke-width="1.4">
            <line x1="85" y1="5"   x2="85" y2="18"/>
            <line x1="85" y1="152" x2="85" y2="165"/>
            <line x1="5"  y1="85"  x2="18" y2="85"/>
            <line x1="152" y1="85" x2="165" y2="85"/>
          </g>
          <circle cx="85" cy="85" r="32" fill="#171C2C" stroke="#E4C77E" stroke-width="1.4"/>
          <path d="M76 82v-6a9 9 0 0118 0v6" stroke="#E4C77E" stroke-width="1.8" fill="none" stroke-linecap="round"/>
          <rect x="72" y="82" width="26" height="19" rx="3" fill="#0E1220" stroke="#E4C77E" stroke-width="1.6"/>
          <circle cx="85" cy="93" r="2" fill="#E4C77E"/>
        </svg>
      </div>

      <h1 class="lock-title">${settings.familyName || 'Family Vault'}</h1>
      <p class="lock-sub muted">Enter your PIN to unlock</p>

      <div class="pin-dots" id="pin-dots">
        <div class="pin-dot"></div>
        <div class="pin-dot"></div>
        <div class="pin-dot"></div>
        <div class="pin-dot"></div>
      </div>

      <div class="keypad">
        ${renderKey('1', 'ABC')}
        ${renderKey('2', 'DEF')}
        ${renderKey('3', 'GHI')}
        ${renderKey('4', 'JKL')}
        ${renderKey('5', 'MNO')}
        ${renderKey('6', 'PQR')}
        ${renderKey('7', 'STU')}
        ${renderKey('8', 'VWX')}
        ${renderKey('9', 'YZ')}
        <button class="key ghost face" id="face-btn" title="Face ID">
          <svg viewBox="0 0 24 24">
            <rect x="3" y="3" width="18" height="18" rx="5" stroke="#E4C77E" stroke-width="1.5" fill="none"/>
            <circle cx="9"  cy="10" r="1.4" fill="#E4C77E"/>
            <circle cx="15" cy="10" r="1.4" fill="#E4C77E"/>
            <path d="M8 15c1.2 1 2.6 1.5 4 1.5s2.8-.5 4-1.5" stroke="#E4C77E" stroke-width="1.5" stroke-linecap="round" fill="none"/>
          </svg>
        </button>
        ${renderKey('0', '')}
        <button class="key ghost" id="del-btn" style="font-size:13px; color:var(--text-lo);">⌫</button>
      </div>

      <p class="unlock-hint">Demo PIN: <b style="color:var(--brass-soft);">1234</b> · or tap the face icon</p>
    </div>
  `;

  // Bind keypad
  container.querySelectorAll('.key[data-digit]').forEach(btn => {
    btn.addEventListener('click', () => pressDigit(btn.dataset.digit));
  });

  container.querySelector('#face-btn').addEventListener('click', async () => {
    try {
      if (store.settings.biometricEnrolled) {
        const ok = await store.verifyBiometrics();
        if (ok) {
          store.setCurrentMember('member-1');
          unlock();
        }
      } else {
        showToast('Enable Biometrics in Settings first', 'error');
      }
    } catch (e) {
      showToast('Biometric unlock failed', 'error');
    }
  });
  container.querySelector('#del-btn').addEventListener('click', deleteDigit);
}

function renderKey(digit, sub) {
  return `<button class="key" data-digit="${digit}">
    ${digit}
    ${sub ? `<span class="key-sub">${sub}</span>` : ''}
  </button>`;
}

function pressDigit(digit) {
  if (pinBuffer.length >= 4) return;
  pinBuffer += digit;
  updateDots();
  if (pinBuffer.length === 4) {
    const container = document.querySelector('#app');
    setTimeout(() => checkPin(container), 160);
  }
}

function deleteDigit() {
  if (pinBuffer.length > 0) {
    pinBuffer = pinBuffer.slice(0, -1);
    updateDots();
  }
}

function updateDots() {
  const dots = document.querySelectorAll('.pin-dot');
  dots.forEach((d, i) => {
    if (i < pinBuffer.length) {
      d.classList.add('filled');
    } else {
      d.classList.remove('filled');
    }
  });
}

function checkPin(container = document.querySelector('#app')) {
  if (store.verifyPin(pinBuffer)) {
    store.setCurrentMember('member-1');
    unlock();
  } else {
    // Shake animation
    const dots = document.querySelector('.pin-dots');
    if (dots) {
      dots.style.animation = 'shake 0.35s ease';
      dots.style.setProperty('--shake-color', 'var(--coral)');
      document.querySelectorAll('.pin-dot.filled').forEach(d => {
        d.style.background = 'var(--coral)';
        d.style.borderColor = 'var(--coral)';
      });
      setTimeout(() => {
        dots.style.animation = '';
        pinBuffer = '';
        updateDots();
        document.querySelectorAll('.pin-dot').forEach(d => {
          d.style.background = '';
          d.style.borderColor = '';
        });
      }, 500);
    }
    showToast('Incorrect PIN', 'error');
  }
}

function renderProfileSelect(container) {
  const members = store.members;
  container.innerHTML = `
    <div class="lock-screen" style="display:flex; flex-direction:column; justify-content:center; align-items:center;">
      <h1 class="lock-title" style="margin-bottom:8px;">Who's using the vault?</h1>
      <p class="lock-sub muted" style="margin-bottom:40px;">Select your profile to continue</p>
      
      <div style="display:flex; flex-wrap:wrap; gap:20px; justify-content:center; max-width:300px;">
        ${members.map(m => `
          <div class="profile-avatar-btn" data-id="${m.id}" style="display:flex; flex-direction:column; align-items:center; cursor:pointer; gap:8px;">
            <div class="mem-avatar" style="width:64px; height:64px; font-size:24px; border:2px solid transparent; transition:all 0.2s;">
              ${m.initials}
            </div>
            <span style="font-size:14px; color:var(--text-hi); font-weight:500;">${m.name.split(' ')[0]}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  container.querySelectorAll('.profile-avatar-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      // visual feedback
      btn.querySelector('.mem-avatar').style.borderColor = 'var(--brass)';
      btn.querySelector('.mem-avatar').style.transform = 'scale(0.95)';
      
      setTimeout(() => {
        store.setCurrentMember(btn.dataset.id);
        unlock();
      }, 150);
    });
  });
}

function unlock() {
  store.startPolling();
  checkAndNotifyExpirations();
  document.getElementById('app-tabbar')?.classList.remove('hidden');
  router.navigate('dashboard');
}

// ── Onboarding ───────────────────────────────────────────────

function renderOnboarding(container) {
  onboardStep = 1;
  onboardData = {};

  container.innerHTML = `
    <div class="onboard-screen screen-enter">
      <div class="onboard-logo">
        <svg viewBox="0 0 24 24">
          <path d="M7 11V8a5 5 0 0110 0v3"/>
          <rect x="3" y="11" width="18" height="10" rx="2"/>
          <circle cx="12" cy="16" r="1.5" fill="#1a1305"/>
        </svg>
      </div>
      <h1>Welcome to Family Vault</h1>
      <p>Your family's secure document organizer. Let's get you set up in a minute.</p>

      <div id="onboard-step-1" style="width:100%;">
        <div class="form-group">
          <label class="form-label">Your family name</label>
          <input class="form-input" id="ob-family-name" type="text" placeholder="e.g. The Deshmukh Family" value="The Deshmukh Family" />
        </div>
        <div class="form-group">
          <label class="form-label">Your name (owner)</label>
          <input class="form-input" id="ob-owner-name" type="text" placeholder="e.g. Anil Deshmukh" />
        </div>
        <button class="btn-primary" id="ob-next-1">Continue →</button>
      </div>
    </div>
  `;

  container.querySelector('#ob-next-1').addEventListener('click', () => {
    const familyName = container.querySelector('#ob-family-name').value.trim();
    const ownerName  = container.querySelector('#ob-owner-name').value.trim();
    if (!familyName || !ownerName) { showToast('Please fill in both fields', 'error'); return; }
    onboardData.familyName  = familyName;
    onboardData.ownerName   = ownerName;
    onboardData.ownerInitials = ownerName.trim().charAt(0).toUpperCase();
    renderOnboardPin(container);
  });
}

function renderOnboardPin(container) {
  pinBuffer = '';
  container.innerHTML = `
    <div class="onboard-screen screen-enter">
      <div class="onboard-logo">
        <svg viewBox="0 0 24 24">
          <path d="M7 11V8a5 5 0 0110 0v3"/>
          <rect x="3" y="11" width="18" height="10" rx="2"/>
        </svg>
      </div>
      <h1>Set your PIN</h1>
      <p>Choose a 4-digit PIN that family members can use to unlock the vault.</p>

      <div class="pin-dots" id="pin-dots">
        <div class="pin-dot"></div>
        <div class="pin-dot"></div>
        <div class="pin-dot"></div>
        <div class="pin-dot"></div>
      </div>

      <div class="keypad">
        ${[1,2,3,4,5,6,7,8,9].map(n => renderKey(String(n), '')).join('')}
        <div></div>
        ${renderKey('0', '')}
        <button class="key ghost" id="del-btn" style="font-size:13px;color:var(--text-lo);">⌫</button>
      </div>
    </div>
  `;

  container.querySelectorAll('.key[data-digit]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (pinBuffer.length < 4) {
        pinBuffer += btn.dataset.digit;
        updateDots();
        if (pinBuffer.length === 4) {
          onboardData.pin = pinBuffer;
          setTimeout(() => renderOnboardConfirm(container), 200);
        }
      }
    });
  });

  container.querySelector('#del-btn').addEventListener('click', () => {
    pinBuffer = pinBuffer.slice(0, -1);
    updateDots();
  });
}

function renderOnboardConfirm(container) {
  const savedPin = onboardData.pin;
  pinBuffer = '';

  container.innerHTML = `
    <div class="onboard-screen screen-enter">
      <div class="onboard-logo">
        <svg viewBox="0 0 24 24">
          <path d="M20 6L9 17l-5-5" stroke="#1a1305" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <h1>Confirm PIN</h1>
      <p>Enter your PIN once more to confirm.</p>

      <div class="pin-dots" id="pin-dots">
        <div class="pin-dot"></div>
        <div class="pin-dot"></div>
        <div class="pin-dot"></div>
        <div class="pin-dot"></div>
      </div>

      <div class="keypad">
        ${[1,2,3,4,5,6,7,8,9].map(n => renderKey(String(n), '')).join('')}
        <div></div>
        ${renderKey('0', '')}
        <button class="key ghost" id="del-btn" style="font-size:13px;color:var(--text-lo);">⌫</button>
      </div>
    </div>
  `;

  container.querySelectorAll('.key[data-digit]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (pinBuffer.length < 4) {
        pinBuffer += btn.dataset.digit;
        updateDots();
        if (pinBuffer.length === 4) {
          if (pinBuffer === savedPin) {
            // Save and proceed
            store.updateSettings({
              familyName:    onboardData.familyName,
              ownerInitials: onboardData.ownerInitials,
              pin:           savedPin,
              seeded:        true,
            });
            store.updateMember('member-1', { name: onboardData.ownerName, initials: onboardData.ownerInitials });
            store.setCurrentMember('member-1');
            showToast('Vault created! Welcome.', 'success');
            setTimeout(() => unlock(), 400);
          } else {
            showToast("PINs don't match, try again", 'error');
            pinBuffer = '';
            updateDots();
          }
        }
      }
    });
  });

  container.querySelector('#del-btn').addEventListener('click', () => {
    pinBuffer = pinBuffer.slice(0, -1);
    updateDots();
  });
}
