import { Router } from 'express';
import pool from '../config/database.js';
import { verificaToken } from '../middleware/auth.js';

const router = Router();
router.use(verificaToken); // le route di dashboard stanno sotto /api/workspace

/**
 * GET /api/workspace/:id/stats — statistiche per la Dashboard.
 * - aperti: ticket non in 'done'
 * - completatiSettimana: ticket passati in 'done' negli ultimi 7 giorni
 * - inRitardo: ticket con scadenza < oggi e non completati
 * - completatiGiorni: serie per il grafico a barre (ultimi 7 giorni)
 */
router.get('/:id/stats', async (req, res) => {
  try {
    const wsId = Number(req.params.id);

    const [aperti] = await pool.query(
      `SELECT COUNT(*) AS n FROM ticket t JOIN progetti p ON p.id = t.progetto_id
       WHERE p.workspace_id = ? AND t.stato != 'done'`,
      [wsId]
    );
    const [totali] = await pool.query(
      `SELECT COUNT(*) AS n FROM ticket t JOIN progetti p ON p.id = t.progetto_id
       WHERE p.workspace_id = ?`,
      [wsId]
    );
    const [fatti] = await pool.query(
      `SELECT COUNT(*) AS n FROM ticket t JOIN progetti p ON p.id = t.progetto_id
       WHERE p.workspace_id = ? AND t.stato = 'done' AND t.updated_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)`,
      [wsId]
    );
    const [ritardo] = await pool.query(
      `SELECT COUNT(*) AS n FROM ticket t JOIN progetti p ON p.id = t.progetto_id
       WHERE p.workspace_id = ? AND t.stato != 'done' AND t.scadenza IS NOT NULL AND t.scadenza < CURDATE()`,
      [wsId]
    );

    // Ticket completati per giorno (ultimi 7 giorni) → alimenta recharts
    const [perGiorno] = await pool.query(
      `SELECT DATE(t.updated_at) AS giorno, COUNT(*) AS conteggio
       FROM ticket t JOIN progetti p ON p.id = t.progetto_id
       WHERE p.workspace_id = ? AND t.stato = 'done' AND t.updated_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
       GROUP BY DATE(t.updated_at)
       ORDER BY giorno ASC`,
      [wsId]
    );

    // Compila i giorni mancanti con 0 per un grafico continuo
    const serie = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - i);
      const iso = d.toISOString().slice(0, 10);
      const riga = perGiorno.find((r) => String(r.giorno).slice(0, 10) === iso);
      serie.push({
        giorno: iso,
        etichetta: d.toLocaleDateString('it-IT', { weekday: 'short' }),
        conteggio: riga ? Number(riga.conteggio) : 0
      });
    }

    // I ticket assegnati all'utente corrente e non completati
    const [assegnati] = await pool.query(
      `SELECT t.id, t.titolo, t.stato, t.priorita, t.scadenza, t.progetto_id, p.nome AS progetto_nome, p.colore
       FROM ticket t JOIN progetti p ON p.id = t.progetto_id
       WHERE p.workspace_id = ? AND t.assegnato_a = ? AND t.stato != 'done'
       ORDER BY FIELD(t.priorita,'urgent','high','medium','low'), t.scadenza IS NULL, t.scadenza ASC
       LIMIT 15`,
      [wsId, req.user.id]
    );

    return res.json({
      aperti: Number(aperti[0].n),
      totali: Number(totali[0].n),
      completatiSettimana: Number(fatti[0].n),
      inRitardo: Number(ritardo[0].n),
      completatiGiorni: serie,
      assegnatiAMe: assegnati
    });
  } catch (err) {
    console.error('GET stats:', err);
    return res.status(500).json({ errore: 'Errore interno del server' });
  }
});

/**
 * GET /api/workspace/:id/attivita — ultimi 10 eventi del workspace.
 * Unisce commenti recenti e ticket aggiornati/creati in un'unica timeline.
 */
router.get('/:id/attivita', async (req, res) => {
  try {
    const wsId = Number(req.params.id);

    const [righe] = await pool.query(
      `(
         SELECT CONCAT('commento-', c.id) AS chiave, 'commento' AS tipo,
                CONCAT(u.nome, ' ha commentato su #TK-', t.id) AS descrizione,
                t.id AS ticket_id, t.titolo AS ticket_titolo, c.created_at AS tempo
         FROM commenti c
         JOIN ticket t ON t.id = c.ticket_id
         JOIN progetti p ON p.id = t.progetto_id
         JOIN utenti u ON u.id = c.utente_id
         WHERE p.workspace_id = ?
       )
       UNION ALL
       (
         SELECT CONCAT('ticket-', t.id), 'ticket',
                CONCAT(uc.nome, ' ha creato #TK-', t.id, ' "', LEFT(t.titolo, 50), '"'),
                t.id, t.titolo, t.created_at
         FROM ticket t
         JOIN progetti p ON p.id = t.progetto_id
         JOIN utenti uc ON uc.id = t.creato_da
         WHERE p.workspace_id = ?
       )
       ORDER BY tempo DESC
       LIMIT 10`,
      [wsId, wsId]
    );

    return res.json({ attivita: righe });
  } catch (err) {
    console.error('GET attivita:', err);
    return res.status(500).json({ errore: 'Errore interno del server' });
  }
});

export default router;
