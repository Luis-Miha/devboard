import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import KanbanColonna from './KanbanColonna';
import TicketCard from './TicketCard';
import TicketModal from '@/components/ticket/TicketModal';
import { api } from '@/services/api';
import { useSocketProgetto } from '@/hooks/useSocket';
import { useAuthStore } from '@/store/authStore';
import { useBoardStore } from '@/store/boardStore';
import { COLONNE, type Membro, type Progetto, type Stato, type Ticket, type Workspace } from '@/types';

/** Ricostruisce le colonne coinvolte dopo uno spostamento e riassegna gli `ordine`. */
function ricostruisci(
  lista: Ticket[],
  activeId: number,
  overStato: Stato,
  davantiA: number | null
): Ticket[] {
  const attivo = lista.find((t) => t.id === activeId);
  if (!attivo) return lista;

  const perOrdine = (a: Ticket, b: Ticket) => a.ordine - b.ordine || a.id - b.id;
  const senza = lista.filter((t) => t.id !== activeId);

  // Colonna target con la card trascinata nella posizione giusta
  const colonna = senza.filter((t) => t.stato === overStato).sort(perOrdine);
  let pos = colonna.length;
  if (davantiA !== null) {
    const idx = colonna.findIndex((t) => t.id === davantiA);
    pos = idx >= 0 ? idx : colonna.length;
  }
  colonna.splice(pos, 0, { ...attivo, stato: overStato });

  // Riassegnazione ordini: colonna sorgente e colonna destinazione
  const mappa = new Map<number, Ticket>();
  colonna.forEach((t, i) => mappa.set(t.id, { ...t, ordine: i }));
  senza
    .filter((t) => t.stato === attivo.stato)
    .sort(perOrdine)
    .forEach((t, i) => mappa.set(t.id, { ...t, ordine: i }));

  return lista.map((t) => mappa.get(t.id) ?? t);
}

/**
 * Board kanban con 5 colonne, drag & drop (@dnd-kit) e
 * sincronizzazione real-time via Socket.io.
 */
