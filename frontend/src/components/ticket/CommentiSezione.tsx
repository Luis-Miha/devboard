import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Send } from 'lucide-react';
import { api, messaggioErrore } from '@/services/api';
import { getSocket } from '@/hooks/useSocket';
import { useAuthStore } from '@/store/authStore';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { Commento } from '@/types';

interface Props {
  ticketId: number;
}

/**
 * Sezione commenti del ticket: lista + form in fondo.
 * I nuovi commenti arrivano in real-time via evento `commento:nuovo`.
 */
export default function CommentiSezione({ ticketId }: Props) {
  const queryClient = useQueryClient();
  const utente = useAuthStore((s) => s.user);
  const [testo, setTesto] = useState('');
  const [errore, setErrore] = useState('');

  const { data } = useQuery<{ commenti: Commento[] }>({
    queryKey: ['commenti', ticketId],
    queryFn: async () => (await api.get(`/ticket/${ticketId}/commenti`)).data
  });
  const commenti = data?.commenti ?? [];

  // Real-time: aggiunge il commento appena arriva dal server
  useEffect(() => {
    const s = getSocket();
    if (!s) return;
    const onNuovo = (p: { ticket_id: number; commento: Commento }) => {
      if (p.ticket_id !== ticketId) return;
      queryClient.setQueryData<{ commenti: Commento[] }>(['commenti', ticketId], (old) => {
        if (!old) return { commenti: [p.commento] };
        if (old.commenti.some((c) => c.id === p.commento.id)) return old; // dedupe
        return { commenti: [...old.commenti, p.commento] };
      });
    };
    s.on('commento:nuovo', onNuovo);
    return () => {
      s.off('commento:nuovo', onNuovo);
    };
  }, [ticketId, queryClient]);

  const invia = async () => {
    if (!testo.trim()) return;
    setErrore('');
    const provvisorio = testo;
    setTesto('');
    try {
      const res = await api.post(`/ticket/${ticketId}/commenti`, { testo: provvisorio });
      // Inserimento immediato (il listener socket è in dedupe)
      queryClient.setQueryData<{ commenti: Commento[] }>(['commenti', ticketId], (old) => {
        if (!old) return { commenti: [res.data.commento] };
        if (old.commenti.some((c) => c.id === res.data.commento.id)) return old;
        return { commenti: [...old.commenti, res.data.commento] };
      });
    } catch (err) {
      setTesto(provvisorio); // ripristina il testo in caso di errore
      setErrore(messaggioErrore(err));
    }
  };

  return (
    <div className="space-y-3">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted">
        Commenti ({commenti.length})
      </h4>

      <div className="max-h-56 space-y-3 overflow-y-auto pr-1">
        {commenti.length === 0 && (
          <p className="text-xs text-muted-2">Nessun commento. Scrivi il primo!</p>
        )}
        {commenti.map((c) => (
          <div key={c.id} className="flex gap-2.5">
            <Avatar className="h-6 w-6">
              <AvatarImage src={c.avatar_url || undefined} alt={c.autore} />
              <AvatarFallback className="text-[10px]">
                {c.autore?.charAt(0)?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 rounded-md bg-surface-2 p-2.5">
              <div className="mb-1 flex items-baseline gap-2">
                <span className="text-xs font-semibold">{c.autore}</span>
                <span className="text-[10px] text-muted-2">
                  {new Date(c.created_at).toLocaleString('it-IT', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>
              {/* Rendering "markdown base": a capo e testo semplice preservati */}
              <p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-foreground">
                {c.testo}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Form in fondo */}
      <div className="flex items-end gap-2">
        <Avatar className="h-6 w-6">
          <AvatarImage src={utente?.avatar_url || undefined} alt={utente?.nome} />
          <AvatarFallback className="text-[10px]">
            {utente?.nome?.charAt(0)?.toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <Textarea
          value={testo}
          onChange={(e) => setTesto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void invia();
            }
          }}
          placeholder="Scrivi un commento… (Invio per inviare)"
          rows={2}
          className="min-h-0 text-xs"
        />
        <Button size="icon" className="h-8 w-8 shrink-0" onClick={() => void invia()} disabled={!testo.trim()}>
          <Send className="h-3.5 w-3.5" />
        </Button>
      </div>
      {errore && <p className="text-xs text-destructive">{errore}</p>}
    </div>
  );
}
