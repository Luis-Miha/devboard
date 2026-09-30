import { useCallback, useEffect } from 'react';
import { api, setAccessToken, refreshSessione, messaggioErrore } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import { getSocket, disconnectSocket } from '@/hooks/useSocket';

/**
 * Hook centrale per l'autenticazione.
 * - init(): al primo caricamento prova a rinnovare la sessione usando
 *   il cookie httpOnly di refresh (persistenza al refresh della pagina).
 * - login/register/logout: chiamate REST.
 */
export function useAuth() {
  const { user, initialized, setUser, setInitialized } = useAuthStore();

  // Ripristino sessione (eseguito una volta all'avvio dell'app)
  const init = useCallback(async () => {
    if (initialized) return;
    try {
      await refreshSessione(); // setta token + user nello store se il cookie è valido
      getSocket(); // apre la connessione realtime se la sessione è valida
    } finally {
      setInitialized(true);
    }
  }, [initialized, setInitialized]);

  const login = useCallback(
    async (email: string, password: string) => {
      try {
        const res = await api.post('/auth/login', { email, password });
        setAccessToken(res.data.accessToken);
        setUser(res.data.user);
        getSocket();
        return { ok: true as const };
      } catch (err) {
        return { ok: false as const, errore: messaggioErrore(err) };
      }
    },
    [setUser]
  );

  const register = useCallback(
    async (nome: string, email: string, password: string) => {
      try {
        const res = await api.post('/auth/register', { nome, email, password });
        setAccessToken(res.data.accessToken);
        setUser(res.data.user);
        getSocket();
        return { ok: true as const };
      } catch (err) {
        return { ok: false as const, errore: messaggioErrore(err) };
      }
    },
    [setUser]
  );

  const logout = useCallback(async () => {
    try {
      await api.delete('/auth/logout');
    } catch {
      // anche se la chiamata fallisce la sessione locale va chiusa
    }
    setAccessToken(null);
    disconnectSocket();
    setUser(null);
  }, [setUser]);

  // Auto-init al primo utilizzo dell'hook
  useEffect(() => {
    void init();
  }, [init]);

  return { user, initialized, login, register, logout, init };
}
