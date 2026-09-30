import jwt from 'jsonwebtoken';

/**
 * Configurazione degli eventi Socket.io.
 *
 * Server emette (alla room del progetto):
 *   ticket:creato | ticket:aggiornato | ticket:spostato |
 *   ticket:eliminato | commento:nuovo
 * Server emette (alla room personale dell'utente):
 *   notifica:nuova
 *
 * Client emette:
 *   join:progetto { progettoId }  → entra nella room del progetto
 *   leave:progetto { progettoId } → esce dalla room
 *
 * Ogni connessione viene autenticata con l'access token JWT
 * (passato come `auth: { token }` dal client).
 */
export function configuraSocket(io) {
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Token mancante'));
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = Number(payload.sub);
      socket.nome = payload.nome;
      // Room personale: serve per le notifiche private (badge campanella)
      socket.join(`utente:${socket.userId}`);
      return next();
    } catch {
      return next(new Error('Token non valido'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`🟢 Connesso: ${socket.nome} (utente ${socket.userId})`);

    // Entra nella room del progetto → riceverà tutti gli eventi della board
    socket.on('join:progetto', (data) => {
      const progettoId = Number(data?.progettoId);
      if (!Number.isNaN(progettoId)) {
        socket.join(`progetto:${progettoId}`);
        console.log(`➡️ ${socket.nome} → room progetto:${progettoId}`);
      }
    });

    // Esce dalla room quando si naviga ad un'altra pagina
    socket.on('leave:progetto', (data) => {
      const progettoId = Number(data?.progettoId);
      if (!Number.isNaN(progettoId)) {
        socket.leave(`progetto:${progettoId}`);
        console.log(`⬅️ ${socket.nome} ← room progetto:${progettoId}`);
      }
    });

    socket.on('disconnect', () => {
      console.log(`🔴 Disconnesso: ${socket.nome}`);
    });
  });
}

/** Utility: invia una notifica privata a un singolo utente. */
export function notificaUtente(io, userId, payload) {
  io.to(`utente:${userId}`).emit('notifica:nuova', payload);
}
