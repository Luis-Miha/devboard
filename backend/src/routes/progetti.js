import { Router } from 'express';
import { z } from 'zod';
import pool from '../config/database.js';
import { verificaToken } from '../middleware/auth.js';
import { requireRuolo, getRuoloInWorkspace } from '../middleware/ruolo.js';

const router = Router();
router.use(verificaToken);

const schemaProgetto = z.object({
  nome: z.string().min(2, 'Il nome deve avere almeno 2 caratteri').max(200),
  descrizione: z.string().max(2000).optional().nullable(),
  colore: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Colore non valido (es. #3b82f6)').optional()
});

/** Verifica che l'utente sia membro dello workspace del progetto. */
async function membroDelProgetto(progettoId, userId) {
  const [righe] = await pool.query(
    `SELECT p.id, p.workspace_id, p.nome, p.descrizione, p.colore
     FROM progetti p
     JOIN workspace_members wm ON wm.workspace_id = p.workspace_id AND wm.utente_id = ?
     WHERE p.id = ?`,
    [userId, progettoId]
  );
  return righe.length > 0 ? righe[0] : null;
}

/** GET /api/workspace/:id/progetti — lista progetti di uno workspace. */
router.get('/workspace/:id/progetti', async (req, res) => {
  try {
    const ruolo = await getRuoloInWorkspace(Number(req.params.id), req.user.id);
    if (!ruolo) return res.status(403).json({ errore: 'Non sei membro di questo workspace' });

    const [progetti] = await pool.query(
      'SELECT * FROM progetti WHERE workspace_id = ? ORDER BY created_at ASC',
      [req.params.id]
    );
    return res.json({ progetti });
  } catch (err) {
    console.error('GET progetti:', err);
    return res.status(500).json({ errore: 'Errore interno del server' });
  }
});

/** POST /api/workspace/:id/progetti — crea un progetto. */
router.post('/workspace/:id/progetti', async (req, res) => {
  try {
    const ruolo = await getRuoloInWorkspace(Number(req.params.id), req.user.id);
    if (!ruolo) return res.status(403).json({ errore: 'Non sei membro di questo workspace' });

    const parsed = schemaProgetto.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ errore: parsed.error.issues[0].message });
    }
    const { nome, descrizione, colore } = parsed.data;

    const [result] = await pool.query(
      'INSERT INTO progetti (workspace_id, nome, descrizione, colore) VALUES (?, ?, ?, ?)',
      [req.params.id, nome, descrizione || null, colore || '#3b82f6']
    );

    const [nuovo] = await pool.query('SELECT * FROM progetti WHERE id = ?', [result.insertId]);
    return res.status(201).json({ progetto: nuovo[0] });
  } catch (err) {
    console.error('POST progetti:', err);
    return res.status(500).json({ errore: 'Errore interno del server' });
  }
});

/** PUT /api/progetti/:id — aggiorna nome/descrizione/colore. */
router.put('/:id', async (req, res) => {
  try {
    const progetto = await membroDelProgetto(Number(req.params.id), req.user.id);
    if (!progetto) return res.status(404).json({ errore: 'Progetto non trovato' });

    const parsed = schemaProgetto.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ errore: parsed.error.issues[0].message });
    }
    const { nome, descrizione, colore } = parsed.data;

    await pool.query(
      `UPDATE progetti SET
         nome = COALESCE(?, nome),
         descrizione = COALESCE(?, descrizione),
         colore = COALESCE(?, colore)
       WHERE id = ?`,
      [nome ?? null, descrizione ?? null, colore ?? null, req.params.id]
    );

    const [aggiornato] = await pool.query('SELECT * FROM progetti WHERE id = ?', [req.params.id]);
    return res.json({ progetto: aggiornato[0] });
  } catch (err) {
    console.error('PUT progetti:', err);
    return res.status(500).json({ errore: 'Errore interno del server' });
  }
});

/**
 * DELETE /api/progetti/:id — elimina il progetto.
 * RBAC: solo admin/owner possono eliminare (requireRuolo).
 */
router.delete('/:id', requireRuolo(['owner', 'admin']), async (req, res) => {
  try {
    const [progetti] = await pool.query('SELECT id FROM progetti WHERE id = ?', [req.params.id]);
    if (progetti.length === 0) return res.status(404).json({ errore: 'Progetto non trovato' });

    // Le FK ON DELETE non sono CASCADE: si eliminano prima i figli
    await pool.query(
      'DELETE c FROM commenti c JOIN ticket t ON t.id = c.ticket_id WHERE t.progetto_id = ?',
      [req.params.id]
    );
    await pool.query('DELETE FROM notifiche WHERE ticket_id IN (SELECT id FROM ticket WHERE progetto_id = ?)', [
      req.params.id
    ]);
    await pool.query('DELETE FROM ticket WHERE progetto_id = ?', [req.params.id]);
    await pool.query('DELETE FROM progetti WHERE id = ?', [req.params.id]);

    return res.json({ ok: true });
  } catch (err) {
    console.error('DELETE progetti:', err);
    return res.status(500).json({ errore: 'Errore interno del server' });
  }
});

export default router;
