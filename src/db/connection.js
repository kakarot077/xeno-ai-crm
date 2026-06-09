'use strict';

require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host:               process.env.DB_HOST     || 'localhost',
  port:               parseInt(process.env.DB_PORT || '3306', 10),
  user:               process.env.DB_USER     || 'root',
  password:           process.env.DB_PASSWORD || '',
  database:           process.env.DB_NAME     || 'crm_db',
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
  timezone:           '+00:00',
  dateStrings:        true,   // return DATE columns as 'YYYY-MM-DD' strings
});

// Verify connectivity on startup
pool.getConnection()
  .then(conn => {
    console.log('[DB] MySQL pool connected successfully');
    conn.release();
  })
  .catch(err => {
    console.error('[DB] Failed to connect to MySQL:', err.message);
    process.exit(1);
  });

module.exports = pool;
