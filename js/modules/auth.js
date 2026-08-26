/**
 * auth.js
 * Magic-link authentication via /api/auth/* (Neon + Resend).
 * No Firebase. No SDK. Pure fetch().
 */

import { $ } from './core-utils.js';
import { AppState } from './core-state.js';
import { getTranslation } from './translations.js';
import { invalidateSearchCache } from './search-engine.js';

export let currentUser = null; // { email } or null

// ─── Hydrate session on load ──────────────────────────────────────────────────

export async function initAuth(callbacks) {
  // Check ?auth= landing state first (verification redirect)
  const params = new URLSearchParams(window.location.search);
  const authResult = params.get('auth');

  if (authResult) {
    // Clean up the URL immediately
    const clean = window.location.pathname + window.location.hash;
    history.replaceState(null, '', clean);

    if (authResult === 'ok') {
      // Session cookie is now set; load user and complete intent
      await _hydrateUser(callbacks);
      const lang = AppState.language;
      if (callbacks?.showToast) callbacks.showToast(getTranslation('auth_success', lang) || 'Signed in.');
      _completeIntent(callbacks);
      return;
    }
    if (authResult === 'expired') {
      toggleAuth();
      if (callbacks?.showToast) callbacks.showToast(getTranslation('auth_link_expired', lang) || 'That link expired. Send a new one.');
    }
  }

  await _hydrateUser(callbacks);
}

async function _hydrateUser(callbacks) {
  try {
    const { user } = await fetch('/api/auth/me').then(r => r.json());
    _setUser(user, callbacks);
  } catch {
    _setUser(null, callbacks);
  }
}

function _setUser(user, callbacks) {
  currentUser = user || null;
  const lang = AppState.language;
  const btnAuth = $('btn-auth-toggle');
  const btnAuthMobile = $('btn-auth-toggle-mobile');

  if (currentUser) {
    const handle = currentUser.email.split('@')[0].toUpperCase();
    const txt = handle.length > 12 ? handle.slice(0, 12) + '…' : handle;
    if (btnAuth) btnAuth.textContent = txt;
    if (btnAuthMobile) btnAuthMobile.textContent = txt;
    const emailEl = $('auth-user-email');
    if (emailEl) emailEl.textContent = currentUser.email;
    fetchArchivalFolders(callbacks);
  } else {
    const txt = (getTranslation('nav_signin', lang) || 'Sign In').toUpperCase();
    if (btnAuth) btnAuth.textContent = txt;
    if (btnAuthMobile) btnAuthMobile.textContent = txt;
    AppState.archivalFolders = [];
    if (callbacks?.renderFolders) callbacks.renderFolders();
  }
}

// Called when `?auth=ok` lands — replay the stashed intent
function _completeIntent(callbacks) {
  const intent = sessionStorage.getItem('lx_intent');
  if (intent) {
    sessionStorage.removeItem('lx_intent');
    // If the intent is an entry path, navigate there
    if (intent.startsWith('/entry/')) {
      history.pushState(null, '', intent);
      // Trigger routing in app.js via popstate
      window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
    }
  }
  // Auto-open Save dialog if entry is in focus
  if (AppState.selectedEntryId && callbacks?.renderFolderOptions) {
    callbacks.renderFolderOptions();
  }
}

// ─── Modal state machine ───────────────────────────────────────────────────────

export function toggleAuth() {
  const modal = $('auth-modal');
  if (!modal) return;

  if (currentUser) {
    _showSignedIn();
  } else {
    _showForm();
  }
  modal.classList.remove('hidden');
}

function _showForm(contextLabel) {
  $('auth-form-container')?.classList.remove('hidden');
  $('auth-success-container')?.classList.add('hidden');
  $('auth-signed-in-container')?.classList.add('hidden');
  const titleEl = $('auth-modal-title');
  if (titleEl) titleEl.textContent = 'SIGN IN';
  // Reset form state
  const email = $('auth-email');
  if (email) { email.value = ''; email.disabled = false; }
  const btn = $('btn-submit-auth');
  if (btn) { btn.textContent = '[ SEND SIGN-IN LINK ]'; btn.disabled = false; }
  _clearMessage();
  // Contextual header (UX-5)
  const ctx = $('auth-context-label');
  if (ctx) {
    if (contextLabel) {
      ctx.textContent = contextLabel;
      ctx.classList.remove('hidden');
    } else {
      ctx.classList.add('hidden');
    }
  }
}

function _showSuccess(email) {
  $('auth-form-container')?.classList.add('hidden');
  $('auth-success-container')?.classList.remove('hidden');
  $('auth-signed-in-container')?.classList.add('hidden');
  const sentTo = $('auth-sent-email');
  if (sentTo) sentTo.textContent = email;
  _startResendCountdown(email);
}

function _showSignedIn() {
  $('auth-form-container')?.classList.add('hidden');
  $('auth-success-container')?.classList.add('hidden');
  $('auth-signed-in-container')?.classList.remove('hidden');
  $('auth-delete-confirm')?.classList.add('hidden');
  $('btn-delete-account')?.classList.remove('hidden');
  const titleEl = $('auth-modal-title');
  if (titleEl) titleEl.textContent = 'ACCOUNT';
  const emailEl = $('auth-user-email');
  if (emailEl) emailEl.textContent = currentUser?.email || '';
}

// ─── Resend countdown ─────────────────────────────────────────────────────────

let _resendTimer = null;

function _startResendCountdown(email) {
  const btn = $('btn-auth-resend');
  if (!btn) return;
  let secs = 30;
  btn.disabled = true;
  btn.textContent = `Resend in ${secs}s`;

  clearInterval(_resendTimer);
  _resendTimer = setInterval(() => {
    secs--;
    if (secs <= 0) {
      clearInterval(_resendTimer);
      btn.disabled = false;
      btn.textContent = '[ RESEND ]';
      btn.onclick = () => sendSignInLink(email, null, /* isResend */ true);
    } else {
      btn.textContent = `Resend in ${secs}s`;
    }
  }, 1000);
}

