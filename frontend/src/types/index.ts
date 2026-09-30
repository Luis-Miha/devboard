// ============================================================
// Tipi TypeScript condivisi da tutta l'applicazione
// ============================================================

export type Stato = 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done';
export type Priorita = 'urgent' | 'high' | 'medium' | 'low';
export type Ruolo = 'owner' | 'admin' | 'member';

export interface Utente {
  id: number;
  nome: string;
  email: string;
  avatar_url?: string | null;
}

export interface Workspace {
  id: number;
  nome: string;
  slug: string;
  owner_id: number;
  created_at?: string;
  ruolo?: Ruolo;
}

export interface Membro extends Utente {
  ruolo: Ruolo;
  joined_at?: string;
}

export interface Progetto {
  id: number;
  workspace_id: number;
  nome: string;
  descrizione?: string | null;
  colore: string;
  created_at?: string;
}

export interface Ticket {
  id: number;
  progetto_id: number;
  titolo: string;
  descrizione?: string | null;
  stato: Stato;
  priorita: Priorita;
  assegnato_a: number | null;
  creato_da: number;
  ordine: number;
  scadenza?: string | null;
  etichette: string[];
  created_at?: string;
  updated_at?: string;
  // campi derivati dai JOIN
  assegnatario_nome?: string | null;
  assegnatario_avatar?: string | null;
  creatore_nome?: string;
  progetto_nome?: string;
}

export interface Commento {
  id: number;
  ticket_id: number;
  utente_id: number;
  testo: string;
  created_at: string;
  autore: string;
  avatar_url?: string | null;
}

export interface Notifica {
  id: number;
  tipo: string;
  messaggio: string;
  ticket_id?: number | null;
  letta: boolean;
  created_at: string;
}

export interface StatsDashboard {
  aperti: number;
  totali: number;
  completatiSettimana: number;
  inRitardo: number;
  completatiGiorni: { giorno: string; etichetta: string; conteggio: number }[];
  assegnatiAMe: Ticket[];
}

export interface Attivita {
  chiave: string;
  tipo: 'commento' | 'ticket';
  descrizione: string;
  ticket_id: number;
  ticket_titolo: string;
  tempo: string;
}

/** Definisce le 5 colonne della board kanban in ordine. */
export const COLONNE: { stato: Stato; titolo: string; colore: string }[] = [
  { stato: 'backlog', titolo: 'Backlog', colore: '#8b8b96' },
  { stato: 'todo', titolo: 'To Do', colore: '#3b82f6' },
  { stato: 'in_progress', titolo: 'In Progress', colore: '#f59e0b' },
  { stato: 'in_review', titolo: 'In Review', colore: '#a855f7' },
  { stato: 'done', titolo: 'Done', colore: '#22c55e' }
];

/** Colori per priorità (bordeaux/rosso=urgent ... grigio=low). */
export const COLORI_PRIORITA: Record<Priorita, string> = {
  urgent: '#ef4444',
  high: '#f97316',
  medium: '#3b82f6',
  low: '#71717a'
};

export const LABEL_PRIORITA: Record<Priorita, string> = {
  urgent: 'Urgente',
  high: 'Alta',
  medium: 'Media',
  low: 'Bassa'
};

export const LABEL_STATO: Record<Stato, string> = {
  backlog: 'Backlog',
  todo: 'To Do',
  in_progress: 'In Progress',
  in_review: 'In Review',
  done: 'Done'
};
