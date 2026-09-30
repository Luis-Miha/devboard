import pool from '../config/database.js';

/**
 * RBAC — Controllo dei ruoli all'interno di uno workspace.
 * Ruoli ammessi: 'owner' > 'admin' > 'member'
 *
 * Uso: router.delete('/:id', verificaToken, requireRuolo(paramsIdKey), ...)
 * La factory riceve il nome del parametro route che contiene l'id dello workspace
 * e restituisce un middleware che carica il ruolo dell'utente richiedente.
 */
export function requireRuolo(ruoliAmmessi = ['owner', 'admin']) {
  return async (req, res, next) => {
    try {
      const workspaceId =
        req.params.workspaceId || req.params.id || req.body?.workspace_id;
      if (!workspaceId) {
        return res.status(400).json({ errore: 'workspace_id mancante' });
      }

      const [righe] = await pool.query(
        'SELECT ruolo FROM workspace_members WHERE workspace_id = ? AND utente_id = ?',
        [workspaceId, req.user.id]
      );

      if (righe.length === 0) {
        return res.status(403).json({ errore: 'Non sei membro di questo workspace' });
      }

      const ruolo = righe[0].ruolo;
      if (!ruoliAmmessi.includes(ruolo)) {
        return res.status(403).json({ errore: 'Permessi insufficienti (ruolo richiesto: admin/owner)' });
      }

      req.ruolo = ruolo;
      return next();
    } catch (err) {
      console.error('Errore requireRuolo:', err);
      return res.status(500).json({ errore: 'Errore interno del server' });
    }
  };
}

/** Verifica (senza bloccare) che l'utente sia membro dello workspace del progetto. */
export async function getRuoloInWorkspace(workspaceId, userId) {
  const [righe] = await pool.query(
    'SELECT ruolo FROM workspace_members WHERE workspace_id = ? AND utente_id = ?',
    [workspaceId, userId]
  );
  return righe.length > 0 ? righe[0].ruolo : null;
}
