// src/services/segmentService.js
//
// Responsibility: Translate segment filter rules (JSON) into safe,
// parameterised SQL WHERE clauses that run against the customer_stats view.
//
// Why this is a service not a controller:
//   Both the segment controller (preview/save) and the campaign send
//   controller (fetching the audience list) need this logic.
//   One place to maintain, two callers.
//
// Filter rule shape (matches the frontend's applyFilters() contract):
//   { field: string, operator: string, value: any }
//
// Supported fields  → customer_stats column
//   ltv                ltv
//   order_count        order_count
//   last_purchase_days last_purchase_days
//   avg_order_value    avg_order_value
//   engagement_score   engagement_score
//   city               city
//   status             status
//   preferred_channel  preferred_channel
//   tags               tags  (JSON array — uses JSON_CONTAINS)
//
// Supported operators
//   gt, lt, gte, lte, eq, neq, in, contains, not_contains

'use strict';

const pool = require('../db/connection');

const FIELD_MAP = {
  ltv:                'ltv',
  order_count:        'order_count',
  last_purchase_days: 'last_purchase_days',
  avg_order_value:    'avg_order_value',
  engagement_score:   'engagement_score',
  city:               'city',
  status:             'status',
  preferred_channel:  'preferred_channel',
  tags:               'tags',
};

const NUMERIC_OPERATORS = {
  gt:  '>',
  lt:  '<',
  gte: '>=',
  lte: '<=',
  eq:  '=',
  neq: '!=',
};

// ─────────────────────────────────────────────────────────────────────────────
// buildWhereClause(filters)
//
// Returns { clause: string, values: array }
// Safe against SQL injection — all user values go through parameterised queries.
// Returns { clause: '1=1', values: [] } for empty filters (matches everyone).
// ─────────────────────────────────────────────────────────────────────────────
function buildWhereClause(filters) {
  if (!filters || !Array.isArray(filters) || filters.length === 0) {
    return { clause: '1=1', values: [] };
  }

  const parts  = [];
  const values = [];

  for (const rule of filters) {
    const { field, operator, value } = rule;

    const col = FIELD_MAP[field];
    if (!col) {
      console.warn(`[segmentService] Unknown filter field '${field}' — skipped`);
      continue;
    }

    // JSON array field: tags
    if (field === 'tags') {
      if (operator === 'contains') {
        parts.push(`JSON_CONTAINS(tags, ?)`);
        values.push(JSON.stringify(value));
      } else if (operator === 'not_contains') {
        parts.push(`NOT JSON_CONTAINS(tags, ?)`);
        values.push(JSON.stringify(value));
      }
      continue;
    }

    // IN operator — e.g. city IN ('Mumbai', 'Delhi')
    if (operator === 'in') {
      if (!Array.isArray(value) || value.length === 0) continue;
      const placeholders = value.map(() => '?').join(', ');
      parts.push(`${col} IN (${placeholders})`);
      values.push(...value);
      continue;
    }

    // Standard comparison
    const sqlOp = NUMERIC_OPERATORS[operator];
    if (!sqlOp) {
      console.warn(`[segmentService] Unknown operator '${operator}' — skipped`);
      continue;
    }

    parts.push(`${col} ${sqlOp} ?`);
    values.push(value);
  }

  return {
    clause: parts.length > 0 ? parts.join(' AND ') : '1=1',
    values,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// previewSegment(filters) → { count, sample }
// Used by POST /segments/preview. Returns count + top 10 customers.
// ─────────────────────────────────────────────────────────────────────────────
async function previewSegment(filters) {
  const { clause, values } = buildWhereClause(filters);

  const [[{ count }]] = await pool.query(
    `SELECT COUNT(*) AS count FROM customer_stats WHERE ${clause}`,
    values
  );

  const [sample] = await pool.query(
    `SELECT
       id,
       name,
       email,
       city,
       preferred_channel,
       status,
       CAST(ltv AS UNSIGNED)             AS ltv,
       order_count,
       CAST(avg_order_value AS UNSIGNED) AS avg_order_value,
       last_purchase_days,
       last_purchase,
       engagement_score,
       tags
     FROM customer_stats
     WHERE ${clause}
     ORDER BY ltv DESC
     LIMIT 10`,
    values
  );

  return { count, sample };
}

// ─────────────────────────────────────────────────────────────────────────────
// getAudienceIds(filters) → string[]
// Returns full list of matching customer IDs for campaign send.
// ─────────────────────────────────────────────────────────────────────────────
async function getAudienceIds(filters) {
  const { clause, values } = buildWhereClause(filters);
  const [rows] = await pool.query(
    `SELECT id FROM customer_stats WHERE ${clause}`,
    values
  );
  return rows.map(r => r.id);
}

// ─────────────────────────────────────────────────────────────────────────────
// getAudienceCount(filters) → number
// Lightweight count — used when saving a segment.
// ─────────────────────────────────────────────────────────────────────────────
async function getAudienceCount(filters) {
  const { clause, values } = buildWhereClause(filters);
  const [[{ count }]] = await pool.query(
    `SELECT COUNT(*) AS count FROM customer_stats WHERE ${clause}`,
    values
  );
  return count;
}

module.exports = { buildWhereClause, previewSegment, getAudienceIds, getAudienceCount };
