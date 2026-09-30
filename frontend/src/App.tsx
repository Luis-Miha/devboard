import { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/authStore';
import Layout from '@/components/layout/Layout';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import Dashboard from '@/pages/Dashboard';
import Board from '@/pages/Board';
import Backlog from '@/pages/Backlog';
import Impostazioni from '@/pages/Impostazioni';

/** Route protetta: prova il refresh della sessione, poi reindirizza al login. */
function Protetta({ children }: { children: React.ReactNode }) {
  const { initialized, user } = useAuthStore();
  const { init } = useAuth();

  useEffect(() => {
    void init();
  }, [init]);

  if (!initialized) {
    // Splash breve durante il tentativo di ripristino sessione
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

/** Transizione animata tra pagine (Framer Motion). */
function Pagina({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className="h-full"
    >
      {children}
    </motion.div>
  );
}

export default function App() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/login" element={<Pagina><Login /></Pagina>} />
        <Route path="/register" element={<Pagina><Register /></Pagina>} />
        <Route
          path="/"
          element={
            <Protetta>
              <Layout />
            </Protetta>
          }
        >
          <Route index element={<Pagina><Dashboard /></Pagina>} />
          <Route path="progetti/:id/board" element={<Pagina><Board /></Pagina>} />
          <Route path="progetti/:id/backlog" element={<Pagina><Backlog /></Pagina>} />
          <Route path="impostazioni" element={<Pagina><Impostazioni /></Pagina>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  );
}
