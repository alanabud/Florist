import { create } from 'zustand';
import type { User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase/config';

interface AuthState {
  user: User | null;
  role: string | null;
  loading: boolean;
  setUser: (user: User | null) => void;
  setRole: (role: string | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  role: null,
  loading: true,
  setUser: (user) => set({ user }),
  setRole: (role) => set({ role }),
  setLoading: (loading) => set({ loading }),
}));

let unsubscribeRole: () => void = () => {};

// Listen to Firebase auth state changes
auth.onAuthStateChanged((user) => {
  const store = useAuthStore.getState();
  store.setUser(user);
  
  if (user) {
    // Unsubscribe from previous listener if any
    unsubscribeRole();
    
    // Subscribe to the user's role in Firestore
    const userRef = doc(db, 'users', user.uid);
    unsubscribeRole = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        store.setRole(docSnap.data().role || 'staff');
      } else {
        store.setRole(null);
      }
      // Only set loading to false once we've attempted to get the role
      store.setLoading(false);
    }, (error) => {
      console.error("Error fetching user role:", error);
      store.setRole(null);
      store.setLoading(false);
    });
  } else {
    unsubscribeRole();
    store.setRole(null);
    store.setLoading(false);
  }
});
