// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAWMBHUtM2hyPn25K_4hL20r8SMt2AuUhc",
    authDomain: "climb-or-fall.firebaseapp.com",
    projectId: "climb-or-fall",
    storageBucket: "climb-or-fall.firebasestorage.app",
    messagingSenderId: "22134018249",
    appId: "1:22134018249:web:2b6fed8848c9a75068fd18",
    measurementId: "G-94HJRW0K8H"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Initialize Auth and Firestore
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
