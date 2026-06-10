// src/controllers/campaignController.js
//
// All campaign business logic lives here.
// Adapted to the REAL existing schema:
//
//   campaigns    : id VARCHAR(20), name, status, segment_id, channel,
//                  goal, content JSON, audience_count, created_at, sent_at
//   segments     : id VARCHAR(20), name, explanation, filters JSON,
//                  color, created_at
//   communications: id, campaign_id, customer_id, channel, message,
//                   status, revenue, sent_at, updated_at

'use strict';

const pool = require('../db/connection');

// ─── ID Generator ─────────────────────────────────────────────────────────────
// campaigns.id is VARCHAR(20) — not auto-increment.
// We generate "CMP-<timestamp>" which is:
//   • unique across concurrent requests (millisecond precision)
//   • human-readable in logs and Postman responses
//   • sortable chronologically

function generateCampaignId() {
  return `CMP-${Date.now()}`;
}

// ─── Stats Aggregator ─────────────────────────────────────────────────────────
// Reused by both GET /campaigns (list) and GET /campaigns/:id (detail).
// Maps the single `status` column into the full analytics funnel.
//
// Status lifecycle (from channel service spec):
//   queued → sent → delivered → read → clicked → converted
//                └→ failed
//
// Each downstream status implies all prior stages were reached,
// so we use IN (...) rather than = for cumulative counts.

const STATS_SUBQUERY = `
  SELECT
    campaign_id,
    COUNT(*)                                                        AS total,
    SUM(status IN ('sent','delivered','read','clicked','converted','failed')) AS sent,
    SUM(status IN ('delivered','read','clicked','converted'))        AS delivered,
    SUM(status = 'failed')                                          AS failed,
    SUM(status IN ('read','clicked','converted'))                   AS read_count,
    SUM(status IN ('clicked','converted'))                          AS clicked,
    SUM(status = 'converted')                                       AS converted,
    COALESCE(SUM(revenue), 0)                                       AS revenue
  FROM communications
  GROUP BY campaign_id
`;

