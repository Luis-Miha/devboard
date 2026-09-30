import { Router } from 'express';
import { z } from 'zod';
import pool from '../config/database.js';
import { verificaToken } from '../middleware/auth.js';
import { getRuoloInWorkspace } from '../middleware/ruolo.js';

const router = Router();
router.use(verificaToken);

const schemaCommento = z.object({
  testo: z.string().min(1, 'Il commento non può essere vuoto').max(5000)
});

/** Verifica accesso al ticket (attraverso il progetto → workspace). */
async function accessoTicket(ticketId, userId) {
  const [righe] = await pool.query(
    `SELECT t.*, p.workspace_id, p.nome AS progetto_nome
     FROM ticket t
     JOIN progetti p ON p.id = t.progetto_id
     JOIN workspace_members wm ON wm.workspace_id = p.workspace_id AND wm.utente_id = ?
     WHERE t.id = ?`,
    [userId, ticketId]
  );
  return righe.length > 0 ? righe[0] : null;
}

/** GET /api/ticket/:id/commenti — lista commenti di un ticket (ordinati dal più vecchio). */
router.get('/ticket/:id/commenti', async (req, res) => {
  try {
    const ticket = await accessoTicket(Number(req.params.id), req.user.id);
    if (!ticket) return res.status(404).json({ errore: 'Ticket non trovato' });

    const [commenti] = await pool.query(
      `SELECT c.id, c.ticket_id, c.utente_id, c.testo, c.created_at,
              u.nome AS autore, u.avatar_url
       FROM commenti c
       JOIN utenti u ON u.id = c.utente_id
       WHERE c.ticket_id = ?
       ORDER BY c.created_at ASC`,
      [req.params.id]
    );
    return res.json({ commenti });
  } catch (err) {
    console.error('GET commenti:', err);
    return res.status(500).json({ errore: 'Errore interno del server' });
  }
});

/** POST /api/ticket/:id/commenti — aggiunge un commento e notifica gli interessati. */
router.post('/ticket/:id/commenti', async (req, res) => {
  try {
    const ticket = await accessoTicket(Number(req.params.id), req.user.id);
    if (!ticket) return res.status(404).json({ errore: 'Ticket non trovato' });

    const parsed = schemaCommento.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ errore: parsed.error.issues[0].message });
    }

    const [result] = await pool.query(
      'INSERT INTO commenti (ticket_id, utente_id, testo) VALUES (?, ?, ?)',
      [req.params.id, req.user.id, parsed.data.testo]
    );

    const [nuovi] = await pool.query(
      `SELECT c.id, c.ticket_id, c.utente_id, c.testo, c.created_at,
              u.nome AS autore, u.avatar_url
       FROM commenti c JOIN utenti u ON u.id = c.utente_id
       WHERE c.id = ?`,
      [result.insertId]
    );
    const commento = nuovi[0];

    const io = req.app.get('io');
    // Evento real-time: la board mostra il commento senza refresh
    io.to(`progetto:${ticket.progetto_id}`).emit('commento:nuovo', {
      ticket_id: ticket.id,
      commento
    });

    // Notifica per creatore e assegnatario (se non sei tu)
    const destinatari = [...new Set([ticket.creato_da, ticket.assegnato_a].filter(Boolean))]
      .filter((id) => id !== req.user.id);

    for (const destId of destinatari) {
      const messaggio = `${req.user.nome} ha commentato su #TK-${ticket.id} "${ticket.titolo.slice(0, 60)}"`;
      const [n] = await pool.query(
        'INSERT INTO notifiche (utente_id, tipo, messaggio, ticket_id) VALUES (?, ?, ?, ?)',
        [destId, 'commento', messaggio, ticket.id]
      );
      // Badge campanella in tempo reale
      io.to(`utente:${destId}`).emit('notifica:nuova', {
        id: n.insertId,
        tipo: 'commento',
        messaggio,
        ticket_id: ticket.id,
        letta: false,
        created_at: new Date().toISOString()
      });
    }

    return res.status(201).json({ commento });
  } catch (err) {
    console.error('POST commenti:', err);
    return res.status(500).json({ errore: 'Errore interno del server' });
  }
});

/** DELETE /api/commenti/:id — elimina il proprio commento (admin può eliminare quello degli altri). */
router.delete('/commenti/:id', async (req, res) => {
  try {
    const [commenti] = await pool.query(
      `SELECT c.id, c.utente_id, c.ticket_id, t.progetto_id
       FROM commenti c JOIN ticket t ON t.id = c.ticket_id
       WHERE c.id = ?`,
      [req.params.id]
    );
    if (commenti.length === 0) return res.status(404).json({ errore: 'Commento non trovato' });
    const commento = commenti[0];

    if (commento.utente_id !== req.user.id) {
      // Solo admin/owner del workspace possono eliminare commenti altrui
      const ruolo = await getRuoloInWorkspace(commento.progetto_id, req.user.id);
      const [progetto] = await pool.query('SELECT workspace_id FROM progetti WHERE id = ?', [
        commento.progetto_id
      ]);
      const ruolo2 = progetto[0]
        ? await getRuoloInWorkspace(progetto[0].workspace_id, req.user.id)
        : null;
      if (!['owner', 'admin'].includes(ruolo2 || ruolo)) {
        return res.status(403).json({ errore: 'Non puoi eliminare questo commento' });
      }
    }

    await pool.query('DELETE FROM commenti WHERE id = ?', [req.params.id]);
    return res.json({ ok: true });
  } catch (err) {
    console.error('DELETE commenti:', err);
    return res.status(500).json({ errore: 'Errore interno del server' });
  }
});

export default router;
