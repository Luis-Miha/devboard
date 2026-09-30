import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const schema = z.object({
  email: z.string().email('Email non valida'),
  password: z.string().min(1, 'Password obbligatoria')
});
type FormData = z.infer<typeof schema>;

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [errore, setErrore] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } });

  const onSubmit = handleSubmit(async (dati) => {
    setErrore('');
    const res = await login(dati.email, dati.password);
    if (res.ok) navigate('/', { replace: true });
    else setErrore(res.errore);
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="w-full max-w-sm rounded-lg border border-border bg-surface p-6 shadow-xl"
      >
        <div className="mb-6 flex flex-col items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-lg font-bold text-white">
            D
          </div>
          <h1 className="text-lg font-semibold">Accedi a DevBoard</h1>
          <p className="text-center text-xs text-muted">
            Il tuo project management tool real-time
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="mario@devboard.it" {...register('email')} />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" placeholder="••••••••" {...register('password')} />
            {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
          </div>

          {errore && (
            <motion.p
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              className="rounded border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
            >
              {errore}
            </motion.p>
          )}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Accesso in corso…' : 'Accedi'}
          </Button>
        </form>

        <p className="mt-4 text-center text-xs text-muted">
          Non hai un account?{' '}
          <Link to="/register" className="text-accent hover:text-accent-hover">
            Registrati
          </Link>
        </p>

        {/* Credenziali dei dati demo */}
        <div className="mt-4 rounded border border-border bg-background/60 p-2.5 text-[11px] text-muted">
          <p className="mb-1 font-semibold text-muted">Account demo</p>
          <p>mario@devboard.it · Password123!</p>
        </div>
      </motion.div>
    </div>
  );
}
