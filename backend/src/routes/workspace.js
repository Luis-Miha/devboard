import { Router } from 'express';
import { z } from 'zod';
import pool from '../config/database.js';
import { verificaToken } from '../middleware/auth.js';
import { requireRuolo, getRuoloInWorkspace } from '../middleware/ruolo.js';

const router = Router();
router.use(verificaToken); // tutte le route workspace richiedono autenticazione

const schemaWorkspace = z.object({
  nome: z.string().min(2).max(100),
  slug: z
    .string()
    .min(2)
    .max(100)
    .regex(/^[a-z0-9-]+/, 'Slug non valido (solo minuscole, numeri e trattini)')
    .optional()
});

const schemaInvito = z.object({
  email: z.string().email('Email non valida'),
  ruolo: z.enum(['admin', 'member']).default('member')
});

/** GET /api/workspace — workspace di cui l'utente è membro. */
router.get('/', async (req, res) => {
  try {
    const [righe] = await pool.query(
      `SELECT w.id, w.nome, w.slug, w.owner_id, w.created_at, wm.ruolo
       FROM workspace w
       JOIN workspace_members wm ON wm.workspace_id = w.id
       WHERE wm.utente_id = ?
       ORDER BY w.created_at ASC`,
      [req.user.id]
    );
    return res.json({ workspace: righe });
  } catch (err) {
    console.error('Errore GET /workspace:', err);
    return res.status(500).json({ errore: 'Errore interno del server' });
  }
});

/** POST /api/workspace — crea un nuovo workspace (il creatore diventa owner). */
router.post('/', async (req, res) => {
  try {
    const parsed = schemaWorkspace.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ errore: parsed.error.issues[0].message });
    }
    const nome = parsed.data.nome;
    const slug =
      parsed.data.slug ||
      `${nome.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}-${Date.now().toString(36)}`;

    const [dup] = await pool.query('SELECT id FROM workspace WHERE slug = ?', [slug]);
    if (dup.length > 0) return res.status(409).json({ errore: 'Slug già in uso' });

    const [result] = await pool.query(
      'INSERT INTO workspace (nome, slug, owner_id) VALUES (?, ?, ?)',
      [nome, slug, req.user.id]
    );
    await pool.query(
      'INSERT INTO workspace_members (workspace_id, utente_id, ruolo) VALUES (?, ?, ?)',
      [result.insertId, req.user.id, 'owner']
    );

    return res.status(201).json({
      workspace: { id: result.insertId, nome, slug, owner_id: req.user.id, ruolo: 'owner' }
    });
  } catch (err) {
    console.error('POST /workspace:', err);
    return res.status(500).json({ errore: 'Errore interno del server' });
  }
});

/** GET /api/workspace/:slug — dettaglio workspace + membri + progetti. */
router.get('/:slug', async (req, res) => {
  try {
    const [ws] = await pool.query(
      `SELECT w.* FROM workspace w
       JOIN workspace_members wm ON wm.workspace_id = w.id
       WHERE w.slug = ? AND wm.utente_id = ?`,
      [req.params.slug, req.user.id]
    );
    if (ws.length === 0) return res.status(404).json({ errore: 'Workspace non trovato' });

    const workspace = ws[0];

    const [membri] = await pool.query(
      `SELECT u.id, u.nome, u.email, u.avatar_url, wm.ruolo, wm.joined_at
       FROM workspace_members wm
       JOIN utenti u ON u.id = wm.utente_id
       WHERE wm.workspace_id = ?`,
      [workspace.id]
    );

    const [progetti] = await pool.query(
      'SELECT id, nome, descrizione, colore FROM progetti WHERE workspace_id = ? ORDER BY created_at ASC',
      [workspace.id]
    );

    return res.json({ workspace, membri, progetti });
  } catch (err) {
    console.error('GET /workspace/:slug:', err);
    return res.status(500).json({ errore: 'Errore interno del server' });
  }
});

/**
 * POST /api/workspace/:id/invita — aggiunge un membro esistente per email.
 * Solo admin/owner possono invitare.
 */
router.post('/:id/invita', requireRuolo(['owner', 'admin']), async (req, res) => {
  try {
    const parsed = schemaInvito.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ errore: parsed.error.issues[0].message });
    }
    const { email, ruolo } = parsed.data;
    const workspaceId = Number(req.params.id);

    const [utenti] = await pool.query(
      'SELECT id, nome, email, avatar_url FROM utenti WHERE email = ?',
      [email]
    );
    if (utenti.length === 0) {
      return res.status(404).json({ errore: 'Nessun utente registrato con questa email' });
    }
    const utente = utenti[0];

    const [giaMembro] = await pool.query(
      'SELECT id FROM workspace_members WHERE workspace_id = ? AND utente_id = ?',
      [workspaceId, utente.id]
    );
    if (giaMembro.length > 0) return res.status(409).json({ errore: 'Utente già membro' });

    await pool.query(
      'INSERT INTO workspace_members (workspace_id, utente_id, ruolo) VALUES (?, ?, ?)',
      [workspaceId, utente.id, ruolo]
    );

    return res.status(201).json({ membro: { ...utente, ruolo } });
  } catch (err) {
    console.error('POST /workspace/:id/invita:', err);
    return res.status(500).json({ errore: 'Errore interno del server' });
  }
});

/** DELETE /api/workspace/:id/membri/:userId — rimuove un membro (solo admin/owner). */
router.delete('/:id/membri/:userId', requireRuolo(['owner', 'admin']), async (req, res) => {
  try {
    const workspaceId = Number(req.params.id);
    const userId = Number(req.params.userId);

    // Non si può rimuovere il proprietario dello workspace
    const [ws] = await pool.query('SELECT owner_id FROM workspace WHERE id = ?', [workspaceId]);
    if (ws.length > 0 && ws[0].owner_id === userId) {
      return res.status(400).json({ errore: 'Non puoi rimuovere il proprietario dello workspace' });
    }

    await pool.query('DELETE FROM workspace_members WHERE workspace_id = ? AND utente_id = ?', [
      workspaceId,
      userId
    ]);
    return res.json({ ok: true });
  } catch (err) {
    console.error('DELETE membri:', err);
    return res.status(500).json({ errore: 'Errore interno del server' });
  }
});

/** GET /api/workspace/:id/membri — membri rapido (usato dal frontend). */
router.get('/:id/membri', async (req, res) => {
  try {
    const ruolo = await getRuoloInWorkspace(Number(req.params.id), req.user.id);
    if (!ruolo) return res.status(403).json({ errore: 'Non sei membro di questo workspace' });

    const [membri] = await pool.query(
      `SELECT u.id, u.nome, u.email, u.avatar_url, wm.ruolo
       FROM workspace_members wm JOIN utenti u ON u.id = wm.utente_id
       WHERE wm.workspace_id = ?`,
      [req.params.id]
    );
    return res.json({ membri });
  } catch (err) {
    console.error('GET membri:', err);
    return res.status(500).json({ errore: 'Errore interno del server' });
  }
});

export default router;

