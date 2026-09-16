// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDVH3kNgFSndXafBi7jn6X9LNvLHIUQqtA",
  authDomain: "instituteos-92470.firebaseapp.com",
  projectId: "instituteos-92470",
  storageBucket: "instituteos-92470.firebasestorage.app",
  messagingSenderId: "596003615029",
  appId: "1:596003615029:web:9716b273abe0fb96cbdc7c"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Firestore database instance — used throughout the app
export const db = getFirestore(app);
