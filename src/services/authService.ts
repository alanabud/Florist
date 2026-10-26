import {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  OAuthProvider,
  signOut,
} from 'firebase/auth';
import type { AuthProvider, User } from 'firebase/auth';
import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import {
  applyMicrosoftSignInSettings,
  getFriendlyErrorMessage,
  isUserCancel,
  popupFailureAction,
  readAuthError,
} from './oauthSignIn';

export { getFriendlyErrorMessage };

// Any Google account. No hd / hosted-domain restriction.
const googleProvider = new GoogleAuthProvider();

const microsoftProvider = new OAuthProvider('microsoft.com');
applyMicrosoftSignInSettings(microsoftProvider);

export type ProviderSignInResult =
  | { status: 'success'; user: User }
  | { status: 'redirect' };

function logSignInFailure(label: string, error: unknown): void {
  if (isUserCancel(error)) return;
  const { code, message } = readAuthError(error);
  console.warn(`[${label} Sign-In]`, {
    code,
    message,
    envAuthDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    envProjectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  });
}

/**
 * Popup first. Redirect only when the browser blocks the popup.
 * A redirect navigates away; Login finishes it with completeRedirectSignIn.
 */
async function signInWithPopupFirst(
  provider: AuthProvider,
  label: string,
): Promise<ProviderSignInResult> {
  try {
    const result = await signInWithPopup(auth, provider);
    await syncUserProfile(result.user);
    return { status: 'success', user: result.user };
  } catch (error: unknown) {
    if (popupFailureAction(error) === 'redirect') {
      try {
        await signInWithRedirect(auth, provider);
        return { status: 'redirect' };
      } catch (redirectError: unknown) {
        logSignInFailure(`${label} redirect fallback`, redirectError);
        throw new Error(getFriendlyErrorMessage(redirectError), { cause: redirectError });
      }
    }
    logSignInFailure(label, error);
    throw new Error(getFriendlyErrorMessage(error), { cause: error });
  }
}

export const signInWithGoogle = () => signInWithPopupFirst(googleProvider, 'Google');

export const signInWithMicrosoft = () => {
  // Re-applied immediately before sign-in so tenant/prompt cannot drift.
  applyMicrosoftSignInSettings(microsoftProvider);
  return signInWithPopupFirst(microsoftProvider, 'Microsoft');
};

let redirectCompletion: Promise<User | null> | null = null;

/**
 * Finish a popup-blocked redirect on the Login page.
 * One shared promise so React Strict Mode cannot consume the result twice.
 * Resolves null when this page load has no pending redirect.
 */
export function completeRedirectSignIn(): Promise<User | null> {
  // Keep the same promise after it settles. Login mounts twice in Strict Mode;
  // a second getRedirectResult() would miss a result the first call already took.
  if (!redirectCompletion) {
    redirectCompletion = consumeRedirectResult();
  }
  return redirectCompletion;
}

async function consumeRedirectResult(): Promise<User | null> {
  try {
    const result = await getRedirectResult(auth);
    if (!result?.user) return null;
    await syncUserProfile(result.user);
    return result.user;
  } catch (error: unknown) {
    logSignInFailure('Redirect result', error);
    throw new Error(getFriendlyErrorMessage(error), { cause: error });
  }
}

export const logout = async () => {
  try {
    await signOut(auth);
  } catch (error: unknown) {
    throw new Error('Failed to log out.', { cause: error });
  }
};

export const syncUserProfile = async (user: User) => {
  if (!user) return;

  const userRef = doc(db, 'users', user.uid);
  const metadataRef = doc(db, '_metadata', 'roles');

  try {
    await runTransaction(db, async (transaction) => {
      const userDoc = await transaction.get(userRef);
      
      // If user already exists, just update lastLoginAt and return
      if (userDoc.exists()) {
        transaction.update(userRef, {
          lastLoginAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          // Ensure we update displayName/photo if missing, but NEVER overwrite the role
          displayName: userDoc.data().displayName || user.displayName,
          photoURL: userDoc.data().photoURL || user.photoURL,
        });
        return;
      }

      // User doesn't exist, we need to assign a role.
      let role = 'staff';
      
      const metadataDoc = await transaction.get(metadataRef);
      if (!metadataDoc.exists() || metadataDoc.data()?.ownerClaimed !== true) {
        // First user gets owner
        role = 'owner';
        transaction.set(metadataRef, { ownerClaimed: true });
      }

      // Create new user profile
      const providerData = user.providerData[0] || {};
      
      transaction.set(userRef, {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || '',
        photoURL: user.photoURL || '',
        provider: providerData.providerId || 'unknown',
        role: role,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
      });
    });
  } catch (error) {
    console.error("Error syncing user profile:", error);
    // We don't throw here to avoid breaking login if Firestore rules fail during initial setup,
    // but in production it's logged.
  }
};
