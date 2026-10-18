import { initializeApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);

if (import.meta.env.DEV) {
  console.log("[Firebase Config Dev Diagnostic]", {
    projectId: firebaseConfig.projectId,
    authDomain: firebaseConfig.authDomain,
    hostname: typeof window !== "undefined" ? window.location.hostname : "node"
  });
}

// ── App Check (guarded, monitoring-only) ───────────────────────────────────
// Initializes only in the browser AND only when a reCAPTCHA site key is present,
// so the app is a no-op (and never crashes) without VITE_FIREBASE_APPCHECK_SITE_KEY
// — local/CI keep working. Console enforcement is OFF; this just lets the app
// start producing App Check tokens for pilot monitoring.
// See docs/appcheck-rollout-plan.md.
const appCheckSiteKey = import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY;
if (typeof window !== "undefined" && appCheckSiteKey) {
  // Dev-only: set VITE_FIREBASE_APPCHECK_DEBUG=true to print a debug token to the
  // console for registering in the Firebase console. Never commit a debug token.
  if (import.meta.env.DEV && import.meta.env.VITE_FIREBASE_APPCHECK_DEBUG === "true") {
    (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }
  try {
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(appCheckSiteKey),
      isTokenAutoRefreshEnabled: true,
    });
  } catch (e) {
    console.error("[Firebase] App Check initialization failed:", e);
  }
}

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);

// ── Local emulator hook (DEV ONLY, opt-in) ─────────────────────────────
// When developing with `VITE_USE_EMULATORS=true` in .env.local, point the
// SDKs at the local Firebase emulators (Firestore 8080, Functions 5001,
// Auth 9099 — the firebase.json defaults). import.meta.env.DEV is false
// in production builds, so this branch can never activate on the live
// site, and it stays off unless the flag is explicitly set.
if (import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS === 'true') {
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  console.log('[Firebase] Using local emulators (VITE_USE_EMULATORS=true)');
}

// Analytics is only supported in browser environments
let analytics;
if (typeof window !== "undefined") {
  analytics = getAnalytics(app);
}
export { analytics };
