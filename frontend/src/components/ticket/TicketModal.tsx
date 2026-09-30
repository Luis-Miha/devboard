import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Trash2, Check } from 'lucide-react';
import { api, messaggioErrore } from '@/services/api';
import { getSocket } from '@/hooks/useSocket';
import { useBoardStore } from '@/store/boardStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog';
import CommentiSezione from './CommentiSezione';
import {
  COLONNE,
  LABEL_PRIORITA,
  LABEL_STATO,
  COLORI_PRIORITA,
  type Membro,
  type Priorita,
  type Stato,
  type Ticket
} from '@/types';

interface Props {
  ticketId: number;
  onChiudi: () => void;
  membri: Membro[];
}

/**
 * Renderer "markdown base": **grassetto**, *corsivo*, `codice`.
 * Restituisce nodi React (non HTML injection-safe via dangerouslySet).
 */
function renderMarkdown(testo: string) {
  return testo.split('\n').map((riga, i) => {
    const parti = riga.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
    return (
      <span key={i} className="block">
        {parti.map((p, j) => {
          if (p.startsWith('**') && p.endsWith('**'))
            return <strong key={j}>{p.slice(2, -2)}</strong>;
          if (p.startsWith('*') && p.endsWith('*') && p.length > 2)
            return <em key={j}>{p.slice(1, -1)}</em>;
          if (p.startsWith('`') && p.endsWith('`') && p.length > 2)
            return (
              <code key={j} className="rounded bg-surface-2 px-1 py-0.5 text-[11px] text-accent">
                {p.slice(1, -1)}
              </code>
            );
          return <span key={j}>{p}</span>;
        })}
      </span>
    );
  });
}

