-- ============================================================
-- DevBoard — schema del database MySQL + dati demo
-- Eseguire: mysql -u root -p < database/schema.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS devboard;
USE devboard;

DROP TABLE IF EXISTS notifiche;
DROP TABLE IF EXISTS commenti;
DROP TABLE IF EXISTS ticket;
DROP TABLE IF EXISTS progetti;
DROP TABLE IF EXISTS workspace_members;
DROP TABLE IF EXISTS workspace;
DROP TABLE IF EXISTS utenti;

CREATE TABLE utenti (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  avatar_url VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE workspace (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  owner_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES utenti(id)
);

CREATE TABLE workspace_members (
  id INT AUTO_INCREMENT PRIMARY KEY,
  workspace_id INT NOT NULL,
  utente_id INT NOT NULL,
  ruolo ENUM('owner', 'admin', 'member') DEFAULT 'member',
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (workspace_id) REFERENCES workspace(id),
  FOREIGN KEY (utente_id) REFERENCES utenti(id)
);

CREATE TABLE progetti (
  id INT AUTO_INCREMENT PRIMARY KEY,
  workspace_id INT NOT NULL,
  nome VARCHAR(200) NOT NULL,
  descrizione TEXT,
  colore VARCHAR(7) DEFAULT '#3b82f6',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (workspace_id) REFERENCES workspace(id)
);

CREATE TABLE ticket (
  id INT AUTO_INCREMENT PRIMARY KEY,
  progetto_id INT NOT NULL,
  titolo VARCHAR(300) NOT NULL,
  descrizione TEXT,
  stato ENUM('backlog','todo','in_progress','in_review','done') DEFAULT 'todo',
  priorita ENUM('urgent','high','medium','low') DEFAULT 'medium',
  assegnato_a INT,
  creato_da INT NOT NULL,
  ordine INT DEFAULT 0,
  scadenza DATE,
  etichette JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (progetto_id) REFERENCES progetti(id),
  FOREIGN KEY (assegnato_a) REFERENCES utenti(id),
  FOREIGN KEY (creato_da) REFERENCES utenti(id)
);

CREATE TABLE commenti (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ticket_id INT NOT NULL,
  utente_id INT NOT NULL,
  testo TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ticket_id) REFERENCES ticket(id),
  FOREIGN KEY (utente_id) REFERENCES utenti(id)
);

CREATE TABLE notifiche (
  id INT AUTO_INCREMENT PRIMARY KEY,
  utente_id INT NOT NULL,
  tipo VARCHAR(50) NOT NULL,
  messaggio TEXT NOT NULL,
  ticket_id INT,
  letta BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (utente_id) REFERENCES utenti(id),
  FOREIGN KEY (ticket_id) REFERENCES ticket(id)
);

-- ============================================================
-- DATI DEMO
-- Utenti demo — password di tutti: Password123!
-- (hash bcrypt generato con bcryptjs, 10 salt rounds)
-- ============================================================
INSERT INTO utenti (nome, email, password, avatar_url) VALUES
('Mario Rossi',   'mario@devboard.it',   '$2a$10$.ZL77coj.kOsES7fJrdxf.XkY5gcbrR8DqJsI5zmZ9GUTqo4g9.De', 'https://i.pravatar.cc/64?img=12'),
('Giulia Bianchi','giulia@devboard.it',  '$2a$10$.ZL77coj.kOsES7fJrdxf.XkY5gcbrR8DqJsI5zmZ9GUTqo4g9.De', 'https://i.pravatar.cc/64?img=47'),
('Luigi Verdi',   'luigi@devboard.it',   '$2a$10$.ZL77coj.kOsES7fJrdxf.XkY5gcbrR8DqJsI5zmZ9GUTqo4g9.De', 'https://i.pravatar.cc/64?img=33');

INSERT INTO workspace (nome, slug, owner_id) VALUES
('Acme Digital', 'acme-digital', 1);

INSERT INTO workspace_members (workspace_id, utente_id, ruolo) VALUES
(1, 1, 'owner'),
(1, 2, 'admin'),
(1, 3, 'member');

