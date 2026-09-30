import { useState } from 'react';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { Plus } from 'lucide-react';
import TicketCard from './TicketCard';
import TicketForm from '@/components/ticket/TicketForm';
import type { Membro, Stato, Ticket } from '@/types';

interface Props {
  stato: Stato;
  titolo: string;
  colore: string;
  ticket: Ticket[];
  membri: Membro[];
  onApri: (t: Ticket) => void;
}

/**
 * Colonna del kanban: header con badge contatore, lista di card
 * sortable e pulsante "+ Nuovo ticket". Zona droppable per il drag.
 */
export default function KanbanColonna({ stato, titolo, colore, ticket, membri, onApri }: Props) {
  const [formAperto, setFormAperto] = useState(false);

  // La colonna stessa è un droppable: permette di rilasciare in area vuota
  const { setNodeRef, isOver } = useDroppable({ id: `col-${stato}` });

  return (
    <div className="flex w-72 shrink-0 flex-col">
      {/* Header colonna */}
      <div className="mb-2 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colore }} />
          <h3 className="text-sm font-medium text-foreground">{titolo}</h3>
          {/* Badge con numero ticket della colonna */}
          <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold text-muted">
            {ticket.length}
          </span>
        </div>
        <button
          onClick={() => setFormAperto(true)}
          className="flex h-6 w-6 items-center justify-center rounded text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
          title="Nuovo ticket in questa colonna"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Lista card */}
      <div
        ref={setNodeRef}
        className={`flex-1 space-y-2 rounded-lg border border-dashed p-2 transition-colors min-h-24 ${
          isOver ? 'border-accent/60 bg-accent/5' : 'border-transparent'
        }`}
      >
        <SortableContext items={ticket.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {ticket.map((t) => (
            <TicketCard key={t.id} ticket={t} onApri={onApri} />
          ))}
        </SortableContext>

        {ticket.length === 0 && (
          <p className="px-2 py-4 text-center text-xs text-muted-2">
            Trascina qui un ticket
          </p>
        )}
      </div>

      {/* Modal di creazione ticket pre-compilato con lo stato della colonna */}
      <TicketForm
        aperto={formAperto}
        onChiudi={() => setFormAperto(false)}
        statoIniziale={stato}
        membri={membri}
      />
    </div>
  );
}
