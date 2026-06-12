const mysql = require('mysql2/promise');

const pool = mysql.createPool(process.env.MYSQL_URL);

pool.getConnection()
  .then(conn => {
    console.log('[DB] MySQL pool connected successfully');
    conn.release();
  })
  .catch(err => {
    console.error('[DB] Failed to connect:', err.message, err.code);
  });

module.exports = pool;