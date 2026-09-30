import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import pool from '../config/database.js';
import { verificaToken, generaAccessToken, generaRefreshToken } from '../middleware/auth.js';

const router = Router();

// Limite richieste: protezione da attacchi brute-force su login/register
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { errore: 'Troppe richieste, riprova tra qualche minuto' }
});

// --- Schemi di validazione (zod) ---
const schemaRegister = z.object({
  nome: z.string().min(2, 'Il nome deve avere almeno 2 caratteri').max(100),
  email: z.string().email('Email non valida').max(150),
  password: z.string().min(8, 'La password deve avere almeno 8 caratteri').max(100)
});

const schemaLogin = z.object({
  email: z.string().email('Email non valida'),
  password: z.string().min(1, 'Password obbligatoria')
});

/** POST /api/auth/register — registra un utente e crea il suo workspace personale. */
router.post('/register', authLimiter, async (req, res) => {
  try {
    const parsed = schemaRegister.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ errore: parsed.error.issues[0].message });
    }
    const { nome, email, password } = parsed.data;

    const [esistenti] = await pool.query('SELECT id FROM utenti WHERE email = ?', [email]);
    if (esistenti.length > 0) {
      return res.status(409).json({ errore: 'Email già registrata' });
    }

    // Hash della password (10 salt rounds)
    const hash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'INSERT INTO utenti (nome, email, password) VALUES (?, ?, ?)',
      [nome, email, hash]
    );
    const userId = result.insertId;

    // Crea di default un workspace personale per il nuovo utente
    const slug = `ws-${nome.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}-${Date.now().toString(36)}`;
    const [ws] = await pool.query(
      'INSERT INTO workspace (nome, slug, owner_id) VALUES (?, ?, ?)',
      [`Workspace di ${nome}`, slug, userId]
    );
    await pool.query(
      'INSERT INTO workspace_members (workspace_id, utente_id, ruolo) VALUES (?, ?, ?)',
      [ws.insertId, userId, 'owner']
    );

    const user = { id: userId, nome, email };
    const accessToken = generaAccessToken(user);
    const refreshToken = generaRefreshToken(user);

    // Refresh token solo in cookie httpOnly (non accessibile via JS)
    impostaCookieRefresh(res, refreshToken);
    return res.status(201).json({ accessToken, user });
  } catch (err) {
    console.error('Errore register:', err);
    return res.status(500).json({ errore: 'Errore interno del server' });
  }
});

/** POST /api/auth/login — verifica le credenziali e rilascia i token. */
router.post('/login', authLimiter, async (req, res) => {
  try {
    const parsed = schemaLogin.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ errore: parsed.error.issues[0].message });
    }
    const { email, password } = parsed.data;

    const [utenti] = await pool.query(
      'SELECT id, nome, email, password, avatar_url FROM utenti WHERE email = ?',
      [email]
    );
    if (utenti.length === 0) {
      return res.status(401).json({ errore: 'Credenziali non valide' });
    }

    const utente = utenti[0];
    const ok = await bcrypt.compare(password, utente.password);
    if (!ok) {
      return res.status(401).json({ errore: 'Credenziali non valide' });
    }

    const user = { id: utente.id, nome: utente.nome, email: utente.email };
    const accessToken = generaAccessToken(user);
    const refreshToken = generaRefreshToken(user);

    impostaCookieRefresh(res, refreshToken);
    return res.json({
      accessToken,
      user: { ...user, avatar_url: utente.avatar_url }
    });
  } catch (err) {
    console.error('Errore login:', err);
    return res.status(500).json({ errore: 'Errore interno del server' });
  }
});

/**
 * POST /api/auth/refresh — rilascia un nuovo access token.
 * Il refresh token arriva solo dal cookie httpOnly: questo permette
 * di ripristinare la sessione al refresh della pagina senza salvare
 * nulla in localStorage.
 */
router.post('/refresh', async (req, res) => {
  try {
    const nomeCookie = process.env.REFRESH_COOKIE_NAME || 'devboard_refresh';
    const token = req.cookies?.[nomeCookie];
    if (!token) {
      return res.status(401).json({ errore: 'Refresh token assente' });
    }

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    } catch {
      return res.status(401).json({ errore: 'Refresh token non valido' });
    }

    const [utenti] = await pool.query(
      'SELECT id, nome, email, avatar_url FROM utenti WHERE id = ?',
      [payload.sub]
    );
    if (utenti.length === 0) {
      return res.status(401).json({ errore: 'Utente inesistente' });
    }

    const user = utenti[0];
    // Rotazione: nuovo refresh token ad ogni uso
    impostaCookieRefresh(res, generaRefreshToken(user));

    return res.json({ accessToken: generaAccessToken(user), user });
  } catch (err) {
    console.error('Errore refresh:', err);
    return res.status(500).json({ errore: 'Errore interno del server' });
  }
});

/** DELETE /api/auth/logout — rimuove il cookie del refresh token. */
router.delete('/logout', (_req, res) => {
  const { maxAge, ...opt } = opzioniCookieRefresh();
  res.clearCookie(process.env.REFRESH_COOKIE_NAME || 'devboard_refresh', opt);
  return res.json({ ok: true });
});

/** GET /api/auth/me — restituisce l'utente corrente (richiede access token). */
router.get('/me', verificaToken, async (req, res) => {
  const [utenti] = await pool.query(
    'SELECT id, nome, email, avatar_url FROM utenti WHERE id = ?',
    [req.user.id]
  );
  if (utenti.length === 0) return res.status(404).json({ errore: 'Utente non trovato' });
  return res.json({ user: utenti[0] });
});

/**
 * Attributi del cookie di refresh.
 * In produzione (frontend e backend su domini DIVERSI, es. Vercel + Render)
 * serve SameSite=None + Secure: con SameSite=Lax il browser non invierebbe
 * il cookie nelle richieste cross-site e il silent-refresh fallirebbe.
 * In locale resta SameSite=Lax (più restrittivo).
 * Sovrascrivibile con la variabile COOKIE_SAMESITE.
 */
function opzioniCookieRefresh() {
  const sameSite =
    process.env.COOKIE_SAMESITE ||
    (process.env.NODE_ENV === 'production' ? 'none' : 'lax');
  return {
    httpOnly: true, // non accessibile da JavaScript
    sameSite,
    secure: sameSite === 'none' || process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 giorni
    path: '/'
  };
}

/** Imposta il cookie httpOnly del refresh token (7 giorni). */
function impostaCookieRefresh(res, token) {
  res.cookie(process.env.REFRESH_COOKIE_NAME || 'devboard_refresh', token, opzioniCookieRefresh());
}

export default router;

