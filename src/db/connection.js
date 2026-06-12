const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host:     process.env.DB_HOST,
  port:     Number(process.env.DB_PORT) || 3306,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Test connection on startup, but don't crash the process
pool.getConnection()
  .then(conn => {
    console.log('[DB] MySQL pool connected successfully');
    conn.release();
  })
  .catch(err => {
    console.error('[DB] Failed to connect:', err.message, err.code);
  });

module.exports = pool;