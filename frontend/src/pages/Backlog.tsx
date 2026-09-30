import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, Columns3 } from 'lucide-react';
import { api } from '@/services/api';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import TicketModal from '@/components/ticket/TicketModal';
import {
  COLONNE,
  LABEL_PRIORITA,
  LABEL_STATO,
  COLORI_PRIORITA,
  type Membro,
  type Priorita,
  type Stato,
  type Ticket,
  type Workspace
} from '@/types';
import { cn } from '@/utils/cn';

type Ordinamento = 'data' | 'priorita' | 'stato';
const RANK_PRIORITA: Record<Priorita, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
const RANK_STATO: Record<Stato, number> = {
  backlog: 0,
  todo: 1,
  in_progress: 2,
  in_review: 3,
  done: 4
};

/** Backlog: lista piatta di tutti i ticket con filtri, ricerca e ordinamento. */
export default function Backlog() {
  const { id: progettoId } = useParams();
  const id = Number(progettoId);

  const [statoFiltro, setStatoFiltro] = useState('');
  const [prioFiltro, setPrioFiltro] = useState('');
  const [assFiltro, setAssFiltro] = useState('');
  const [ricerca, setRicerca] = useState('');
  const [ricercaDebounced, setRicercaDebounced] = useState('');
  const [ordinamento, setOrdinamento] = useState<Ordinamento>('data');
  const [selezionato, setSelezionato] = useState<Ticket | null>(null);

  // Debounce della ricerca (300ms) per non interrogare il DB a ogni tasto
  useEffect(() => {
    const t = window.setTimeout(() => setRicercaDebounced(ricerca), 300);
    return () => window.clearTimeout(t);
  }, [ricerca]);

  const { data: wsData } = useQuery<{ workspace: Workspace[] }>({
    queryKey: ['workspace'],
    queryFn: async () => (await api.get('/workspace')).data
  });
  const workspace = wsData?.workspace?.[0];

  const { data: membriData } = useQuery<{ membri: Membro[] }>({
    queryKey: ['membri', workspace?.id],
    enabled: !!workspace,
    queryFn: async () => (await api.get(`/workspace/${workspace!.id}/membri`)).data
  });
  const membri = membriData?.membri ?? [];

  const { data: ticketData } = useQuery<{ ticket: Ticket[] }>({
    queryKey: ['ticket', id],
    enabled: !!id,
    queryFn: async () => (await api.get(`/progetti/${id}/ticket`)).data
  });

  const lista = useMemo(() => {
    let risultato = [...(ticketData?.ticket ?? [])];

    if (statoFiltro) risultato = risultato.filter((t) => t.stato === statoFiltro);
    if (prioFiltro) risultato = risultato.filter((t) => t.priorita === prioFiltro);
    if (assFiltro === 'none') risultato = risultato.filter((t) => !t.assegnato_a);
    else if (assFiltro) risultato = risultato.filter((t) => t.assegnato_a === Number(assFiltro));

    const q = ricercaDebounced.trim().toLowerCase();
    if (q) risultato = risultato.filter((t) => t.titolo.toLowerCase().includes(q));

    if (ordinamento === 'data') {
      risultato.sort(
        (a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
      );
    } else if (ordinamento === 'priorita') {
      risultato.sort((a, b) => RANK_PRIORITA[a.priorita] - RANK_PRIORITA[b.priorita]);
    } else {
      risultato.sort((a, b) => RANK_STATO[a.stato] - RANK_STATO[b.stato]);
    }
    return risultato;
  }, [ticketData, statoFiltro, prioFiltro, assFiltro, ricercaDebounced, ordinamento]);

  const selectCls =
    'h-8 rounded-md border border-border bg-surface px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent';

  return (
    <div className="space-y-4 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Backlog</h1>
          <p className="text-sm text-muted">{lista.length} ticket visualizzati</p>
        </div>
        <Link
          to={`/progetti/${id}/board`}
          className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
        >
          <Columns3 className="h-3.5 w-3.5" /> Vista Board
        </Link>
      </div>

      {/* Barra filtri */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-2" />
          <Input
            value={ricerca}
            onChange={(e) => setRicerca(e.target.value)}
            placeholder="Cerca per titolo…"
            className="h-8 w-56 pl-8 text-xs"
          />
        </div>

        <select value={statoFiltro} onChange={(e) => setStatoFiltro(e.target.value)} className={selectCls}>
          <option value="">Tutti gli stati</option>
          {COLONNE.map((c) => (
            <option key={c.stato} value={c.stato}>
              {LABEL_STATO[c.stato]}
            </option>
          ))}
        </select>

        <select value={prioFiltro} onChange={(e) => setPrioFiltro(e.target.value)} className={selectCls}>
          <option value="">Tutte le priorità</option>
          {(Object.keys(LABEL_PRIORITA) as Priorita[]).map((p) => (
            <option key={p} value={p}>
              {LABEL_PRIORITA[p]}
            </option>
          ))}
        </select>

        <select value={assFiltro} onChange={(e) => setAssFiltro(e.target.value)} className={selectCls}>
          <option value="">Tutti gli assegnatari</option>
          <option value="none">Non assegnati</option>
          {membri.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nome}
            </option>
          ))}
        </select>

        <select
          value={ordinamento}
          onChange={(e) => setOrdinamento(e.target.value as Ordinamento)}
          className={cn(selectCls, 'ml-auto')}
        >
          <option value="data">Ordina: più recenti</option>
          <option value="priorita">Ordina: priorità</option>
          <option value="stato">Ordina: stato</option>
        </select>
      </div>

      {/* Lista piatta */}
      <div className="overflow-hidden rounded-lg border border-border">
        {lista.length === 0 && (
          <p className="p-8 text-center text-sm text-muted">Nessun ticket corrisponde ai filtri</p>
        )}
        {lista.map((t, i) => (
          <button
            key={t.id}
            onClick={() => setSelezionato(t)}
            className={cn(
              'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2',
              i > 0 && 'border-t border-border'
            )}
          >
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: COLORI_PRIORITA[t.priorita] }}
              title={LABEL_PRIORITA[t.priorita]}
            />
            <span className="w-10 shrink-0 text-[11px] text-muted-2">#{t.id}</span>
            <span className="min-w-0 flex-1 truncate text-sm">{t.titolo}</span>
            <span className="hidden w-28 shrink-0 truncate text-[11px] text-muted sm:block">
              {t.assegnatario_nome ?? '—'}
            </span>
            <Badge variant="secondary" className="shrink-0">
              {LABEL_STATO[t.stato]}
            </Badge>
            <span className="w-16 shrink-0 text-right text-[11px] text-muted">
              {t.scadenza
                ? new Date(t.scadenza).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })
                : '—'}
            </span>
          </button>
        ))}
      </div>

      {selezionato && (
        <TicketModal ticketId={selezionato.id} onChiudi={() => setSelezionato(null)} membri={membri} />
      )}
    </div>
  );
}