/** Modal dettaglio ticket: titolo inline, stato, priorità, assegnatario, scadenza, commenti. */
export default function TicketModal({ ticketId, onChiudi, membri }: Props) {
  const queryClient = useQueryClient();
  const upsertTicket = useBoardStore((s) => s.upsertTicket);
  const rimuoviTicket = useBoardStore((s) => s.rimuoviTicket);

  const [titoloEdit, setTitoloEdit] = useState<string | null>(null); // null = non in modifica
  const [descrizione, setDescrizione] = useState<string | null>(null);
  const [errore, setErrore] = useState('');

  const chiave = ['ticket-dettaglio', ticketId];
  const { data } = useQuery<{ ticket: Ticket }>({
    queryKey: chiave,
    queryFn: async () => (await api.get(`/ticket/${ticketId}`)).data
  });
  const ticket = data?.ticket;

  // Sincronizza gli editor locali quando arrivano dati freschi
  useEffect(() => {
    if (ticket && descrizione === null) setDescrizione(ticket.descrizione ?? '');
  }, [ticket, descrizione]);

  // Real-time: aggiornamenti del ticket arrivati da altri utenti
  useEffect(() => {
    const s = getSocket();
    if (!s) return;
    const onAgg = (p: { ticket: Ticket }) => {
      if (p.ticket.id !== ticketId) return;
      queryClient.setQueryData(chiave, { ticket: p.ticket });
      upsertTicket(p.ticket);
      setDescrizione((d) => (d === null ? d : p.ticket.descrizione ?? ''));
    };
    const onDel = (p: { ticket_id: number }) => {
      if (p.ticket_id === ticketId) onChiudi();
    };
    s.on('ticket:aggiornato', onAgg);
    s.on('ticket:eliminato', onDel);
    return () => {
      s.off('ticket:aggiornato', onAgg);
      s.off('ticket:eliminato', onDel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId]);

  /** Patch generico: salva sul server e aggiorna entrambe le cache. */
  const salva = async (patch: Partial<Ticket>) => {
    if (!ticket) return;
    setErrore('');
    // Aggiornamento ottimistico
    const ottimistico = { ...ticket, ...patch };
    queryClient.setQueryData(chiave, { ticket: ottimistico });
    upsertTicket(ottimistico);
    try {
      const res = await api.put(`/ticket/${ticketId}`, patch);
      queryClient.setQueryData(chiave, { ticket: res.data.ticket });
      upsertTicket(res.data.ticket);
    } catch (err) {
      setErrore(messaggioErrore(err));
      queryClient.invalidateQueries({ queryKey: chiave }); // rollback
    }
  };

  const confermaTitolo = async () => {
    if (titoloEdit === null || !ticket) return;
    const t = titoloEdit.trim();
    setTitoloEdit(null);
    if (t && t !== ticket.titolo) await salva({ titolo: t });
  };

  const elimina = async () => {
    if (!confirm('Eliminare definitivamente questo ticket?')) return;
    try {
      await api.delete(`/ticket/${ticketId}`);
      rimuoviTicket(ticketId);
      onChiudi();
    } catch (err) {
      setErrore(messaggioErrore(err));
    }
  };

  if (!ticket) {
    return (
      <Dialog open onOpenChange={(o) => !o && onChiudi()}>
        <DialogContent width="max-w-2xl">
          <p className="text-sm text-muted">Caricamento ticket…</p>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onChiudi()}>
      <DialogContent width="max-w-3xl">
        <DialogHeader className="pr-6">
          {/* ID ticket + titolo editabile inline (click per modificare) */}
          <div className="flex items-center gap-2">
            <span className="rounded border border-border px-1.5 py-0.5 text-[11px] text-muted">
              #{ticket.id}
            </span>
            <span className="text-[11px] text-muted-2">
              creato da {ticket.creatore_nome ?? '—'}
            </span>
          </div>

          {titoloEdit === null ? (
            <button
              onClick={() => setTitoloEdit(ticket.titolo)}
              className="group flex items-center gap-2 text-left text-lg font-semibold hover:text-accent"
              title="Clicca per modificare"
            >
              {ticket.titolo}
              <Pencil className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-60" />
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <Input
                autoFocus
                value={titoloEdit}
                onChange={(e) => setTitoloEdit(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void confermaTitolo();
                  if (e.key === 'Escape') setTitoloEdit(null);
                }}
                className="text-lg font-semibold"
              />
              <Button size="icon" className="h-8 w-8 shrink-0" onClick={() => void confermaTitolo()}>
                <Check className="h-4 w-4" />
              </Button>
            </div>
          )}
        </DialogHeader>

        <div className="grid gap-5 md:grid-cols-[1fr_220px]">
          {/* -------- Colonna sinistra: descrizione + commenti -------- */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted">
                Descrizione (markdown: **bold**, *italic*, `code`)
              </Label>
              <Textarea
                value={descrizione ?? ''}
                onChange={(e) => setDescrizione(e.target.value)}
                onBlur={() => {
                  if (descrizione !== null && descrizione !== (ticket.descrizione ?? '')) {
                    void salva({ descrizione: descrizione || null });
                  }
                }}
                rows={4}
                placeholder="Aggiungi una descrizione…"
              />
              {/* Anteprima del markdown base */}
              {descrizione && (
                <div className="rounded-md border border-border bg-background/50 p-2.5 text-xs leading-relaxed text-muted">
                  {renderMarkdown(descrizione)}
                </div>
              )}
            </div>

            <CommentiSezione ticketId={ticketId} />
          </div>

          {/* -------- Colonna destra: proprietà del ticket -------- */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted">Stato</Label>
              <select
                value={ticket.stato}
                onChange={(e) => void salva({ stato: e.target.value as Stato })}
                className="flex h-8 w-full rounded-md border border-border bg-surface px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
              >
                {COLONNE.map((c) => (
                  <option key={c.stato} value={c.stato}>
                    {LABEL_STATO[c.stato]}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted">Priorità</Label>
              <select
                value={ticket.priorita}
                onChange={(e) => void salva({ priorita: e.target.value as Priorita })}
                className="flex h-8 w-full rounded-md border border-border bg-surface px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
              >
                {(Object.keys(LABEL_PRIORITA) as Priorita[]).map((p) => (
                  <option key={p} value={p}>
                    {LABEL_PRIORITA[p]}
                  </option>
                ))}
              </select>
              {/* Barra colore della priorità selezionata */}
              <div
                className="h-1 w-full rounded-full"
                style={{ backgroundColor: COLORI_PRIORITA[ticket.priorita] }}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted">Assegnatario</Label>
              <select
                value={ticket.assegnato_a ?? ''}
                onChange={(e) =>
                  void salva({ assegnato_a: e.target.value ? Number(e.target.value) : null })
                }
                className="flex h-8 w-full rounded-md border border-border bg-surface px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
              >
                <option value="">Nessuno</option>
                {membri.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted">Scadenza</Label>
              <Input
                type="date"
                value={ticket.scadenza ? String(ticket.scadenza).slice(0, 10) : ''}
                onChange={(e) => void salva({ scadenza: e.target.value || null })}
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted">Etichette</Label>
              <div className="flex flex-wrap gap-1">
                {(ticket.etichette ?? []).map((e) => (
                  <span key={e} className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] text-muted">
                    {e}
                  </span>
                ))}
                {(ticket.etichette ?? []).length === 0 && (
                  <span className="text-[10px] text-muted-2">nessuna</span>
                )}
              </div>
            </div>

            {errore && <p className="text-xs text-destructive">{errore}</p>}

            <Button variant="destructive" size="sm" className="w-full" onClick={() => void elimina()}>
              <Trash2 className="h-3.5 w-3.5" /> Elimina ticket
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}


