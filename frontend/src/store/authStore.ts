import { create } from 'zustand';
import type { Utente } from '@/types';

/**
 * Stato globale dell'utente loggato.
 * Il token NON è qui per scelta: vive in memoria nel modulo api.ts,
 * così non persiste in localStorage (sicurezza).
 */
interface AuthState {
  user: Utente | null;
  initialized: boolean; // true quando il tentativo di refresh iniziale è terminato
  setUser: (user: Utente | null) => void;
  setInitialized: (value: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  initialized: false,
  setUser: (user) => set({ user }),
  setInitialized: (initialized) => set({ initialized })
}));
