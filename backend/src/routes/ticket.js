import { Router } from 'express';
import { z } from 'zod';
import pool from '../config/database.js';
import { verificaToken } from '../middleware/auth.js';
import { getRuoloInWorkspace } from '../middleware/ruolo.js';

const router = Router();
router.use(verificaToken);

const STATI = ['backlog', 'todo', 'in_progress', 'in_review', 'done'];
const PRIORITA = ['urgent', 'high', 'medium', 'low'];

const schemaTicket = z.object({
  titolo: z.string().min(1, 'Titolo obbligatorio').max(300),
  descrizione: z.string().max(10000).optional().nullable(),
  stato: z.enum(STATI).optional(),
  priorita: z.enum(PRIORITA).optional(),
  assegnato_a: z.number().int().optional().nullable(),
  scadenza: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data non valida (YYYY-MM-DD)').optional().nullable(),
  etichette: z.array(z.string().max(30)).max(10).optional()
});

/** Accesso al ticket garantito solo ai membri dello workspace del progetto. */
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

/** Emite un evento real-time a tutti i membri nella room del progetto. */
function emetti(req, progettoId, evento, payload) {
  const io = req.app.get('io');
  if (io) io.to(`progetto:${progettoId}`).emit(evento, payload);
}

/** Forma JSON standard di un ticket (etichette JSON → array). */
function formaTicket(t) {
  return {
    ...t,
    etichette: typeof t.etichette === 'string' ? JSON.parse(t.etichette || '[]') : t.etichette || []
  };
}

/** GET /api/progetti/:id/ticket — tutti i ticket di un progetto, ordinati. */
router.get('/progetti/:id/ticket', async (req, res) => {
  try {
    const [progetti] = await pool.query('SELECT id, workspace_id FROM progetti WHERE id = ?', [
      req.params.id
    ]);
    if (progetti.length === 0) return res.status(404).json({ errore: 'Progetto non trovato' });

    const ruolo = await getRuoloInWorkspace(progetti[0].workspace_id, req.user.id);
    if (!ruolo) return res.status(403).json({ errore: 'Non sei membro di questo workspace' });

    const [ticket] = await pool.query(
      `SELECT t.id, t.progetto_id, t.titolo, t.descrizione, t.stato, t.priorita,
              t.assegnato_a, t.creato_da, t.ordine, t.scadenza, t.etichette,
              t.created_at, t.updated_at,
              ua.nome AS assegnatario_nome, ua.avatar_url AS assegnatario_avatar,
              uc.nome AS creatore_nome
       FROM ticket t
       LEFT JOIN utenti ua ON ua.id = t.assegnato_a
       LEFT JOIN utenti uc ON uc.id = t.creato_da
       WHERE t.progetto_id = ?
       ORDER BY t.ordine ASC, t.id ASC`,
      [req.params.id]
    );

    return res.json({ ticket: ticket.map(formaTicket) });
  } catch (err) {
    console.error('GET ticket:', err);
    return res.status(500).json({ errore: 'Errore interno del server' });
  }
});

