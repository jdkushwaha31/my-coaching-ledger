import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAS8dsIJGtgBO3h7iqwJ06UvvRn5Q3UzWY",
  authDomain: "coaching-cloud-dashboard.firebaseapp.com",
  projectId: "coaching-cloud-dashboard",
  storageBucket: "coaching-cloud-dashboard.firebasestorage.app",
  messagingSenderId: "235635409027",
  appId: "1:235635409027:web:252681bc449b79799fdbb6",
  measurementId: "G-J4Q0QYST0X"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
