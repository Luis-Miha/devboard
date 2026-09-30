import { useLocation } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import NotificheDropdown from '@/components/notifiche/NotificheDropdown';
import { useAuth } from '@/hooks/useAuth';

/** Navbar fissa 56px: titolo pagina + campanella notifiche + utente. */
export default function Navbar() {
  const location = useLocation();
  const { user, logout } = useAuth();

  // Titolo derivato dal percorso corrente
  const titolo = (() => {
    if (location.pathname.includes('/board')) return 'Board';
    if (location.pathname.includes('/backlog')) return 'Backlog';
    if (location.pathname.startsWith('/impostazioni')) return 'Impostazioni';
    return 'Dashboard';
  })();

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-surface/50 px-5 backdrop-blur">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted">DevBoard</span>
        <span className="text-muted-2">/</span>
        <span className="font-medium text-foreground">{titolo}</span>
      </div>

      <div className="flex items-center gap-3">
        <NotificheDropdown />

        <div className="flex items-center gap-2 border-l border-border pl-3">
          <Avatar className="h-7 w-7">
            <AvatarImage src={user?.avatar_url || undefined} alt={user?.nome} />
            <AvatarFallback>{user?.nome?.charAt(0)?.toUpperCase()}</AvatarFallback>
          </Avatar>
          <span className="hidden text-sm text-muted sm:block">{user?.nome}</span>
          <button
            onClick={() => void logout()}
            className="ml-1 rounded border border-border px-2 py-1 text-xs text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
            title="Esci"
          >
            Esci
          </button>
        </div>
      </div>
    </header>
  );
}
