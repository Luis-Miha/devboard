import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/store/authStore';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

/** Istanza axios: cookie sempre inviati (refresh token httpOnly). */
export const api = axios.create({
  baseURL: `${baseURL}/api`,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' }
});

// ------------------------------------------------------------
// Access token IN MEMORIA (mai localStorage): a ogni refresh
// della pagina viene riacquisito tramite il cookie di refresh.
// ------------------------------------------------------------
let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}
export function getAccessToken() {
  return accessToken;
}

// Richiesta: allega il Bearer token se presente
api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// ------------------------------------------------------------
// Risposta: su 401 prova UN solo refresh della sessione,
// poi ritenta la richiesta originale (pattern "silent refresh").
// ------------------------------------------------------------
let refreshInCorso: Promise<string | null> | null = null;

export async function refreshSessione(): Promise<string | null> {
  // Se più richieste 401 arrivano insieme, ne viene eseguito solo uno
  if (!refreshInCorso) {
    refreshInCorso = axios
      .post(`${baseURL}/api/auth/refresh`, {}, { withCredentials: true })
      .then((res) => {
        const { accessToken: nuovo, user } = res.data;
        setAccessToken(nuovo);
        useAuthStore.getState().setUser(user);
        return nuovo as string;
      })
      .catch(() => {
        setAccessToken(null);
        useAuthStore.getState().setUser(null);
        return null;
      })
      .finally(() => {
        refreshInCorso = null;
      });
  }
  return refreshInCorso;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    const status = error.response?.status;
    const url = original?.url || '';

    // Il 401 su /auth/login o /auth/refresh è "normale" (credenziali errate)
    if (status === 401 && !original._retry && !url.includes('/auth/refresh') && !url.includes('/auth/login') && !url.includes('/auth/register')) {
      original._retry = true;
      const nuovo = await refreshSessione();
      if (nuovo) {
        original.headers.Authorization = `Bearer ${nuovo}`;
        return api(original);
      }
      // Sessione davvero scaduta → redirect al login
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

/** Converte un errore axios in un messaggio leggibile in italiano. */
export function messaggioErrore(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { errore?: string } | undefined;
    return data?.errore || err.message || 'Errore di rete';
  }
  return 'Errore imprevisto';
}
