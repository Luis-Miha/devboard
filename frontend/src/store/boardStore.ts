import { create } from 'zustand';
import type { Stato, Ticket } from '@/types';

/**
 * Stato locale della board kanban.
 * Rispecchia il contenuto del DB e viene aggiornato in tempo reale
 * dagli eventi Socket.io e dalle risposte REST.
 */
interface BoardState {
  ticket: Ticket[];
  caricamento: boolean;
  setTicket: (ticket: Ticket[]) => void;
  setCaricamento: (v: boolean) => void;
  /** Inserisce o sostituisce un ticket (creazione / evento real-time). */
  upsertTicket: (t: Ticket) => void;
  rimuoviTicket: (id: number) => void;
  /** Spostamento ottimistico durante il drag (prima della risposta del server). */
  spostaLocale: (id: number, stato: Stato, ordine: number) => void;
  /** Applica un riordino bulk ({id, stato, ordine} per più ticket). */
  applicaRiordino: (items: { id: number; stato: Stato; ordine: number }[]) => void;
  reset: () => void;
}

/** Riordina in modo stabile per campo `ordine`. */
function perOrdine(a: Ticket, b: Ticket) {
  return a.ordine - b.ordine || a.id - b.id;
}

export const useBoardStore = create<BoardState>((set) => ({
  ticket: [],
  caricamento: false,
  setTicket: (ticket) => set({ ticket: [...ticket].sort(perOrdine) }),
  setCaricamento: (caricamento) => set({ caricamento }),
  upsertTicket: (t) =>
    set((s) => {
      const esiste = s.ticket.some((x) => x.id === t.id);
      const aggiornati = esiste
        ? s.ticket.map((x) => (x.id === t.id ? { ...x, ...t } : x))
        : [...s.ticket, t];
      return { ticket: aggiornati.sort(perOrdine) };
    }),
  rimuoviTicket: (id) => set((s) => ({ ticket: s.ticket.filter((t) => t.id !== id) })),
  spostaLocale: (id, stato, ordine) =>
    set((s) => ({
      ticket: s.ticket.map((t) => (t.id === id ? { ...t, stato, ordine } : t)).sort(perOrdine)
    })),
  applicaRiordino: (items) =>
    set((s) => ({
      ticket: s.ticket
        .map((t) => {
          const nuovo = items.find((i) => i.id === t.id);
          return nuovo ? { ...t, stato: nuovo.stato, ordine: nuovo.ordine } : t;
        })
        .sort(perOrdine)
    })),
  reset: () => set({ ticket: [], caricamento: false })
}));
