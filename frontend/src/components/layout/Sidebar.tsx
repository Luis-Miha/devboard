import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { LayoutDashboard, Plus, Settings, Ticket as TicketIcon, LogOut } from 'lucide-react';
import { api, messaggioErrore } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import type { Progetto, Workspace } from '@/types';

const schemaNuovoProgetto = z.object({
  nome: z.string().min(2, 'Inserisci almeno 2 caratteri').max(200),
  colore: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Colore non valido')
});
type FormNuovoProgetto = z.infer<typeof schemaNuovoProgetto>;

/** Elenchi di colori predefiniti per i progetti. */
const COLORI = ['#5b5bd6', '#22c55e', '#f97316', '#ec4899', '#06b6d4', '#eab308'];

/** Sidebar fissa 240px: workspace, progetti, i miei ticket, impostazioni. */
export default function Sidebar() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, logout } = useAuth();
  const [aperto, setAperto] = useState(false);
  const [errore, setErrore] = useState('');

  // Workspace dell'utente (React Query condivide la cache con le pagine)
  const { data: wsData } = useQuery<{ workspace: Workspace[] }>({
    queryKey: ['workspace'],
    queryFn: async () => (await api.get('/workspace')).data
  });
  const workspace = wsData?.workspace?.[0];

  // Progetti dello workspace attivo
  const { data: projData } = useQuery<{ progetti: Progetto[] }>({
    queryKey: ['progetti', workspace?.id],
    enabled: !!workspace,
    queryFn: async () => (await api.get(`/workspace/${workspace!.id}/progetti`)).data
  });
  const progetti = projData?.progetti ?? [];

  // "I miei ticket": prime voci dalle statistiche della dashboard
  const { data: stats } = useQuery<{
    assegnatiAMe: { id: number; titolo: string; progetto_id: number; stato: string }[];
  }>({
    queryKey: ['stats', workspace?.id],
    enabled: !!workspace,
    queryFn: async () => (await api.get(`/workspace/${workspace!.id}/stats`)).data
  });
  const mieiTicket = (stats?.assegnatiAMe ?? []).slice(0, 5);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting }
  } = useForm<FormNuovoProgetto>({
    resolver: zodResolver(schemaNuovoProgetto),
    defaultValues: { nome: '', colore: COLORI[0] }
  });

  const coloreScelto = watch('colore');

  /** Creazione progetto → invalida la lista e apre la nuova board. */
  const onSubmit = handleSubmit(async (dati) => {
    setErrore('');
    try {
      const res = await api.post(`/workspace/${workspace?.id}/progetti`, dati);
      await queryClient.invalidateQueries({ queryKey: ['progetti', workspace?.id] });
      reset();
      setAperto(false);
      navigate(`/progetti/${res.data.progetto.id}/board`);
    } catch (err) {
      setErrore(messaggioErrore(err));
    }
  });

  const linkCls = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors ${
      isActive ? 'bg-accent/15 text-foreground' : 'text-muted hover:bg-surface-2 hover:text-foreground'
    }`;

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-border bg-surface/40">
      {/* Logo + nome workspace */}
      <div className="flex h-14 items-center gap-2 border-b border-border px-4">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent text-sm font-bold text-white">
          D
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight">DevBoard</p>
          <p className="truncate text-[11px] leading-tight text-muted">
            {workspace?.nome ?? 'Caricamento…'}
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {/* Navigazione principale */}
        <div className="space-y-1">
          <NavLink to="/" end className={linkCls}>
            <LayoutDashboard className="h-4 w-4" /> Dashboard
          </NavLink>
          <NavLink to="/impostazioni" className={linkCls}>
            <Settings className="h-4 w-4" /> Impostazioni
          </NavLink>
        </div>

        {/* Progetti + bottone crea */}
        <div>
          <div className="mb-1.5 flex items-center justify-between px-2.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-2">
              Progetti
            </span>
            <Dialog open={aperto} onOpenChange={setAperto}>
              <DialogTrigger asChild>
                <button
                  className="flex h-5 w-5 items-center justify-center rounded text-muted hover:bg-surface-2 hover:text-foreground"
                  title="Crea progetto"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </DialogTrigger>
              <DialogContent width="max-w-sm">
                <DialogHeader>
                  <DialogTitle>Nuovo progetto</DialogTitle>
                </DialogHeader>
                <form onSubmit={onSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="nome">Nome progetto</Label>
                    <Input id="nome" placeholder="es. Sito Marketing" {...register('nome')} />
                    {errors.nome && (
                      <p className="text-xs text-destructive">{errors.nome.message}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Colore</Label>
                    <div className="flex gap-2">
                      {COLORI.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setValue('colore', c)}
                          style={{ backgroundColor: c }}
                          className={`h-6 w-6 rounded-full transition-transform ${
                            coloreScelto === c ? 'scale-110 ring-2 ring-white/60' : 'hover:scale-105'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  {errore && <p className="text-xs text-destructive">{errore}</p>}
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="ghost" size="sm" onClick={() => setAperto(false)}>
                      Annulla
                    </Button>
                    <Button type="submit" size="sm" disabled={isSubmitting}>
                      {isSubmitting ? 'Creazione…' : 'Crea progetto'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="space-y-0.5">
            {progetti.map((p) => (
              <NavLink key={p.id} to={`/progetti/${p.id}/board`} className={linkCls}>
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: p.colore }} />
                <span className="truncate">{p.nome}</span>
              </NavLink>
            ))}
            {progetti.length === 0 && (
              <p className="px-2.5 py-1 text-xs text-muted-2">Nessun progetto</p>
            )}
          </div>
        </div>

        {/* Sezione: i miei ticket */}
        <div>
          <p className="mb-1.5 px-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-2">
            I miei ticket
          </p>
          <div className="space-y-0.5">
            {mieiTicket.map((t) => (
              <Link
                key={t.id}
                to={`/progetti/${t.progetto_id}/board`}
                className="flex items-start gap-2 rounded-md px-2.5 py-1.5 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
              >
                <TicketIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span className="line-clamp-2 leading-snug">{t.titolo}</span>
              </Link>
            ))}
            {mieiTicket.length === 0 && stats && (
              <p className="px-2.5 py-1 text-xs text-muted-2">Nessun ticket assegnato</p>
            )}
          </div>
        </div>
      </nav>

      {/* Footer: avatar + nome utente + logout */}
      <div className="flex items-center gap-2 border-t border-border px-3 py-3">
        <Avatar className="h-8 w-8">
          <AvatarImage src={user?.avatar_url || undefined} alt={user?.nome} />
          <AvatarFallback>{user?.nome?.charAt(0)?.toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm leading-tight">{user?.nome}</p>
          <p className="truncate text-[11px] leading-tight text-muted">{user?.email}</p>
        </div>
        <button
          onClick={() => void logout()}
          className="rounded p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-destructive"
          title="Esci"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
}


