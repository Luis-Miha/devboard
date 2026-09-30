import jwt from 'jsonwebtoken';

/**
 * Middleware di autenticazione.
 * Expect: header `Authorization: Bearer <accessToken>`
 * Se valido, appende l'utente decodificato a req.user.
 */
export function verificaToken(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ errore: 'Token mancante' });
  }

  try {
    // Verifica firma + scadenza (15 minuti)
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.sub, nome: payload.nome, email: payload.email };
    return next();
  } catch {
    return res.status(401).json({ errore: 'Token non valido o scaduto' });
  }
}

/** Genera l'access token JWT (15 min). */
export function generaAccessToken(user) {
  return jwt.sign(
    { sub: user.id, nome: user.nome, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );
}

/** Genera il refresh token JWT (7 giorni) — conservato solo nel cookie httpOnly. */
export function generaRefreshToken(user) {
  return jwt.sign(
    { sub: user.id, tipo: 'refresh' },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );
}
