import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { UserDTO } from '@amplify/domain';

interface SessionState {
  token: string | null;
  user: UserDTO | null;
  /** Random device identity so guests can back campaigns and keep receipts without an account. */
  guestId: string;
  onboarded: boolean;
  hydrated: boolean;
  signIn: (token: string, user: UserDTO) => void;
  setUser: (user: UserDTO) => void;
  signOut: () => void;
  setOnboarded: () => void;
}

const newGuestId = () => Crypto.randomUUID().replace(/-/g, '');

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      guestId: newGuestId(),
      onboarded: false,
      hydrated: false,
      signIn: (token, user) => set({ token, user }),
      setUser: (user) => set({ user }),
      // A fresh guest id on sign-out so the next person on this device starts clean.
      signOut: () => set({ token: null, user: null, guestId: newGuestId() }),
      setOnboarded: () => set({ onboarded: true }),
    }),
    {
      name: 'amplify-session',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ token: s.token, user: s.user, guestId: s.guestId, onboarded: s.onboarded }),
      onRehydrateStorage: () => () => useSession.setState({ hydrated: true }),
    },
  ),
);

export const isReviewer = () => useSession.getState().user?.role === 'reviewer';
