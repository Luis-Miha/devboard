import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { getSocket } from '@/hooks/useSocket';
import type { Notifica } from '@/types';

interface RispostaNotifiche {
  notifiche: Notifica[];
  nonLette: number;
}

/**
 * Notifiche dell'utente: lista via React Query + aggiornamento
 * in tempo real-time quando arriva l'evento `notifica:nuova`.
 */
export function useNotifiche() {
  const queryClient = useQueryClient();

  const query = useQuery<RispostaNotifiche>({
    queryKey: ['notifiche'],
    queryFn: async () => (await api.get('/notifiche')).data,
    refetchInterval: 60_000 // fallback se il socket non è connesso
  });

  useEffect(() => {
    const s = getSocket();
    if (!s) return;

    const onNuova = (n: Notifica) => {
      // Aggiornamento ottimistico della cache: il badge si aggiorna subito
      queryClient.setQueryData<RispostaNotifiche>(['notifiche'], (old) =>
        old
          ? { notifiche: [n, ...old.notifiche].slice(0, 50), nonLette: old.nonLette + 1 }
          : { notifiche: [n], nonLette: 1 }
      );
    };

    s.on('notifica:nuova', onNuova);
    return () => {
      s.off('notifica:nuova', onNuova);
    };
  }, [queryClient]);

  /** Segna tutte le notifiche come lette (ottimistico + PATCH). */
  const segnaTutte = async () => {
    const prima = queryClient.getQueryData<RispostaNotifiche>(['notifiche']);
    queryClient.setQueryData<RispostaNotifiche>(['notifiche'], (old) =>
      old ? { ...old, nonLette: 0, notifiche: old.notifiche.map((n) => ({ ...n, letta: true })) } : old
    );
    try {
      await api.patch('/notifiche/lettre');
    } catch {
      queryClient.setQueryData(['notifiche'], prima); // rollback
    }
  };

  /** Segna una singola notifica come letta. */
  const segnaUna = async (id: number) => {
    queryClient.setQueryData<RispostaNotifiche>(['notifiche'], (old) =>
      old
        ? {
            nonLette: Math.max(0, old.nonLette - 1),
            notifiche: old.notifiche.map((n) => (n.id === id ? { ...n, letta: true } : n))
          }
        : old
    );
    try {
      await api.patch(`/notifiche/${id}/letta`);
    } catch {
      queryClient.invalidateQueries({ queryKey: ['notifiche'] });
    }
  };

  return { ...query, segnaTutte, segnaUna };
}
