console.log("DB ENV:", {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  db: process.env.DB_NAME,
});
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
});
pool.getConnection()
  .then(conn => {
    console.log('[DB] MySQL pool connected successfully');
    conn.release();
  })
  .catch(err => {
    console.error('[DB] Failed to connect:', err.message);
  });

module.exports = pool;