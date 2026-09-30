import { useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { getAccessToken } from '@/services/api';

/**
 * Connessione Socket.io singleton.
 * L'access token viene passato in fase di handshake (`auth.token`)
 * e verificato dal server: solo gli utenti loggati possono connettersi.
 */
let socket: Socket | null = null;

export function getSocket(): Socket | null {
  const token = getAccessToken();
  if (!token) return null; // senza sessione non c'è realtime

  if (!socket) {
    socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:4000', {
      auth: { token },
      autoConnect: false,
      transports: ['websocket', 'polling']
    });
  } else {
    // aggiorna il token usato in caso di riconnessione
    socket.auth = { token };
  }

  if (!socket.connected && !socket.active) socket.connect();
  else if (!socket.connected) socket.connect();

  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

/**
 * Unisce/abbandona la room del progetto e sottoscrive gli eventi
 * della board per tutta la durata del componente.
 *
 * Eventi server → client:
 *   ticket:creato | ticket:aggiornato | ticket:spostato |
 *   ticket:eliminato | commento:nuovo | notifica:nuova
 */
export function useSocketProgetto(
  progettoId: number | undefined,
  handlers: {
    onCreato?: (payload: unknown) => void;
    onAggiornato?: (payload: unknown) => void;
    onSpostato?: (payload: unknown) => void;
    onEliminato?: (payload: unknown) => void;
    onCommento?: (payload: unknown) => void;
  }
) {
  const [connesso, setConnesso] = useState(false);

  useEffect(() => {
    if (!progettoId) return;
    const s = getSocket();
    if (!s) return;

    const join = () => {
      s.emit('join:progetto', { progettoId });
      setConnesso(true);
    };
    const leave = () => {
      s.emit('leave:progetto', { progettoId });
      setConnesso(false);
    };

    s.on('connect', join);
    if (s.connected) join();

    // Registra i listener degli eventi real-time
    if (handlers.onCreato) s.on('ticket:creato', handlers.onCreato);
    if (handlers.onAggiornato) s.on('ticket:aggiornato', handlers.onAggiornato);
    if (handlers.onSpostato) s.on('ticket:spostato', handlers.onSpostato);
    if (handlers.onEliminato) s.on('ticket:eliminato', handlers.onEliminato);
    if (handlers.onCommento) s.on('commento:nuovo', handlers.onCommento);

    return () => {
      s.off('connect', join);
      if (handlers.onCreato) s.off('ticket:creato', handlers.onCreato);
      if (handlers.onAggiornato) s.off('ticket:aggiornato', handlers.onAggiornato);
      if (handlers.onSpostato) s.off('ticket:spostato', handlers.onSpostato);
      if (handlers.onEliminato) s.off('ticket:eliminato', handlers.onEliminato);
      if (handlers.onCommento) s.off('commento:nuovo', handlers.onCommento);
      leave();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progettoId]);

  return { connesso };
}
