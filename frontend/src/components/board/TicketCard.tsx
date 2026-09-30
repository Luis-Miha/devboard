import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion } from 'framer-motion';
import { CalendarDays, MessageSquare, GripVertical } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { COLORI_PRIORITA, LABEL_PRIORITA, type Ticket } from '@/types';
import { cn } from '@/utils/cn';

interface Props {
  ticket: Ticket;
  onApri: (t: Ticket) => void;
  inTrasporto?: boolean;
}

/**
 * Card del kanban: priorità a colori, avatar assegnatario,
 * etichette, scadenza e contatore commenti.
 * Trascinabile tramite @dnd-kit (useSortable).
 */
export default function TicketCard({ ticket, onApri, inTrasporto }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: ticket.id
  });

  const scadenza = ticket.scadenza ? new Date(ticket.scadenza) : null;
  const inRitardo =
    scadenza && ticket.stato !== 'done' && scadenza.getTime() < Date.now();

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      onClick={() => !isDragging && onApri(ticket)}
      className={cn(
        'group relative cursor-pointer rounded-md border border-border bg-surface p-3 shadow-sm transition-colors hover:border-accent/50',
        isDragging && 'opacity-40',
        inTrasporto && 'drag-overlay border-accent shadow-lg'
      )}
    >
      {/* Indicatore priorità sul lato sinistro */}
      <span
        className="absolute left-0 top-0 h-full w-1 rounded-l-md"
        style={{ backgroundColor: COLORI_PRIORITA[ticket.priorita] }}
        title={`Priorità: ${LABEL_PRIORITA[ticket.priorita]}`}
      />

      <div className="pl-2">
        {/* Header: etichette + grip */}
        <div className="mb-1.5 flex items-start justify-between gap-2">
          <div className="flex flex-wrap gap-1">
            {(ticket.etichette ?? []).slice(0, 2).map((e) => (
              <span
                key={e}
                className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] text-muted"
              >
                {e}
              </span>
            ))}
          </div>
          <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-2 opacity-0 transition-opacity group-hover:opacity-100" />
        </div>

        {/* Titolo */}
        <p className="mb-2 text-[13px] leading-snug text-foreground">{ticket.titolo}</p>

        {/* Footer: id, scadenza, commenti, avatar */}
        <div className="flex items-center justify-between text-[11px] text-muted">
          <div className="flex items-center gap-2">
            <span className="rounded border border-border px-1 py-0.5 text-[10px] text-muted-2">
              #{ticket.id}
            </span>
            {scadenza && (
              <span
                className={cn(
                  'flex items-center gap-1',
                  inRitardo ? 'text-destructive' : 'text-muted'
                )}
              >
                <CalendarDays className="h-3 w-3" />
                {scadenza.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {ticket.assegnatario_nome && (
              <Avatar className="h-5 w-5">
                <AvatarImage
                  src={ticket.assegnatario_avatar || undefined}
                  alt={ticket.assegnatario_nome}
                />
                <AvatarFallback className="text-[9px]">
                  {ticket.assegnatario_nome.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            )}
          </div>
        </div>
      </div>

      {/* Micro-animazione all'entrata della card */}
      {isDragging && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="pointer-events-none absolute inset-0 rounded-md border border-accent"
        />
      )}
    </div>
  );
}
