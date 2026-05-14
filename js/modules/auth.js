/**
 * auth.js
 * Firebase Auth and Archival Folders logic (Firestore version).
 */

import { $ } from './core-utils.js';
import { AppState } from './core-state.js';

export let currentUser = null;

export function initFirebaseAuth(callbacks) {
  if (!window.firebaseAuth) return;

  // Handle Sign-in Link
  if (window.isSignInWithEmailLink(window.firebaseAuth, window.location.href)) {
    let email = window.localStorage.getItem('emailForSignIn');
    if (!email) {
      email = window.prompt('Please provide your email for confirmation');
    }
    if (email) {
      window.signInWithEmailLink(window.firebaseAuth, email, window.location.href)
        .then(() => {
          window.localStorage.removeItem('emailForSignIn');
          if (callbacks && callbacks.showToast) callbacks.showToast('Authentication Successful.');
          window.history.replaceState(null, '', window.location.pathname);
        })
        .catch((error) => {
          console.error('Error signing in', error);
          if (callbacks && callbacks.showToast) callbacks.showToast('Authentication Failed.');
        });
    }
  }

  // Monitor Auth State
  window.onAuthStateChanged(window.firebaseAuth, (user) => {
    currentUser = user;
    const btnAuth = $('btn-auth-toggle');
    const btnAuthMobile = $('btn-auth-toggle-mobile');
    
    if (user) {
      if (btnAuth) btnAuth.textContent = 'Sign Out';
      if (btnAuthMobile) btnAuthMobile.textContent = 'Sign Out';
      $('auth-modal')?.classList.add('hidden');
      fetchArchivalFolders(callbacks);
    } else {
      if (btnAuth) btnAuth.textContent = 'Sign In';
      if (btnAuthMobile) btnAuthMobile.textContent = 'Sign In';
      AppState.archivalFolders = [];
      if (callbacks && callbacks.renderFolders) callbacks.renderFolders();
    }
  });
}

export function toggleAuth() {
  if (currentUser) {
    if (confirm('Terminate secure session?')) {
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
    if (callbacks && callbacks.showToast) callbacks.showToast('Valid email required.');
    return;
  }
  
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
    if (callbacks && callbacks.showToast) callbacks.showToast('New Folder Initialized.');
    fetchArchivalFolders(callbacks);
    
    const input = $('new-folder-name');
    if (input) input.value = '';
  } catch (err) {
    console.error("Create Folder Error:", err);
    if (callbacks && callbacks.showToast) callbacks.showToast('Initialization failed.');
  }
}

export async function saveToFolder(folderId, entryId, callbacks) {
  if (!currentUser || !entryId) return;
  try {
    const docRef = window.doc(window.firebaseDb, `users/${currentUser.uid}/archival_folders/${folderId}`);
    await window.updateDoc(docRef, {
      lookIds: window.arrayUnion(entryId)
    });
    if (callbacks && callbacks.showToast) callbacks.showToast('Artifact Synced to Folder.');
    if (callbacks && callbacks.closeModal) callbacks.closeModal('save-folder');
    fetchArchivalFolders(callbacks);
  } catch (err) {
    console.error("Save to Folder Error:", err);
    if (callbacks && callbacks.showToast) callbacks.showToast('Sync failed.');
  }
}
