import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyCA689XdNW9w7-95nxgyL8GvmxI0p3rYXs",
  authDomain: "florist-d5026.firebaseapp.com",
  projectId: "florist-d5026",
  storageBucket: "florist-d5026.firebasestorage.app",
  messagingSenderId: "966341361642",
  appId: "1:966341361642:web:76da065b94b5b2f161fc93",
  measurementId: "G-VZEHTGJ7GN"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Analytics is only supported in browser environments
let analytics;
if (typeof window !== "undefined") {
  analytics = getAnalytics(app);
}
export { analytics };
