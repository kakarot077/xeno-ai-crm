  'use strict';

const pool = require('../db/connection');

/**
 * GET /customers
 *
 * Query params:
 *   search  — partial match on name, email, city, phone
 *   status  — 'active' | 'at-risk' | 'churned' | 'all'  (default: 'all')
 *   page    — integer >= 1  (default: 1)
 *   limit   — integer 1–100 (default: 20)
 *
 * Reads from the customer_stats VIEW so LTV, order counts,
 * and recency are always live.
 */
async function listCustomers(req, res, next) {
  try {
    const search = (req.query.search || '').trim();
    const status = req.query.status  || 'all';
    const page   = Math.max(1, parseInt(req.query.page  || '1',  10));
    const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)));
    const offset = (page - 1) * limit;

    // Build WHERE clauses dynamically
    const conditions = [];
    const params     = [];

    if (status && status !== 'all') {
      conditions.push('status = ?');
      params.push(status);
    }

    if (search) {
      conditions.push('(name LIKE ? OR email LIKE ? OR city LIKE ? OR phone LIKE ?)');
      const like = `%${search}%`;
      params.push(like, like, like, like);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count query (no LIMIT)
    const countSql = `SELECT COUNT(*) AS total FROM customer_stats ${where}`;
    const [[{ total }]] = await pool.execute(countSql, params);

    // Data query
    const dataSql = `
      SELECT
        id,
        name,
        email,
        phone,
        city,
        preferred_channel   AS preferredChannel,
        engagement_score    AS engagementScore,
        status,
        join_date           AS joinDate,
        tags,
        ROUND(ltv, 2)               AS ltv,
        order_count                 AS orderCount,
        ROUND(avg_order_value, 2)   AS avgOrderValue,
        last_purchase_days          AS lastPurchaseDays,
        last_purchase               AS lastPurchase
      FROM customer_stats
      ${where}
      ORDER BY ltv DESC
      LIMIT ? OFFSET ?
    `;

    const [rows] = await pool.query(
  dataSql,
  [...params, limit, offset]
);

    // Parse JSON tags field
    const customers = rows.map(row => ({
      ...row,
      tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : (row.tags || []),
    }));

    res.json({
      customers,
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /customers/:id
 * Returns a single customer with full stats.
 */
async function getCustomer(req, res, next) {
  try {
    const { id } = req.params;

    const [rows] = await pool.execute(
      `SELECT
         id,
         name,
         email,
         phone,
         city,
         preferred_channel   AS preferredChannel,
         engagement_score    AS engagementScore,
         status,
         join_date           AS joinDate,
         tags,
         ROUND(ltv, 2)               AS ltv,
         order_count                 AS orderCount,
         ROUND(avg_order_value, 2)   AS avgOrderValue,
         last_purchase_days          AS lastPurchaseDays,
         last_purchase               AS lastPurchase
       FROM customer_stats
       WHERE id = ?`,
      [id],
    );

    if (!rows.length) {
      return res.status(404).json({ error: `Customer '${id}' not found` });
    }

    const customer = {
      ...rows[0],
      tags: typeof rows[0].tags === 'string'
        ? JSON.parse(rows[0].tags)
        : (rows[0].tags || []),
    };

    res.json({ customer });
  } catch (err) {
    next(err);
  }
}

module.exports = { listCustomers, getCustomer };
