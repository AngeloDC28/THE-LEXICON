/**
 * auth.js
 * Firebase Auth and Archival Folders logic (Firestore version).
 */

import { $ } from './core-utils.js';
import { AppState } from './core-state.js';
import { getTranslation } from './translations.js';

export let currentUser = null;

export function initFirebaseAuth(callbacks) {
  if (!window.firebaseAuth) return;

  // Handle Sign-in Link
  if (window.isSignInWithEmailLink(window.firebaseAuth, window.location.href)) {
    let email = window.localStorage.getItem('emailForSignIn');
    if (!email) {
      email = window.prompt(getTranslation('auth_email_prompt', AppState.language));
    }
    if (email) {
      window.signInWithEmailLink(window.firebaseAuth, email, window.location.href)
        .then(() => {
          window.localStorage.removeItem('emailForSignIn');
          if (callbacks && callbacks.showToast) callbacks.showToast(getTranslation('auth_success', AppState.language));
          window.history.replaceState(null, '', window.location.pathname);
        })
        .catch((error) => {
          console.error('Error signing in', error);
          if (callbacks && callbacks.showToast) callbacks.showToast(getTranslation('auth_failed', AppState.language));
        });
    }
  }

  // Monitor Auth State
  window.onAuthStateChanged(window.firebaseAuth, (user) => {
    currentUser = user;
    const btnAuth = $('btn-auth-toggle');
    const btnAuthMobile = $('btn-auth-toggle-mobile');
    
    const lang = AppState.language;
    if (user) {
      const txt = (getTranslation('nav_signout', lang) || 'Sign Out').toUpperCase();
      if (btnAuth) btnAuth.textContent = txt;
      if (btnAuthMobile) btnAuthMobile.textContent = txt;
      $('auth-modal')?.classList.add('hidden');
      fetchArchivalFolders(callbacks);
    } else {
      const txt = (getTranslation('nav_signin', lang) || 'Sign In').toUpperCase();
      if (btnAuth) btnAuth.textContent = txt;
      if (btnAuthMobile) btnAuthMobile.textContent = txt;
      AppState.archivalFolders = [];
      if (callbacks && callbacks.renderFolders) callbacks.renderFolders();
    }
  });
}

export function toggleAuth() {
  if (currentUser) {
    if (confirm(getTranslation('auth_signout_confirm', AppState.language))) {
      window.signOut(window.firebaseAuth);
    }
  } else {
    $('auth-modal')?.classList.remove('hidden');
    $('auth-form-container')?.classList.remove('hidden');
    $('auth-success-container')?.classList.add('hidden');
  }
}

export function sendSignInLink(callbacks) {
  const email = $('auth-email')?.value;
  if (!email) {
    if (callbacks && callbacks.showToast) callbacks.showToast(getTranslation('auth_email_invalid', AppState.language));
    return;
  }

  const btn = $('btn-submit-auth');
  if (btn) { btn.disabled = true; btn.style.opacity = '0.5'; }

  const actionCodeSettings = {
    url: window.location.href,
    handleCodeInApp: true
  };

  window.sendSignInLinkToEmail(window.firebaseAuth, email, actionCodeSettings)
    .then(() => {
      window.localStorage.setItem('emailForSignIn', email);
      $('auth-form-container')?.classList.add('hidden');
      $('auth-success-container')?.classList.remove('hidden');
    })
    .catch((error) => {
      console.error('Auth Link Error:', error);
      if (btn) { btn.disabled = false; btn.style.opacity = ''; }
      if (callbacks && callbacks.showToast) callbacks.showToast(error.message);
    });
}

export async function fetchArchivalFolders(callbacks) {
  if (!currentUser || !window.firebaseDb) return;
  try {
    const colRef = window.collection(window.firebaseDb, `users/${currentUser.uid}/archival_folders`);
    const q = window.query(colRef, window.orderBy('createdAt', 'desc'));
    const querySnapshot = await window.getDocs(q);
    AppState.archivalFolders = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    if (callbacks && callbacks.renderFolders) callbacks.renderFolders();
    if (callbacks && callbacks.renderFolderOptions) callbacks.renderFolderOptions();
  } catch (err) {
    console.error("Fetch Folders Error:", err);
  }
}

export async function createArchivalFolder(name, callbacks) {
  if (!currentUser || !name) return;
  try {
    const colRef = window.collection(window.firebaseDb, `users/${currentUser.uid}/archival_folders`);
    await window.addDoc(colRef, {
      name: name.toUpperCase(),
      createdAt: new Date().toISOString(),
      lookIds: []
    });
    if (callbacks && callbacks.showToast) callbacks.showToast(getTranslation('folder_new', AppState.language));
    fetchArchivalFolders(callbacks);
    
    const input = $('new-folder-name');
    if (input) input.value = '';
  } catch (err) {
    console.error("Create Folder Error:", err);
    if (callbacks && callbacks.showToast) callbacks.showToast(getTranslation('folder_new_failed', AppState.language));
  }
}

export async function saveToFolder(folderId, entryId, callbacks) {
  if (!currentUser || !entryId) return;
  try {
    const docRef = window.doc(window.firebaseDb, `users/${currentUser.uid}/archival_folders/${folderId}`);
    await window.updateDoc(docRef, {
      lookIds: window.arrayUnion(entryId)
    });
    if (callbacks && callbacks.showToast) callbacks.showToast(getTranslation('folder_sync_success', AppState.language));
    if (callbacks && callbacks.closeModal) callbacks.closeModal('save-folder');
    fetchArchivalFolders(callbacks);
  } catch (err) {
    console.error("Save to Folder Error:", err);
    if (callbacks && callbacks.showToast) callbacks.showToast(getTranslation('folder_sync_failed', AppState.language));
  }
}
