// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink, onAuthStateChanged, signOut, deleteUser, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, collection, doc, setDoc, getDocs, arrayUnion, query, orderBy, addDoc, updateDoc, deleteDoc, writeBatch } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyD8rcO0QWdVTd5yucuYYKsBw_oXkksUapw",
  authDomain: "lexicon-7575c.firebaseapp.com",
  projectId: "lexicon-7575c",
  storageBucket: "lexicon-7575c.firebasestorage.app",
  messagingSenderId: "733240893165",
  appId: "1:733240893165:web:cceb5e159b131bcbaf36e4",
  measurementId: "G-W474SBHNRF"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);

window.firebaseAuth = auth;
window.firebaseDb = db;
window.firebaseFunctions = getFunctions(app);
window.httpsCallable = httpsCallable;
window.sendSignInLinkToEmail = sendSignInLinkToEmail;
window.isSignInWithEmailLink = isSignInWithEmailLink;
window.signInWithEmailLink = signInWithEmailLink;
window.createUserWithEmailAndPassword = createUserWithEmailAndPassword;
window.signInWithEmailAndPassword = signInWithEmailAndPassword;
window.onAuthStateChanged = onAuthStateChanged;
window.signOut = signOut;
window.deleteUser = deleteUser;
window.setDoc = setDoc;
window.doc = doc;
window.collection = collection;
window.arrayUnion = arrayUnion;
window.getDocs = getDocs;
window.query = query;
window.orderBy = orderBy;
window.addDoc = addDoc;
window.updateDoc = updateDoc;
window.deleteDoc = deleteDoc;
window.writeBatch = writeBatch;