// ─── Send magic link ──────────────────────────────────────────────────────────

export function sendSignInLink(emailArg, callbacks, isResend = false) {
  const emailInput = $('auth-email');
  const email = emailArg || emailInput?.value?.trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    _showMessage(getTranslation('auth_email_invalid', AppState.language) || 'That doesn\'t look like a valid email.', 'error');
    return;
  }

  const btn = $('btn-submit-auth');
  if (btn) { btn.textContent = '[ SENDING… ]'; btn.disabled = true; }
  _clearMessage();

  const next = sessionStorage.getItem('lx_intent') || window.location.pathname + window.location.hash;

  fetch('/api/auth/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, next }),
  })
    .then(async r => {
      if (r.status === 429) {
        const { retryAfter } = await r.json();
        _showMessage(`Too many requests. Wait ${retryAfter}s before trying again.`, 'error');
        if (btn) { btn.textContent = '[ SEND SIGN-IN LINK ]'; btn.disabled = false; }
        return;
      }
      if (!r.ok) {
        throw new Error('send_failed');
      }
      _showSuccess(email);
    })
    .catch(() => {
      _showMessage(getTranslation('auth_send_failed', AppState.language) || 'Couldn\'t send the link. Try again.', 'error');
      if (btn) { btn.textContent = '[ SEND SIGN-IN LINK ]'; btn.disabled = false; }
    });
}

// ─── Sign out ─────────────────────────────────────────────────────────────────

export async function signOut(callbacks) {
  try {
    await fetch('/api/auth/signout', { method: 'POST' });
  } catch { /* server already cleared the cookie if reachable */ }
  _setUser(null, callbacks);
  $('auth-modal')?.classList.add('hidden');
  if (callbacks?.showToast) callbacks.showToast(getTranslation('nav_signout', AppState.language) || 'Signed out.');
}

// ─── Delete account ───────────────────────────────────────────────────────────

export async function deleteAccount(typedEmail, callbacks) {
  const lang = AppState.language;
  if (!currentUser) return;

  if ((typedEmail || '').trim().toLowerCase() !== currentUser.email) {
    if (callbacks?.showToast) callbacks.showToast(getTranslation('auth_delete_email_mismatch', lang));
    return;
  }

  try {
    const r = await fetch('/api/auth/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: typedEmail }),
    });
    if (!r.ok) throw new Error('delete_failed');

    AppState.archivalFolders = [];
    _setUser(null, callbacks);
    $('auth-modal')?.classList.add('hidden');
    if (callbacks?.renderFolders) callbacks.renderFolders();
    if (callbacks?.showToast) callbacks.showToast(getTranslation('auth_delete_success', lang) || 'Account deleted.');
  } catch {
    if (callbacks?.showToast) callbacks.showToast(getTranslation('auth_delete_failed', lang) || 'Delete failed. Try again.');
  }
}

// ─── Folders ──────────────────────────────────────────────────────────────────

export async function fetchArchivalFolders(callbacks) {
  if (!currentUser) return;
  try {
    const { folders } = await fetch('/api/folders').then(r => r.json());
    // Normalise to the shape the rest of the app expects: { id, name, lookIds[] }
    AppState.archivalFolders = (folders || []).map(f => ({
      id: f.id,
      name: f.name,
      createdAt: f.created_at,
      lookIds: f.entries || [],
    }));
    invalidateSearchCache();
    if (callbacks?.renderFolders) callbacks.renderFolders();
    if (callbacks?.renderFolderOptions) callbacks.renderFolderOptions();
  } catch (err) {
    console.error('[auth] fetchArchivalFolders', err);
  }
}

export async function createArchivalFolder(name, callbacks) {
  if (!currentUser || !name?.trim()) return;
  try {
    await fetch('/api/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const input = $('new-folder-name');
    if (input) input.value = '';
    if (callbacks?.showToast) callbacks.showToast(getTranslation('folder_new', AppState.language));
    await fetchArchivalFolders(callbacks);
  } catch {
    if (callbacks?.showToast) callbacks.showToast(getTranslation('folder_new_failed', AppState.language));
  }
}

export async function saveToFolder(folderId, entryId, callbacks) {
  if (!currentUser || !entryId) return;
  try {
    await fetch('/api/folders/entry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folderId, entrySlug: entryId }),
    });
    if (callbacks?.showToast) callbacks.showToast(getTranslation('folder_sync_success', AppState.language));
    if (callbacks?.closeModal) callbacks.closeModal('save-folder');
    await fetchArchivalFolders(callbacks);
  } catch {
    if (callbacks?.showToast) callbacks.showToast(getTranslation('folder_sync_failed', AppState.language));
  }
}

// ─── Gating helper ────────────────────────────────────────────────────────────

export function requireAuth(intentPath, contextLabel) {
  sessionStorage.setItem('lx_intent', intentPath || window.location.pathname + window.location.hash);
  _showForm(contextLabel);
  $('auth-modal')?.classList.remove('hidden');
  setTimeout(() => $('auth-email')?.focus(), 50);
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function _showMessage(text, type = 'info') {
  const el = $('auth-message');
  if (!el) return;
  el.textContent = text;
  el.className = el.className.replace(/\bhidden\b/, '');
  el.style.color = type === 'error' ? '' : '#a8a5a0';
  el.classList.remove('hidden');
}

function _clearMessage() {
  const el = $('auth-message');
  if (el) { el.textContent = ''; el.classList.add('hidden'); }
}
