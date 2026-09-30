import { Router } from 'express';
import pool from '../config/database.js';
import { verificaToken } from '../middleware/auth.js';

const router = Router();
router.use(verificaToken);

/** GET /api/notifiche — ultime 50 notifiche dell'utente + conteggio non lette. */
router.get('/', async (req, res) => {
  try {
    const [notifiche] = await pool.query(
      `SELECT id, tipo, messaggio, ticket_id, letta, created_at
       FROM notifiche
       WHERE utente_id = ?
       ORDER BY created_at DESC
       LIMIT 50`,
      [req.user.id]
    );
    const nonLette = notifiche.filter((n) => !n.letta).length;
    return res.json({ notifiche, nonLette });
  } catch (err) {
    console.error('GET notifiche:', err);
    return res.status(500).json({ errore: 'Errore interno del server' });
  }
});

/** PATCH /api/notifiche/:id/letta — segna una singola notifica come letta. */
router.patch('/:id/letta', async (req, res) => {
  try {
    await pool.query('UPDATE notifiche SET letta = TRUE WHERE id = ? AND utente_id = ?', [
      req.params.id,
      req.user.id
    ]);
    return res.json({ ok: true });
  } catch (err) {
    console.error('PATCH notifica:', err);
    return res.status(500).json({ errore: 'Errore interno del server' });
  }
});

/** PATCH /api/notifiche/lettre — segna tutte le notifiche come lette. */
router.patch('/lettre', async (req, res) => {
  try {
    await pool.query('UPDATE notifiche SET letta = TRUE WHERE utente_id = ?', [req.user.id]);
    return res.json({ ok: true });
  } catch (err) {
    console.error('PATCH notifiche:', err);
    return res.status(500).json({ errore: 'Errore interno del server' });
  }
});

export default router;
