// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink, onAuthStateChanged, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, collection, doc, setDoc, getDocs, arrayUnion } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDdIoJuDHQKjOS5T9j3IcvnqCNxRA284DY",
  authDomain: "lexicon-7c6d9.firebaseapp.com",
  projectId: "lexicon-7c6d9",
  storageBucket: "lexicon-7c6d9.firebasestorage.app",
  messagingSenderId: "1075493892861",
  appId: "1:1075493892861:web:911c08714a76c833388494",
  measurementId: "G-BK3N3DVMZ4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);

window.firebaseAuth = auth;
window.firebaseDb = db;
window.sendSignInLinkToEmail = sendSignInLinkToEmail;
window.isSignInWithEmailLink = isSignInWithEmailLink;
window.signInWithEmailLink = signInWithEmailLink;
window.createUserWithEmailAndPassword = createUserWithEmailAndPassword;
window.signInWithEmailAndPassword = signInWithEmailAndPassword;
window.onAuthStateChanged = onAuthStateChanged;
window.signOut = signOut;
window.setDoc = setDoc;
window.doc = doc;
window.collection = collection;
window.arrayUnion = arrayUnion;
window.getDocs = getDocs;