// ─────────────────────────────────────────────────────────────────────────────
// POST /campaigns
//
// Creates a campaign in 'draft' status.
//
// Required body fields:
//   name          string
//   channel       'WhatsApp' | 'Email' | 'SMS' | 'RCS'
//   segment_id    string  (must exist in segments table)
//   content       object  (channel-specific message payload)
//
// Optional:
//   goal          string  (natural language — used by AI layer later)
// ─────────────────────────────────────────────────────────────────────────────
const createCampaign = async (req, res, next) => {
  try {
    const { name, channel, segment_id, content, goal } = req.body;

    // ── Validate required fields ───────────────────────────────
    const missing = ['name', 'channel', 'segment_id', 'content']
      .filter(f => !req.body[f]);

    if (missing.length) {
      return res.status(400).json({
        error: 'Missing required fields',
        missing,
      });
    }

    const validChannels = ['WhatsApp', 'Email', 'SMS', 'RCS'];
    if (!validChannels.includes(channel)) {
      return res.status(400).json({
        error: `Invalid channel. Allowed values: ${validChannels.join(', ')}`,
      });
    }

    if (typeof content !== 'object' || Array.isArray(content)) {
      return res.status(400).json({
        error: 'content must be a JSON object',
      });
    }

    // ── Verify segment exists ──────────────────────────────────
    // We also read audience_count so we can snapshot it onto the campaign.
    // If the segment rules change later, campaign.audience_count still
    // reflects the audience at the time of creation.
    const [[segment]] = await pool.query(
      `SELECT id, name, explanation, filters, color
       FROM segments
       WHERE id = ?`,
      [segment_id]
    );

    if (!segment) {
      return res.status(404).json({
        error: `Segment '${segment_id}' not found`,
      });
    }

    // ── Compute current audience size from customer_stats view ─
    // customer_stats is a view that joins customers + orders and
    // exposes ltv, order_count, last_purchase_days etc.
    // We apply the segment's saved filters to get a live count.
    const filters = segment.filters
      ? (typeof segment.filters === 'string' ? JSON.parse(segment.filters) : segment.filters)
      : [];

    const audienceCount = await countAudienceFromFilters(filters);

    // ── Insert ─────────────────────────────────────────────────
    const campaignId = generateCampaignId();

    await pool.execute(
      `INSERT INTO campaigns
         (id, name, status, segment_id, channel, goal, content, audience_count, created_at)
       VALUES
         (?,  ?,    'draft', ?,          ?,       ?,    ?,       ?,              NOW())`,
      [
        campaignId,
        name,
        segment_id,
        channel,
        goal   || null,
        JSON.stringify(content),
        audienceCount,
      ]
    );

    // ── Return the full created campaign ───────────────────────
    const [[campaign]] = await pool.query(
      `SELECT
         c.*,
         s.name        AS segment_name,
         s.explanation AS segment_explanation,
         s.filters     AS segment_filters,
         s.color       AS segment_color
       FROM campaigns c
       JOIN segments s ON c.segment_id = s.id
       WHERE c.id = ?`,
      [campaignId]
    );

    return res.status(201).json({
      campaign: normalizeCampaign(campaign),
    });

  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /campaigns
//
// Paginated list with live stats aggregated from communications.
//
// Query params:
//   page     number  (default 1)
//   limit    number  (default 10, max 50)
//   status   string  filter by campaign status
//   channel  string  filter by channel
// ─────────────────────────────────────────────────────────────────────────────
const listCampaigns = async (req, res, next) => {
  try {
    const page    = Math.max(1, parseInt(req.query.page)  || 1);
    const limit   = Math.min(50, parseInt(req.query.limit) || 10);
    const offset  = (page - 1) * limit;

    // Build WHERE dynamically — only filter on columns that were passed
    const conditions = [];
    const params     = [];

    if (req.query.status) {
      conditions.push('c.status = ?');
      params.push(req.query.status);
    }
    if (req.query.channel) {
      conditions.push('c.channel = ?');
      params.push(req.query.channel);
    }

    const WHERE = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count total rows matching filters (for pagination meta)
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM campaigns c ${WHERE}`,
      params
    );

    // Fetch the page — LEFT JOIN stats subquery so campaigns with
    // zero communications still appear (with 0 for all stats).
    const [rows] = await pool.query(
      `SELECT
         c.id,
         c.name,
         c.status,
         c.channel,
         c.goal,
         c.audience_count,
         c.created_at,
         c.sent_at,
         s.id          AS segment_id,
         s.name        AS segment_name,
         s.color       AS segment_color,

         COALESCE(st.total,      0) AS total_messages,
         COALESCE(st.sent,       0) AS sent,
         COALESCE(st.delivered,  0) AS delivered,
         COALESCE(st.failed,     0) AS failed,
         COALESCE(st.read_count, 0) AS read_count,
         COALESCE(st.clicked,    0) AS clicked,
         COALESCE(st.converted,  0) AS converted,
         COALESCE(st.revenue,    0) AS revenue,

         -- Pre-compute rates here so frontend doesn't divide by zero
         CASE WHEN COALESCE(st.sent,      0) > 0
              THEN ROUND(st.delivered  / st.sent      * 100, 1) ELSE 0 END AS delivery_rate,
         CASE WHEN COALESCE(st.delivered, 0) > 0
              THEN ROUND(st.read_count / st.delivered * 100, 1) ELSE 0 END AS open_rate,
         CASE WHEN COALESCE(st.read_count,0) > 0
              THEN ROUND(st.clicked    / st.read_count * 100, 1) ELSE 0 END AS click_rate,
         CASE WHEN COALESCE(st.clicked,   0) > 0
              THEN ROUND(st.converted  / st.clicked   * 100, 1) ELSE 0 END AS conversion_rate

       FROM campaigns c
       JOIN segments  s  ON c.segment_id = s.id
       LEFT JOIN (${STATS_SUBQUERY}) st ON st.campaign_id = c.id
       ${WHERE}
       ORDER BY c.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return res.json({
      campaigns: rows,
      pagination: {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
      },
    });

  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /campaigns/:id
//
// Full campaign detail including:
//   - Segment info (name, explanation, filters, color)
//   - Aggregated stats
//   - Last 20 individual communication rows (for per-customer status panel)
// ─────────────────────────────────────────────────────────────────────────────
const getCampaign = async (req, res, next) => {
  try {
    const { id } = req.params;

    // ── Main campaign row + stats ──────────────────────────────
    const [[campaign]] = await pool.query(
      `SELECT
         c.*,
         s.id          AS segment_id,
         s.name        AS segment_name,
         s.explanation AS segment_explanation,
         s.filters     AS segment_filters,
         s.color       AS segment_color,

         COALESCE(st.total,      0) AS total_messages,
         COALESCE(st.sent,       0) AS sent,
         COALESCE(st.delivered,  0) AS delivered,
         COALESCE(st.failed,     0) AS failed,
         COALESCE(st.read_count, 0) AS read_count,
         COALESCE(st.clicked,    0) AS clicked,
         COALESCE(st.converted,  0) AS converted,
         COALESCE(st.revenue,    0) AS revenue

       FROM campaigns c
       JOIN segments  s  ON c.segment_id = s.id
       LEFT JOIN (${STATS_SUBQUERY}) st ON st.campaign_id = c.id
       WHERE c.id = ?`,
      [id]
    );

    if (!campaign) {
      return res.status(404).json({ error: `Campaign '${id}' not found` });
    }

    // ── Last 20 individual communications ─────────────────────
    // Joins customers so the UI can show "Priya Sharma — delivered"
    // instead of just a customer_id.
    const [communications] = await pool.query(
      `SELECT
         cm.id,
         cm.customer_id,
         cu.name    AS customer_name,
         cu.email   AS customer_email,
         cu.city    AS customer_city,
         cm.channel,
         cm.status,
         cm.revenue,
         cm.sent_at,
         cm.updated_at
       FROM communications cm
       JOIN customers cu ON cm.customer_id = cu.id
       WHERE cm.campaign_id = ?
       ORDER BY cm.updated_at DESC
       LIMIT 20`,
      [id]
    );

    return res.json({
      campaign: normalizeCampaign(campaign),
      communications,
    });

  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /campaigns/:id/status
//
// Moves a campaign through its lifecycle.
// Enforces forward-only progression to prevent data corruption
// (e.g. marking a completed campaign as draft would make stats misleading).
//
// Valid statuses and their intended transitions:
//   draft → active → completed
//            └→ failed  (from any state)
// ─────────────────────────────────────────────────────────────────────────────
const updateCampaignStatus = async (req, res, next) => {
  try {
    const { id }     = req.params;
    const { status } = req.body;

    const VALID_STATUSES = ['draft', 'active', 'completed', 'failed'];
    if (!status || !VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        error: `Invalid status. Allowed: ${VALID_STATUSES.join(', ')}`,
      });
    }

    // Fetch current campaign
    const [[existing]] = await pool.query(
      'SELECT id, name, status FROM campaigns WHERE id = ?',
      [id]
    );

    if (!existing) {
      return res.status(404).json({ error: `Campaign '${id}' not found` });
    }

    // Enforce forward-only progression
    const ORDER = ['draft', 'active', 'completed', 'failed'];
    const currentIdx = ORDER.indexOf(existing.status);
    const newIdx     = ORDER.indexOf(status);

    if (status !== 'failed' && newIdx < currentIdx) {
      return res.status(400).json({
        error: `Cannot move campaign from '${existing.status}' back to '${status}'`,
        current_status: existing.status,
        requested_status: status,
      });
    }

    // If transitioning to active, record sent_at
    const setSentAt = status === 'active' ? ', sent_at = NOW()' : '';

    await pool.execute(
      `UPDATE campaigns SET status = ? ${setSentAt} WHERE id = ?`,
      [status, id]
    );

    const [[updated]] = await pool.query(
      'SELECT id, name, status, sent_at, updated_at FROM campaigns WHERE id = ?',
      [id]
    );

    return res.json({
      message: `Campaign status updated to '${status}'`,
      campaign: updated,
    });

  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL: countAudienceFromFilters
//
// Translates the segment's filters JSON array into a SQL WHERE clause
// and counts matching rows from the customer_stats view.
//
// This is a simplified version — the full segmentService.js will expand
// this with all supported operators and fields.
//
// Supported operators: gt, lt, gte, lte, eq, contains (JSON array field)
// ─────────────────────────────────────────────────────────────────────────────
async function countAudienceFromFilters(filters) {
  if (!filters || filters.length === 0) {
    const [[{ count }]] = await pool.query(
      'SELECT COUNT(*) AS count FROM customer_stats'
    );
    return count;
  }

  const clauses = [];
  const values  = [];

  // Map filter field names → actual column names in customer_stats view
  const FIELD_MAP = {
    ltv:                'ltv',
    order_count:        'order_count',
    last_purchase_days: 'last_purchase_days',
    avg_order_value:    'avg_order_value',
    city:               'city',
    status:             'status',
    preferred_channel:  'preferred_channel',
    engagement_score:   'engagement_score',
    tags:               'tags',   // JSON column — handled separately
  };

  const OPERATOR_MAP = {
    gt:  '>',
    lt:  '<',
    gte: '>=',
    lte: '<=',
    eq:  '=',
  };

  for (const filter of filters) {
    const { field, operator, value } = filter;

    const col = FIELD_MAP[field];
    if (!col) continue;  // skip unknown fields gracefully

    if (field === 'tags' && operator === 'contains') {
      // MySQL JSON_CONTAINS for array membership check
      clauses.push(`JSON_CONTAINS(tags, ?)`);
      values.push(JSON.stringify(value));
      continue;
    }

    const sqlOp = OPERATOR_MAP[operator];
    if (!sqlOp) continue;

    clauses.push(`${col} ${sqlOp} ?`);
    values.push(value);
  }

  if (clauses.length === 0) {
    const [[{ count }]] = await pool.query(
      'SELECT COUNT(*) AS count FROM customer_stats'
    );
    return count;
  }

  const [[{ count }]] = await pool.query(
    `SELECT COUNT(*) AS count FROM customer_stats WHERE ${clauses.join(' AND ')}`,
    values
  );

  return count;
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL: normalizeCampaign
//
// MySQL returns JSON columns as strings.
// This ensures content and segment_filters are always parsed objects
// before sending to the client — no JSON.parse() calls needed in the frontend.
// ─────────────────────────────────────────────────────────────────────────────
function normalizeCampaign(row) {
  if (!row) return null;
  return {
    ...row,
    content: row.content
      ? (typeof row.content === 'string' ? JSON.parse(row.content) : row.content)
      : null,
    segment_filters: row.segment_filters
      ? (typeof row.segment_filters === 'string' ? JSON.parse(row.segment_filters) : row.segment_filters)
      : [],
  };
}

module.exports = {
  createCampaign,
  listCampaigns,
  getCampaign,
  updateCampaignStatus,
};