/** POST /api/progetti/:id/ticket — crea un ticket (ordine = fine colonna). */
router.post('/progetti/:id/ticket', async (req, res) => {
  try {
    const [progetti] = await pool.query('SELECT id, workspace_id FROM progetti WHERE id = ?', [
      req.params.id
    ]);
    if (progetti.length === 0) return res.status(404).json({ errore: 'Progetto non trovato' });
    const ruolo = await getRuoloInWorkspace(progetti[0].workspace_id, req.user.id);
    if (!ruolo) return res.status(403).json({ errore: 'Non sei membro di questo workspace' });

    const parsed = schemaTicket.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ errore: parsed.error.issues[0].message });
    }
    const d = parsed.data;
    const stato = d.stato || 'todo';

    // Ordine in coda alla colonna di destinazione
    const [max] = await pool.query(
      'SELECT COALESCE(MAX(ordine), -1) AS maxOrdine FROM ticket WHERE progetto_id = ? AND stato = ?',
      [req.params.id, stato]
    );
    const ordine = max[0].maxOrdine + 1;

    const [result] = await pool.query(
      `INSERT INTO ticket (progetto_id, titolo, descrizione, stato, priorita, assegnato_a, creato_da, ordine, scadenza, etichette)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.params.id,
        d.titolo,
        d.descrizione || null,
        stato,
        d.priorita || 'medium',
        d.assegnato_a || null,
        req.user.id,
        ordine,
        d.scadenza || null,
        JSON.stringify(d.etichette || [])
      ]
    );

    const [nuovi] = await pool.query(
      `SELECT t.*, uc.nome AS creatore_nome FROM ticket t
       LEFT JOIN utenti uc ON uc.id = t.creato_da WHERE t.id = ?`,
      [result.insertId]
    );
    const ticket = formaTicket(nuovi[0]);

    emetti(req, req.params.id, 'ticket:creato', {
      ticket,
      eseguito_da: req.user.id
    });

    return res.status(201).json({ ticket });
  } catch (err) {
    console.error('POST ticket:', err);
    return res.status(500).json({ errore: 'Errore interno del server' });
  }
});

/** GET /api/ticket/:id — dettaglio ticket (con dati assegnatario/creatore). */
router.get('/ticket/:id', async (req, res) => {
  try {
    const t = await accessoTicket(Number(req.params.id), req.user.id);
    if (!t) return res.status(404).json({ errore: 'Ticket non trovato' });

    const [dettaglio] = await pool.query(
      `SELECT t.*, ua.nome AS assegnatario_nome, ua.avatar_url AS assegnatario_avatar,
              uc.nome AS creatore_nome
       FROM ticket t
       LEFT JOIN utenti ua ON ua.id = t.assegnato_a
       LEFT JOIN utenti uc ON uc.id = t.creato_da
       WHERE t.id = ?`,
      [req.params.id]
    );
    return res.json({ ticket: formaTicket(dettaglio[0]) });
  } catch (err) {
    console.error('GET ticket/:id:', err);
    return res.status(500).json({ errore: 'Errore interno del server' });
  }
});

/** PUT /api/ticket/:id — aggiorna i campi del ticket (titolo, descrizione, stato, priorità, scadenza...). */
router.put('/ticket/:id', async (req, res) => {
  try {
    const esistente = await accessoTicket(Number(req.params.id), req.user.id);
    if (!esistente) return res.status(404).json({ errore: 'Ticket non trovato' });

    const parsed = schemaTicket.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ errore: parsed.error.issues[0].message });
    }
    const d = parsed.data;

    await pool.query(
      `UPDATE ticket SET
         titolo = COALESCE(?, titolo),
         descrizione = COALESCE(?, descrizione),
         stato = COALESCE(?, stato),
         priorita = COALESCE(?, priorita),
         assegnato_a = ?, scadenza = ?, etichette = COALESCE(?, etichette)
       WHERE id = ?`,
      [
        d.titolo ?? null,
        d.descrizione ?? null,
        d.stato ?? null,
        d.priorita ?? null,
        d.assegnato_a !== undefined ? d.assegnato_a : esistente.assegnato_a,
        d.scadenza !== undefined ? d.scadenza : esistente.scadenza,
        d.etichette ? JSON.stringify(d.etichette) : null,
        req.params.id
      ]
    );

    const [aggiornati] = await pool.query(
      `SELECT t.*, ua.nome AS assegnatario_nome, ua.avatar_url AS assegnatario_avatar,
              uc.nome AS creatore_nome
       FROM ticket t
       LEFT JOIN utenti ua ON ua.id = t.assegnato_a
       LEFT JOIN utenti uc ON uc.id = t.creato_da
       WHERE t.id = ?`,
      [req.params.id]
    );
    const ticket = formaTicket(aggiornati[0]);

    emetti(req, esistente.progetto_id, 'ticket:aggiornato', {
      ticket,
      eseguito_da: req.user.id
    });

    return res.json({ ticket });
  } catch (err) {
    console.error('PUT ticket:', err);
    return res.status(500).json({ errore: 'Errore interno del server' });
  }
});

/** DELETE /api/ticket/:id — elimina (solo creatore o admin/owner del workspace). */
router.delete('/ticket/:id', async (req, res) => {
  try {
    const t = await accessoTicket(Number(req.params.id), req.user.id);
    if (!t) return res.status(404).json({ errore: 'Ticket non trovato' });

    const ruolo = await getRuoloInWorkspace(t.workspace_id, req.user.id);
    if (t.creato_da !== req.user.id && !['owner', 'admin'].includes(ruolo)) {
      return res.status(403).json({ errore: 'Non puoi eliminare questo ticket' });
    }

    await pool.query('DELETE FROM commenti WHERE ticket_id = ?', [req.params.id]);
    await pool.query('DELETE FROM notifiche WHERE ticket_id = ?', [req.params.id]);
    await pool.query('DELETE FROM ticket WHERE id = ?', [req.params.id]);

    emetti(req, t.progetto_id, 'ticket:eliminato', {
      ticket_id: Number(req.params.id),
      eseguito_da: req.user.id
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error('DELETE ticket:', err);
    return res.status(500).json({ errore: 'Errore interno del server' });
  }
});

/**
 * PATCH /api/ticket/riordina — aggiorna stato/ordine di più ticket
 * dopo un drag & drop sulla board.
 * Body: { ticket: [{ id, stato, ordine }] }
 * Se un ticket cambia colonna viene emesso `ticket:spostato`,
 * altrimenti solo `ticket:aggiornato` (riordinamento nella stessa colonna).
 */
router.patch('/ticket/riordina', async (req, res) => {
  try {
    const schema = z.object({
      ticket: z
        .array(
          z.object({
            id: z.number().int(),
            stato: z.enum(STATI),
            ordine: z.number().int().min(0)
          })
        )
        .min(1)
        .max(200)
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ errore: parsed.error.issues[0].message });
    }

    const conn = await pool.getConnection();
    let progettoId = null;
    try {
      await conn.beginTransaction();
      const spostati = [];

      for (const item of parsed.data.ticket) {
        const [prima] = await conn.query('SELECT stato, progetto_id FROM ticket WHERE id = ?', [
          item.id
        ]);
        if (prima.length === 0) continue;
        progettoId = progettoId || prima[0].progetto_id;
        await conn.query('UPDATE ticket SET stato = ?, ordine = ? WHERE id = ?', [
          item.stato,
          item.ordine,
          item.id
        ]);
        if (prima[0].stato !== item.stato) spostati.push(item.id);
      }

      await conn.commit();

      // Broadcast: tutti gli altri client sincronizzano la board.
      // L'evento è sempre `ticket:spostato` (array {id, stato, ordine}).
      if (progettoId) {
        emetti(req, progettoId, 'ticket:spostato', {
          ticket: parsed.data.ticket,
          spostati,
          eseguito_da: req.user.id
        });
      }

      return res.json({ ok: true });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error('PATCH riordina:', err);
    return res.status(500).json({ errore: 'Errore interno del server' });
  }
});

/** PATCH /api/ticket/:id/assegna — assegna/rimuovi assegnatario + notifica. */
router.patch('/ticket/:id/assegna', async (req, res) => {
  try {
    const t = await accessoTicket(Number(req.params.id), req.user.id);
    if (!t) return res.status(404).json({ errore: 'Ticket non trovato' });

    const parsed = z.object({ assegnato_a: z.number().int().nullable() }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ errore: 'assegnato_a non valido' });

    await pool.query('UPDATE ticket SET assegnato_a = ? WHERE id = ?', [
      parsed.data.assegnato_a,
      req.params.id
    ]);

    const [aggiornati] = await pool.query(
      `SELECT t.*, ua.nome AS assegnatario_nome, ua.avatar_url AS assegnatario_avatar
       FROM ticket t LEFT JOIN utenti ua ON ua.id = t.assegnato_a WHERE t.id = ?`,
      [req.params.id]
    );
    const ticket = formaTicket(aggiornati[0]);

    emetti(req, t.progetto_id, 'ticket:aggiornato', {
      ticket,
      eseguito_da: req.user.id
    });

    // Notifica di assegnazione
    if (parsed.data.assegnato_a && parsed.data.assegnato_a !== req.user.id) {
      const messaggio = `${req.user.nome} ti ha assegnato #TK-${t.id} "${t.titolo.slice(0, 60)}"`;
      const [n] = await pool.query(
        'INSERT INTO notifiche (utente_id, tipo, messaggio, ticket_id) VALUES (?, ?, ?, ?)',
        [parsed.data.assegnato_a, 'assegnazione', messaggio, t.id]
      );
      const io = req.app.get('io');
      if (io) {
        io.to(`utente:${parsed.data.assegnato_a}`).emit('notifica:nuova', {
          id: n.insertId,
          tipo: 'assegnazione',
          messaggio,
          ticket_id: t.id,
          letta: false,
          created_at: new Date().toISOString()
        });
      }
    }

    return res.json({ ticket });
  } catch (err) {
    console.error('PATCH assegna:', err);
    return res.status(500).json({ errore: 'Errore interno del server' });
  }
});

export default router;