export default function KanbanBoard() {
  const { id: progettoId } = useParams();
  const id = Number(progettoId);
  const queryClient = useQueryClient();
  const utente = useAuthStore((s) => s.user);
  const { ticket, setTicket, setCaricamento, upsertTicket, rimuoviTicket, applicaRiordino } =
    useBoardStore();

  const [attivo, setAttivo] = useState<Ticket | null>(null); // card in volo
  const [selezionato, setSelezionato] = useState<Ticket | null>(null); // modal
  const dragRef = useRef(false); // evita che il click post-drag apra il modal
  const baselineRef = useRef<Ticket[] | null>(null); // snapshot pre-drag per il confronto

  const sensors = useSensors(
    // Distanza minima 5px prima di avviare il drag (altrimenti è un click)
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // --- Dati: workspace, progetto, membri, ticket ---
  const { data: wsData } = useQuery<{ workspace: Workspace[] }>({
    queryKey: ['workspace'],
    queryFn: async () => (await api.get('/workspace')).data
  });
  const workspace = wsData?.workspace?.[0];

  const { data: projData } = useQuery<{ progetti: Progetto[] }>({
    queryKey: ['progetti', workspace?.id],
    enabled: !!workspace,
    queryFn: async () => (await api.get(`/workspace/${workspace!.id}/progetti`)).data
  });
  const progetto = projData?.progetti.find((p) => p.id === id);

  const { data: membriData } = useQuery<{ membri: Membro[] }>({
    queryKey: ['membri', workspace?.id],
    enabled: !!workspace,
    queryFn: async () => (await api.get(`/workspace/${workspace!.id}/membri`)).data
  });
  const membri = membriData?.membri ?? [];

  const { data: ticketData, isLoading } = useQuery<{ ticket: Ticket[] }>({
    queryKey: ['ticket', id],
    enabled: !!id,
    queryFn: async () => (await api.get(`/progetti/${id}/ticket`)).data
  });

  useEffect(() => {
    if (ticketData) setTicket(ticketData.ticket);
    setCaricamento(isLoading);
  }, [ticketData, isLoading, setTicket, setCaricamento]);

  // --- Real-time: gli eventi del server aggiornano lo store locale ---
  useSocketProgetto(id, {
    onCreato: (p) => upsertTicket((p as { ticket: Ticket }).ticket),
    onAggiornato: (p) => upsertTicket((p as { ticket: Ticket }).ticket),
    onSpostato: (p) => {
      const pl = p as { ticket: { id: number; stato: Stato; ordine: number }[]; eseguito_da: number };
      if (pl.eseguito_da === utente?.id) return; // è il mio stesso spostamento
      applicaRiordino(pl.ticket);
    },
    onEliminato: (p) => rimuoviTicket((p as { ticket_id: number }).ticket_id)
  });

  // Colonne con i rispettivi ticket (già ordinati dallo store)
  const colonne = useMemo(
    () => COLONNE.map((c) => ({ ...c, ticket: ticket.filter((t) => t.stato === c.stato) })),
    [ticket]
  );

  // --- Drag & drop ---
  const onDragStart = (event: DragStartEvent) => {
    dragRef.current = true;
    baselineRef.current = ticket; // snapshot prima del trascinamento
    setAttivo(ticket.find((t) => t.id === Number(event.active.id)) ?? null);
  };

  /** Durante il trascinamento: se la card entra in un'altra colonna viene mossa subito. */
  const onDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = Number(active.id);
    const overId = String(over.id);
    const att = ticket.find((t) => t.id === activeId);
    if (!att) return;

    const overStato: Stato = overId.startsWith('col-')
      ? (overId.slice(4) as Stato)
      : (ticket.find((t) => t.id === Number(overId))?.stato ?? att.stato);

    if (overStato !== att.stato) {
      const davantiA = overId.startsWith('col-') ? null : Number(overId);
      setTicket(ricostruisci(ticket, activeId, overStato, davantiA));
    }
  };

  const onDragEnd = (event: DragEndEvent) => {
    setAttivo(null);
    // Il click che segue sempre un drag non deve aprire il modal
    window.setTimeout(() => {
      dragRef.current = false;
    }, 150);

    const { active, over } = event;
    if (!over) return;
    const activeId = Number(active.id);
    const overId = String(over.id);

    let nuova = ticket;
    if (overId !== String(active.id)) {
      const att = ticket.find((t) => t.id === activeId);
      if (!att) return;
      const overStato: Stato = overId.startsWith('col-')
        ? (overId.slice(4) as Stato)
        : (ticket.find((t) => t.id === Number(overId))?.stato ?? att.stato);
      const davantiA = overId.startsWith('col-') ? null : Number(overId);
      nuova = ricostruisci(ticket, activeId, overStato, davantiA);
      setTicket(nuova);
    }

    // Confronto con lo snapshot pre-drag: se nulla è cambiato non scriviamo
    const firma = (l: Ticket[]) =>
      l
        .map((t) => `${t.id}:${t.stato}:${t.ordine}`)
        .sort()
        .join('|');
    if (baselineRef.current && firma(baselineRef.current) === firma(nuova)) return;

    // Persistenza: PATCH /ticket/riordina (broadcast ai membri dal server)
    void api
      .patch('/ticket/riordina', {
        ticket: nuova.map((t) => ({ id: t.id, stato: t.stato, ordine: t.ordine }))
      })
      .catch(() => queryClient.invalidateQueries({ queryKey: ['ticket', id] }));
  };

  const apriTicket = (t: Ticket) => {
    if (dragRef.current) return;
    setSelezionato(t);
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header progetto */}
      <div className="flex items-center justify-between border-b border-border px-6 py-3">
        <div className="flex items-center gap-2.5">
          <span
            className="h-3 w-3 rounded"
            style={{ backgroundColor: progetto?.colore ?? '#5b5bd6' }}
          />
          <h1 className="text-base font-semibold">{progetto?.nome ?? 'Caricamento…'}</h1>
          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-muted">
            {ticket.length} ticket
          </span>
        </div>
        <Link
          to={`/progetti/${id}/backlog`}
          className="rounded-md border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
        >
          Vista Backlog
        </Link>
      </div>

      {isLoading ? (
        <div className="flex gap-4 p-6">
          {COLONNE.map((c) => (
            <div key={c.stato} className="w-72 shrink-0 space-y-2">
              <div className="h-4 w-24 animate-pulse rounded bg-surface-2" />
              <div className="h-24 animate-pulse rounded bg-surface" />
              <div className="h-24 animate-pulse rounded bg-surface" />
            </div>
          ))}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
        >
          <div className="flex items-start gap-4 overflow-x-auto p-6">
            {colonne.map((c) => (
              <KanbanColonna
                key={c.stato}
                stato={c.stato}
                titolo={c.titolo}
                colore={c.colore}
                ticket={c.ticket}
                membri={membri}
                onApri={apriTicket}
              />
            ))}
          </div>

          {/* Anteprima della card mentre viene trascinata */}
          <DragOverlay>
            {attivo ? (
              <div className="w-72">
                <TicketCard ticket={attivo} onApri={() => undefined} inTrasporto />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Modal dettaglio ticket */}
      {selezionato && (
        <TicketModal
          ticketId={selezionato.id}
          onChiudi={() => setSelezionato(null)}
          membri={membri}
        />
      )}
    </div>
  );
}

