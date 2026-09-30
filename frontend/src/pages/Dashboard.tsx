import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid
} from 'recharts';
import { CircleDot, CheckCircle2, AlertTriangle, Layers } from 'lucide-react';
import { api } from '@/services/api';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  LABEL_PRIORITA,
  LABEL_STATO,
  COLORI_PRIORITA,
  type Attivita,
  type StatsDashboard,
  type Workspace
} from '@/types';

export default function Dashboard() {
  const { data: wsData } = useQuery<{ workspace: Workspace[] }>({
    queryKey: ['workspace'],
    queryFn: async () => (await api.get('/workspace')).data
  });
  const workspace = wsData?.workspace?.[0];

  const { data: stats } = useQuery<StatsDashboard>({
    queryKey: ['stats', workspace?.id],
    enabled: !!workspace,
    queryFn: async () => (await api.get(`/workspace/${workspace!.id}/stats`)).data
  });

  const { data: attivitaData } = useQuery<{ attivita: Attivita[] }>({
    queryKey: ['attivita', workspace?.id],
    enabled: !!workspace,
    queryFn: async () => (await api.get(`/workspace/${workspace!.id}/attivita`)).data
  });
  const attivita = attivitaData?.attivita ?? [];

  const card = [
    {
      titolo: 'Ticket aperti',
      valore: stats?.aperti ?? '—',
      icona: CircleDot,
      colore: 'text-accent'
    },
    {
      titolo: 'Completati questa settimana',
      valore: stats?.completatiSettimana ?? '—',
      icona: CheckCircle2,
      colore: 'text-success'
    },
    {
      titolo: 'In ritardo',
      valore: stats?.inRitardo ?? '—',
      icona: AlertTriangle,
      colore: 'text-destructive'
    },
    {
      titolo: 'Ticket totali',
      valore: stats?.totali ?? '—',
      icona: Layers,
      colore: 'text-warning'
    }
  ];

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted">
          Panoramica di {workspace?.nome ?? '…'} — i dati si aggiornano in tempo reale
        </p>
      </div>

      {/* ---- Card statistiche ---- */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {card.map((c, i) => (
          <motion.div
            key={c.titolo}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className={`rounded-md bg-surface-2 p-2 ${c.colore}`}>
                  <c.icona className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xl font-semibold leading-tight">{c.valore}</p>
                  <p className="text-xs text-muted">{c.titolo}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        {/* ---- Grafico a barre: completati negli ultimi 7 giorni ---- */}
        <Card>
          <CardHeader>
            <CardTitle>Ticket completati — ultimi 7 giorni</CardTitle>
          </CardHeader>
          <CardContent className="h-64 pb-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats?.completatiGiorni ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2e2e35" vertical={false} />
                <XAxis
                  dataKey="etichetta"
                  tick={{ fill: '#8b8b96', fontSize: 11 }}
                  axisLine={{ stroke: '#2e2e35' }}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: '#8b8b96', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={24}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(91,91,214,0.08)' }}
                  contentStyle={{
                    backgroundColor: '#1a1a1f',
                    border: '1px solid #2e2e35',
                    borderRadius: 8,
                    fontSize: 12,
                    color: '#e4e4e7'
                  }}
                />
                <Bar dataKey="conteggio" name="Completati" fill="#5b5bd6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* ---- Attività recente ---- */}
        <Card>
          <CardHeader>
            <CardTitle>Attività recente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {attivita.length === 0 && (
              <p className="text-xs text-muted-2">Nessuna attività recente</p>
            )}
            {attivita.map((a) => (
              <div key={a.chiave} className="flex items-start gap-2 text-xs">
                <Badge variant={a.tipo === 'commento' ? 'default' : 'secondary'}>
                  {a.tipo === 'commento' ? '💬' : '🎫'}
                </Badge>
                <div className="min-w-0">
                  <p className="truncate text-foreground">{a.descrizione}</p>
                  <p className="text-[10px] text-muted-2">
                    {new Date(a.tempo).toLocaleString('it-IT', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* ---- Assegnati a me ---- */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Assegnati a me</CardTitle>
          <span className="text-xs text-muted">{stats?.assegnatiAMe?.length ?? 0} attivi</span>
        </CardHeader>
        <CardContent className="space-y-2">
          {(stats?.assegnatiAMe ?? []).length === 0 && (
            <p className="text-xs text-muted-2">Nessun ticket assegnato — sei in pari! 🎉</p>
          )}
          {(stats?.assegnatiAMe ?? []).map((t) => (
            <Link
              key={t.id}
              to={`/progetti/${t.progetto_id}/board`}
              className="flex items-center justify-between gap-3 rounded-md border border-border bg-background/40 px-3 py-2.5 transition-colors hover:border-accent/50"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: COLORI_PRIORITA[t.priorita] }}
                  title={LABEL_PRIORITA[t.priorita]}
                />
                <span className="truncate text-sm">{t.titolo}</span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-[11px] text-muted-2">{t.progetto_nome}</span>
                <Badge variant="secondary">{LABEL_STATO[t.stato]}</Badge>
                {t.scadenza && (
                  <span className="text-[11px] text-muted">
                    {new Date(t.scadenza).toLocaleDateString('it-IT', {
                      day: '2-digit',
                      month: 'short'
                    })}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

