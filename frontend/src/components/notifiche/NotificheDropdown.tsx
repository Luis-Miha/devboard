import { Bell, Check, CheckCheck } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { useNotifiche } from '@/hooks/useNotifiche';

/** Campanella con badge contatore + lista notifiche in dropdown. */
export default function NotificheDropdown() {
  const { data, segnaTutte, segnaUna } = useNotifiche();

  const notifiche = data?.notifiche ?? [];
  const nonLette = data?.nonLette ?? 0;

  const apriNotifica = (n: (typeof notifiche)[number]) => {
    if (!n.letta) void segnaUna(n.id);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="relative flex h-8 w-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-foreground focus:outline-none"
          aria-label="Notifiche"
        >
          <Bell className="h-4 w-4" />
          {nonLette > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
              {nonLette > 9 ? '9+' : nonLette}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="text-sm font-semibold">Notifiche</span>
          {nonLette > 0 && (
            <button
              onClick={() => void segnaTutte()}
              className="flex items-center gap-1 text-xs text-accent hover:text-accent-hover"
            >
              <CheckCheck className="h-3.5 w-3.5" /> Segna tutte come lette
            </button>
          )}
        </div>

        <div className="max-h-80 overflow-y-auto">
          {notifiche.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted">Nessuna notifica</p>
          )}

          {notifiche.map((n) => (
            <button
              key={n.id}
              onClick={() => apriNotifica(n)}
              className={`flex w-full items-start gap-2 px-3 py-2.5 text-left transition-colors hover:bg-surface-2 ${
                n.letta ? 'opacity-60' : ''
              }`}
            >
              {!n.letta && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />}
              {n.letta && <span className="mt-1.5 h-1.5 w-1.5 shrink-0" />}
              <div className="min-w-0">
                <p className="break-words text-xs leading-relaxed text-foreground">{n.messaggio}</p>
                <p className="mt-0.5 text-[10px] text-muted-2">
                  {new Date(n.created_at).toLocaleString('it-IT', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>
            </button>
          ))}
        </div>

        {notifiche.some((n) => !n.letta) && (
          <button
            onClick={() => void segnaTutte()}
            className="flex w-full items-center justify-center gap-1 border-t border-border py-2 text-xs text-muted hover:text-foreground"
          >
            <Check className="h-3 w-3" /> Segna tutte come lette
          </button>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
