import { useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api, messaggioErrore } from '@/services/api';
import { useBoardStore } from '@/store/boardStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { COLONNE, LABEL_PRIORITA, type Membro, type Priorita, type Stato } from '@/types';
import { useState } from 'react';

const schema = z.object({
  titolo: z.string().min(1, 'Titolo obbligatorio').max(300),
  descrizione: z.string().max(10000).optional(),
  stato: z.enum(['backlog', 'todo', 'in_progress', 'in_review', 'done']),
  priorita: z.enum(['urgent', 'high', 'medium', 'low']),
  scadenza: z.string().optional(),
  assegnato_a: z.string().optional()
});
type FormData = z.infer<typeof schema>;

interface Props {
  aperto: boolean;
  onChiudi: () => void;
  statoIniziale: Stato;
  membri: Membro[];
}

/** Modal di creazione ticket (react-hook-form + zod). */
export default function TicketForm({ aperto, onChiudi, statoIniziale, membri }: Props) {
  const { id: progettoId } = useParams();
  const upsertTicket = useBoardStore((s) => s.upsertTicket);
  const [errore, setErrore] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      titolo: '',
      descrizione: '',
      stato: statoIniziale,
      priorita: 'medium',
      scadenza: '',
      assegnato_a: ''
    }
  });

  const onSubmit = handleSubmit(async (dati) => {
    setErrore('');
    try {
      const res = await api.post(`/progetti/${progettoId}/ticket`, {
        titolo: dati.titolo,
        descrizione: dati.descrizione || null,
        stato: dati.stato,
        priorita: dati.priorita,
        scadenza: dati.scadenza || null,
        assegnato_a: dati.assegnato_a ? Number(dati.assegnato_a) : null
      });
      upsertTicket(res.data.ticket); // aggiunta immediata in board
      reset();
      onChiudi();
    } catch (err) {
      setErrore(messaggioErrore(err));
    }
  });

  return (
    <Dialog
      open={aperto}
      onOpenChange={(o) => {
        if (!o) {
          reset();
          setErrore('');
          onChiudi();
        }
      }}
    >
      <DialogContent width="max-w-xl">
        <DialogHeader>
          <DialogTitle>Nuovo ticket</DialogTitle>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="tf-titolo">Titolo</Label>
            <Input id="tf-titolo" placeholder="es. Fix bug login su Safari" {...register('titolo')} />
            {errors.titolo && <p className="text-xs text-destructive">{errors.titolo.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tf-desc">Descrizione</Label>
            <Textarea
              id="tf-desc"
              placeholder="Dettagli, passi per riprodurre, link… (markdown base)"
              rows={3}
              {...register('descrizione')}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tf-stato">Stato</Label>
              <select
                id="tf-stato"
                {...register('stato')}
                className="flex h-9 w-full rounded-md border border-border bg-surface px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
              >
                {COLONNE.map((c) => (
                  <option key={c.stato} value={c.stato}>
                    {c.titolo}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tf-prio">Priorità</Label>
              <select
                id="tf-prio"
                {...register('priorita')}
                className="flex h-9 w-full rounded-md border border-border bg-surface px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
              >
                {(Object.keys(LABEL_PRIORITA) as Priorita[]).map((p) => (
                  <option key={p} value={p}>
                    {LABEL_PRIORITA[p]}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tf-scad">Scadenza</Label>
              <Input id="tf-scad" type="date" {...register('scadenza')} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tf-ass">Assegna a</Label>
              <select
                id="tf-ass"
                {...register('assegnato_a')}
                className="flex h-9 w-full rounded-md border border-border bg-surface px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
              >
                <option value="">Nessuno</option>
                {membri.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {errore && <p className="text-xs text-destructive">{errore}</p>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={onChiudi}>
              Annulla
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting ? 'Creazione…' : 'Crea ticket'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