INSERT INTO progetti (workspace_id, nome, descrizione, colore) VALUES
(1, 'Sito E-commerce', 'Rifacimento completo del negozio online: catalogo, carrello e checkout.', '#5b5bd6'),
(1, 'App Mobile Banking', 'App iOS/Android per la gestione dei conti correnti.', '#22c55e');

-- 10 ticket distribuiti tra le 5 colonne (2 progetti)
INSERT INTO ticket (progetto_id, titolo, descrizione, stato, priorita, assegnato_a, creato_da, ordine, scadenza, etichette) VALUES
(1, 'Integrare pagamento Stripe', 'Collegare Checkout Sessions di Stripe al flusso di acquisto con webhook per la conferma ordine.', 'todo', 'urgent', 1, 1, 0, '2026-10-10', '["backend","pagamenti"]'),
(1, 'Carrello: applicare coupon sconto', 'Campo codice sconto nel carrello con validazione server-side e applicazione automatica del totale.', 'todo', 'high', 2, 2, 1, '2026-10-05', '["frontend"]'),
(1, 'Implementare ricerca full-text', 'Indice FULLTEXT MySQL + interfaccia di ricerca con suggerimenti e filtri per categoria.', 'backlog', 'medium', 3, 1, 0, NULL, '["backend","ricerca"]'),
(1, 'Ottimizzare immagini prodotto', 'Passaggio a WebP lazy-loading e generazione thumbnail 400x400 per le schede prodotto.', 'backlog', 'low', NULL, 2, 1, NULL, '["performance"]'),
(1, 'Dashboard ordini admin', 'Tabella ordini con filtri per stato, ricerca cliente ed esportazione CSV.', 'in_progress', 'high', 1, 1, 0, '2026-10-02', '["frontend","admin"]'),
(1, 'Refactor API prodotti', 'Rifattorizzazione dei endpoint /api/prodotti: paginazione, cache e validazione zod.', 'in_progress', 'medium', 3, 3, 1, '2026-10-20', '["backend"]'),
(1, 'Setup progetto e CI', 'Inizializzazione repo, linting, pipeline GitHub Actions con test e deploy automatico.', 'done', 'medium', 1, 1, 0, '2026-09-20', '["devops"]'),
(2, 'Schermata login biometrico', 'Autenticazione con Face ID / impronta digitale oltre a email e password.', 'todo', 'medium', 2, 2, 0, '2026-10-12', '["mobile","auth"]'),
(2, 'Notifiche push transazioni', 'Push notification in tempo reale per prelievi, depositi e pagamenti riusciti.', 'in_review', 'urgent', 3, 1, 0, '2026-09-25', '["mobile","notifiche"]'),
(2, 'Design system palette', 'Definizione colori, tipografia e componenti base del design system mobile.', 'done', 'low', 2, 2, 0, '2026-09-18', '["design"]');

-- Commenti demo
INSERT INTO commenti (ticket_id, utente_id, testo) VALUES
(1, 2, 'Ho preparato il merchant account di test, possiamo partire con le chiavi sandbox.'),
(1, 1, 'Perfetto, aggiungo anche il webhook per gli ordini rimborsati.'),
(5, 3, 'La paginazione l''ho fatta con cursor-based, molto più stabile della OFFSET.'),
(9, 1, 'Manca solo il copy per la notifica di prelievo contanti, ve lo mando stasera.'),
(6, 2, 'Ricorda di aggiungere la validazione anche su PATCH, non solo su POST.');

-- Notifiche demo (per Mario e Giulia)
INSERT INTO notifiche (utente_id, tipo, messaggio, ticket_id, letta) VALUES
(1, 'commento', 'Giulia Bianchi ha commentato su #TK-1 "Integrare pagamento Stripe"', 1, FALSE),
(2, 'assegnazione', 'Mario Rossi ti ha assegnato #TK-8 "Schermata login biometrico"', 8, FALSE),
(1, 'commento', 'Luigi Verdi ha commentato su #TK-5 "Dashboard ordini admin"', 5, TRUE);

