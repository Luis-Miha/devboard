import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Pool di connessioni MySQL.
 * Il pool gestisce il riuso delle connessioni ed evita di
 * aprire/chiudere una connessione per ogni singola query.
 */
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'devboard',
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_POOL_LIMIT) || 10,
  queueLimit: 0,
  charset: 'utf8mb4',
  timezone: 'Z'
});

// Verifica veloce della connessione all'avvio (non blocca il crash dell'intero processo)
pool
  .query('SELECT 1')
  .then(() => console.log('✅ MySQL connesso correttamente'))
  .catch((err) => console.error('❌ Errore MySQL:', err.message));

export default pool;
