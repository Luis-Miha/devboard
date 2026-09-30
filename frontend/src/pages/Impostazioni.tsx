import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { UserPlus, Trash2, Shield } from 'lucide-react';
import { api, messaggioErrore } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { Membro, Workspace } from '@/types';

const schemaInvito = z.object({
  email: z.string().email('Email non valida'),
  ruolo: z.enum(['admin', 'member'])
});
type FormInvito = z.infer<typeof schemaInvito>;

const LABEL_RUOLO: Record<string, string> = {
  owner: 'Proprietario',
  admin: 'Admin',
  member: 'Membro'
};

/** Impostazioni workspace: info, membri, inviti e rimozione (RBAC admin). */
export default function Impostazioni() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [errore, setErrore] = useState('');
  const [messaggio, setMessaggio] = useState('');

  const { data: wsData } = useQuery<{ workspace: Workspace[] }>({
    queryKey: ['workspace'],
    queryFn: async () => (await api.get('/workspace')).data
  });
  const workspace = wsData?.workspace?.[0];
  const mioRuolo = workspace?.ruolo;

  const { data: membriData } = useQuery<{ membri: Membro[] }>({
    queryKey: ['membri', workspace?.id],
    enabled: !!workspace,
    queryFn: async () => (await api.get(`/workspace/${workspace!.id}/membri`)).data
  });
  const membri = membriData?.membri ?? [];

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<FormInvito>({
    resolver: zodResolver(schemaInvito),
    defaultValues: { email: '', ruolo: 'member' }
  });

  const puoGestire = mioRuolo === 'owner' || mioRuolo === 'admin';

  /** Invita un membro esistente per email. */
  const invia = handleSubmit(async (dati) => {
    setErrore('');
    setMessaggio('');
    try {
      await api.post(`/workspace/${workspace?.id}/invita`, dati);
      await queryClient.invalidateQueries({ queryKey: ['membri', workspace?.id] });
      setMessaggio(`${dati.email} aggiunto come ${LABEL_RUOLO[dati.ruolo]}`);
      reset();
    } catch (err) {
      setErrore(messaggioErrore(err));
    }
  });

  const rimuovi = async (membroId: number) => {
    if (!confirm('Rimuovere questo membro dal workspace?')) return;
    setErrore('');
    try {
      await api.delete(`/workspace/${workspace?.id}/membri/${membroId}`);
      await queryClient.invalidateQueries({ queryKey: ['membri', workspace?.id] });
    } catch (err) {
      setErrore(messaggioErrore(err));
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-xl font-semibold">Impostazioni</h1>
        <p className="text-sm text-muted">Gestisci workspace e membri del team</p>
      </div>

      {/* Info workspace */}
      <Card>
        <CardHeader>
          <CardTitle>Workspace</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-4">
          <div>
            <p className="text-lg font-semibold">{workspace?.nome ?? '…'}</p>
            <p className="text-xs text-muted">slug: {workspace?.slug ?? '—'}</p>
          </div>
          <Badge variant="default">
            <Shield className="h-3 w-3" /> {LABEL_RUOLO[mioRuolo ?? 'member']}
          </Badge>
        </CardContent>
      </Card>

      {/* Membri */}
      <Card>
        <CardHeader>
          <CardTitle>Membri ({membri.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {membri.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between gap-3 rounded-md border border-border bg-background/40 px-3 py-2.5"
            >
              <div className="flex min-w-0 items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={m.avatar_url || undefined} alt={m.nome} />
                  <AvatarFallback>{m.nome.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm">
                    {m.nome} {m.id === user?.id && <span className="text-muted-2">(tu)</span>}
                  </p>
                  <p className="truncate text-xs text-muted">{m.email}</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge variant={m.ruolo === 'owner' ? 'default' : 'secondary'}>
                  {LABEL_RUOLO[m.ruolo]}
                </Badge>
                {puoGestire && m.ruolo !== 'owner' && m.id !== user?.id && (
                  <button
                    onClick={() => void rimuovi(m.id)}
                    className="rounded p-1.5 text-muted transition-colors hover:bg-destructive/15 hover:text-destructive"
                    title="Rimuovi dal workspace"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Invito membri (solo admin/owner) */}
      <Card>
        <CardHeader>
          <CardTitle>Invita un membro</CardTitle>
        </CardHeader>
        <CardContent>
          {!puoGestire ? (
            <p className="text-xs text-muted">Solo gli admin/owner possono invitare nuovi membri.</p>
          ) : (
            <form onSubmit={invia} className="flex flex-wrap items-end gap-3">
              <div className="min-w-52 flex-1 space-y-1.5">
                <Label htmlFor="inv-email">Email dell'utente registrato</Label>
                <Input id="inv-email" type="email" placeholder="nome@esempio.it" {...register('email')} />
                {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="inv-ruolo">Ruolo</Label>
                <select
                  id="inv-ruolo"
                  {...register('ruolo')}
                  className="flex h-9 rounded-md border border-border bg-surface px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                >
                  <option value="member">Membro</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <Button type="submit" size="sm" disabled={isSubmitting}>
                <UserPlus className="h-3.5 w-3.5" />
                {isSubmitting ? 'Invio…' : 'Invita'}
              </Button>
            </form>
          )}
          {errore && <p className="mt-2 text-xs text-destructive">{errore}</p>}
          {messaggio && <p className="mt-2 text-xs text-success">{messaggio}</p>}
        </CardContent>
      </Card>
    </div>
  );
}

