// src/controllers/analyticsController.js
'use strict';

const pool = require('../db/connection');

// ── GET /analytics/campaigns/:id/stats ───────────────────────
const getCampaignStats = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [[campaign]] = await pool.query(
      `SELECT id, name, channel, status, audience_count, created_at, sent_at
       FROM campaigns WHERE id = ?`,
      [id]
    );
    if (!campaign) return res.status(404).json({ error: `Campaign '${id}' not found` });

    const [[stats]] = await pool.query(
      `SELECT
         COUNT(*)                                                        AS total,
         SUM(status IN ('sent','delivered','opened','clicked','converted','failed')) AS sent,
         SUM(status IN ('delivered','opened','clicked','converted'))        AS delivered,
         SUM(status = 'failed')                                          AS failed,
         SUM(status IN ('opened','clicked','converted'))                   AS read_count,
         SUM(status IN ('clicked','converted'))                          AS clicked,
         SUM(status = 'converted')                                       AS converted,
         COALESCE(SUM(revenue), 0)                                       AS revenue
       FROM communications
       WHERE campaign_id = ?`,
      [id]
    );

    const sent      = Number(stats.sent)       || 0;
    const delivered = Number(stats.delivered)  || 0;
    const read      = Number(stats.read_count) || 0;
    const clicked   = Number(stats.clicked)    || 0;

    const rates = {
      delivery_rate:   sent      > 0 ? +((delivered / sent)      * 100).toFixed(1) : 0,
      open_rate:       delivered > 0 ? +((read      / delivered)  * 100).toFixed(1) : 0,
      click_rate:      read      > 0 ? +((clicked   / read)       * 100).toFixed(1) : 0,
      conversion_rate: clicked   > 0 ? +((Number(stats.converted) / clicked) * 100).toFixed(1) : 0,
    };

    const [breakdown] = await pool.query(
      `SELECT status, COUNT(*) AS count
       FROM communications
       WHERE campaign_id = ?
       GROUP BY status`,
      [id]
    );

    const [timeline] = await pool.query(
      `SELECT
         DATE_FORMAT(updated_at, '%Y-%m-%d %H:00') AS hour,
         status,
         COUNT(*) AS count
       FROM communications
       WHERE campaign_id = ?
         AND status != 'failed'
       GROUP BY hour, status
       ORDER BY hour ASC`,
      [id]
    );

    res.json({
      campaign,
      stats: {
        audience:  campaign.audience_count  || 0,
        sent,
        delivered,
        failed:    Number(stats.failed)     || 0,
        read,
        clicked,
        converted: Number(stats.converted)  || 0,
        revenue:   parseFloat(stats.revenue) || 0,
        ...rates,
      },
      breakdown,
      timeline,
    });
  } catch (err) {
    next(err);
  }
};

// ── GET /analytics/summary ────────────────────────────────────
// ── GET /analytics/summary ────────────────────────────────────
const getSummary = async (req, res, next) => {
  try {
    const [[totals]] = await pool.query(
      `SELECT
         COUNT(DISTINCT campaign_id)                                        AS total_campaigns,
         SUM(status IN ('sent','delivered','opened','clicked','converted')) AS total_sent,
         SUM(status IN ('delivered','opened','clicked','converted'))        AS total_delivered,
         SUM(status IN ('opened','clicked','converted'))                    AS total_opened,
         SUM(status IN ('clicked','converted'))                             AS total_clicked,
         SUM(status = 'converted')                                          AS total_converted,
         COALESCE(SUM(revenue), 0)                                          AS total_revenue
       FROM communications`
    );

    const [byChannel] = await pool.query(
      `SELECT
         channel,
         COUNT(*) AS sent,
         SUM(status IN ('delivered','opened','clicked','converted')) AS delivered,
         SUM(status IN ('opened','clicked','converted')) AS read_count,
         SUM(status = 'converted') AS converted,
         COALESCE(SUM(revenue), 0) AS revenue
       FROM communications
       GROUP BY channel`
    );

    const [daily] = await pool.query(
      `SELECT
         DATE(updated_at) AS date,
         SUM(status IN ('sent','delivered','opened','clicked','converted')) AS sent,
         SUM(status IN ('delivered','opened','clicked','converted')) AS delivered,
         SUM(status IN ('opened','clicked','converted')) AS read_count,
         SUM(status = 'converted') AS converted
       FROM communications
       WHERE updated_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
       GROUP BY DATE(updated_at)
       ORDER BY date ASC`
    );

    const [topCampaigns] = await pool.query(
      `SELECT
         c.id,
         c.name,
         c.channel,
         c.status,
         COALESCE(SUM(cm.revenue), 0) AS revenue,
         COUNT(cm.id) AS messages_sent,
         SUM(cm.status = 'converted') AS conversions
       FROM campaigns c
       LEFT JOIN communications cm ON cm.campaign_id = c.id
       GROUP BY c.id, c.name, c.channel, c.status
       ORDER BY revenue DESC
       LIMIT 5`
    );

    res.json({
      totals: {
        campaigns: Number(totals.total_campaigns) || 0,
        sent: Number(totals.total_sent) || 0,
        delivered: Number(totals.total_delivered) || 0,
        opened: Number(totals.total_opened) || 0,
        clicked: Number(totals.total_clicked) || 0,
        converted: Number(totals.total_converted) || 0,
        revenue: parseFloat(totals.total_revenue) || 0,
      },
      by_channel: byChannel,
      daily_trend: daily,
      top_campaigns: topCampaigns,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getCampaignStats, getSummary };
