import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  OAuthProvider, 
  signOut,
} from 'firebase/auth';
import type { User } from 'firebase/auth';
import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase/config';

const googleProvider = new GoogleAuthProvider();
const microsoftProvider = new OAuthProvider('microsoft.com');

// Optional: you can add custom scopes for Microsoft if needed
// microsoftProvider.addScope('user.read');

export const getFriendlyErrorMessage = (error: unknown) => {
  const code = (error as { code?: string })?.code || '';
  if (code === 'auth/popup-blocked') {
    return 'Popup was blocked. Please allow popups for this site and try again.';
  }
  if (code === 'auth/popup-closed-by-user') {
    return 'Sign-in popup was closed before completion.';
  }
  if (code === 'auth/account-exists-with-different-credential') {
    return 'An account already exists with the same email address but different sign-in credentials.';
  }
  if (code === 'auth/unauthorized-domain') {
    return 'This domain is not authorized for Firebase Authentication.';
  }
  if (code === 'auth/operation-not-allowed') {
    return 'This sign-in provider is disabled. Please check your Firebase Console.';
  }
  if (code === 'auth/network-request-failed') {
    return 'Network error. Please check your internet connection.';
  }
  return (error as { message?: string })?.message || 'An unexpected error occurred during sign-in.';
};

export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    await syncUserProfile(result.user);
    return result.user;
  } catch (error: unknown) {
    throw new Error('Unable to sign in with Google.', { cause: error });
  }
};

export const signInWithMicrosoft = async () => {
  try {
    const result = await signInWithPopup(auth, microsoftProvider);
    await syncUserProfile(result.user);
    return result.user;
  } catch (error: unknown) {
    throw new Error('Unable to sign in with Microsoft.', { cause: error });
  }
};

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
