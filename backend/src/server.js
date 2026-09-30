import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import authRouter from './routes/auth.js';
import workspaceRouter from './routes/workspace.js';
import dashboardRouter from './routes/dashboard.js';
import progettiRouter from './routes/progetti.js';
import ticketRouter from './routes/ticket.js';
import commentiRouter from './routes/commenti.js';
import notificheRouter from './routes/notifiche.js';
import { configuraSocket } from './socket/events.js';

dotenv.config();

const app = express();
const server = http.createServer(app);

// Origini consentite al CORS: lista separata da virgole, es.
// "https://mio-progetto.vercel.app,http://localhost:5173"
const originiCORS = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

// Socket.io con CORS limitato al frontend (Vite in dev / dominio Vercel in prod)
const io = new Server(server, {
  cors: {
    origin: originiCORS,
    credentials: true
  }
});
app.set('io', io); // accessibile nelle route via req.app.get('io')
configuraSocket(io);

// --- Sicurezza ---
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(
  cors({
    origin: originiCORS, // multiple origini ammesse (dev + produzione)
    credentials: true // necessario per il cookie httpOnly del refresh token
  })
);
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));

// Health check PUBBLICO — va registrato prima dei router con auth globale
app.get('/api/health', (_req, res) => res.json({ ok: true, servizio: 'devboard' }));

// Rate limit globale sulle API (il login ha un limite più stretto proprio)
app.use(
  '/api',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    standardHeaders: true,
    legacyHeaders: false,
    message: { errore: 'Troppe richieste, riprova più tardi' }
  })
);

// --- Rotte REST ---
// Ordine importante: /api/auth prima (login/register non richiedono token)
app.use('/api/auth', authRouter);
app.use('/api/workspace', workspaceRouter); // CRUD workspace + membri
app.use('/api/workspace', dashboardRouter); // stats + attività (dashboard)
app.use('/api', progettiRouter); // /workspace/:id/progetti e /progetti/:id
app.use('/api', ticketRouter); // /progetti/:id/ticket e /ticket/:id...
app.use('/api', commentiRouter); // /ticket/:id/commenti e /commenti/:id
app.use('/api/notifiche', notificheRouter);

// 404 su route API inesistenti
app.use('/api', (_req, res) => res.status(404).json({ errore: 'Endpoint non trovato' }));

// Gestione errori centralizzata
app.use((err, _req, res, _next) => {
  console.error('Errore non gestito:', err);
  res.status(500).json({ errore: 'Errore interno del server' });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`🚀 DevBoard API in ascolto su http://localhost:${PORT}`);
  console.log(`🔌 Socket.io pronto (origin: ${process.env.CLIENT_ORIGIN || 'http://localhost:5173'})`);
});
