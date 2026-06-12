const mysql = require('mysql2/promise');

const pool = mysql.createPool(process.env.MYSQL_URL);

pool.getConnection()
  .then(conn => {
    console.log('[DB] Connected successfully');
    conn.release();
  })
  .catch(err => {
    console.error('[DB] Connection failed:', err.message);
    process.exit(1);
  });

module.exports = pool;