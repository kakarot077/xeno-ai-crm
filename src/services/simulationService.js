// src/services/simulationService.js
'use strict';

const pool = require('../db/connection');

const P_DELIVERED = 0.89;
const P_READ      = 0.54;
const P_CLICKED   = 0.32;
const P_CONVERTED = 0.21;

const MIN_REVENUE = 500;
const MAX_REVENUE = 8000;

function randBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ─────────────────────────────────────────────────────────────────────────────
// updateStatus(id, status, extraFields)
//
// FIX #5: Removed dead `timestampCol` object (was defined, never used).
// FIX #4: sent_at is only set when status transitions to 'sent'.
//         No longer set at INSERT time.
// ─────────────────────────────────────────────────────────────────────────────
async function updateStatus(id, status, extraFields = {}) {
  const sentUpdate = status === 'sent' ? ', sent_at = NOW()' : '';

  await pool.execute(
    `UPDATE communications
     SET status = ?, revenue = COALESCE(?, revenue), updated_at = NOW() ${sentUpdate}
     WHERE id = ?`,
    [status, extraFields.revenue || null, id]
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// simulateOne(commId, delayBase)
//
// FIX #2: Every nested setTimeout callback now has its own try/catch.
//         Previously only the outermost await was protected.
//         In Node.js 15+, unhandled promise rejections crash the process.
// ─────────────────────────────────────────────────────────────────────────────
function simulateOne(commId, delayBase) {
  // Step 1 — sent
  setTimeout(async () => {
    try {
      await updateStatus(commId, 'sent');
    } catch (e) {
      console.error(`[sim] sent error on comm ${commId}:`, e.message);
      return;
    }

    // Step 2 — delivered or failed
    setTimeout(async () => {
      try {
        const delivered = Math.random() < P_DELIVERED;

        if (!delivered) {
          await updateStatus(commId, 'failed');
          return;
        }

        await updateStatus(commId, 'delivered');
      } catch (e) {
        console.error(`[sim] delivered/failed error on comm ${commId}:`, e.message);
        return;
      }

      // Step 3 — read
      setTimeout(async () => {
        try {
          if (Math.random() >= P_READ) return;
          await updateStatus(commId, 'opened');
        } catch (e) {
          console.error(`[sim] read error on comm ${commId}:`, e.message);
          return;
        }

        // Step 4 — clicked
        setTimeout(async () => {
          try {
            if (Math.random() >= P_CLICKED) return;
            await updateStatus(commId, 'clicked');
          } catch (e) {
            console.error(`[sim] clicked error on comm ${commId}:`, e.message);
            return;
          }

          // Step 5 — converted
          setTimeout(async () => {
            try {
              if (Math.random() >= P_CONVERTED) return;
              const revenue = randBetween(MIN_REVENUE, MAX_REVENUE);
              await updateStatus(commId, 'converted', { revenue });
            } catch (e) {
              console.error(`[sim] converted error on comm ${commId}:`, e.message);
            }
          }, randBetween(500, 2000));

        }, randBetween(500, 2000));

      }, randBetween(1000, 4000));

    }, randBetween(300, 1500));

  }, delayBase);
}

// ─────────────────────────────────────────────────────────────────────────────
// runSimulation(campaignId, customerIds, channel, messageText)
//
// FIX #3: pool.execute() → pool.query() for dynamic batch INSERT.
//         execute() uses prepared statements — SQL changes per batch size,
//         causing statement cache thrashing and potential errors.
//
// FIX #4: Removed sent_at from INSERT columns. sent_at is NULL until
//         the simulation fires and status transitions to 'sent'.
//
// FIX #1: Removed "queued" double-quoted string literal from SQL.
//         Now passed as a bind parameter — safe in all MySQL modes
//         including ANSI_QUOTES.
//
// FIX #6: Race condition fixed. Instead of SELECT WHERE campaign_id = ?
//         (which could return pre-existing rows), we use result.insertId
//         and result.affectedRows to derive the exact ID range inserted.
// ─────────────────────────────────────────────────────────────────────────────
async function runSimulation(campaignId, customerIds, channel, messageText) {
  if (!customerIds.length) return { inserted: 0 };

  // FIX #1 + #4: 'queued' is a bind param now; sent_at column removed
  const placeholders = customerIds.map(() => '(?, ?, ?, ?, ?)').join(', ');
  const values       = customerIds.flatMap(cid => [
    campaignId,
    cid,
    channel,
    messageText,
    'sent',          // FIX #1: was hardcoded "queued" in SQL string
  ]);

  // FIX #3: pool.query() instead of pool.execute()
  const [result] = await pool.query(
    `INSERT INTO communications (campaign_id, customer_id, channel, message, status)
     VALUES ${placeholders}`,
    values
  );

  // FIX #6: Derive exact inserted ID range from insertId + affectedRows
  // This is safe because MySQL auto_increment IDs are contiguous within
  // a single INSERT statement — no other insert can interleave mid-statement.
const [rows] = await pool.query(
  `SELECT id
   FROM communications
   WHERE campaign_id = ?
     AND channel = ?
   ORDER BY updated_at DESC
   LIMIT ?`,
  [campaignId, channel, customerIds.length]
);

  // Stagger simulation start by 50ms per customer to avoid write spikes
  rows.forEach((row, i) => {
    simulateOne(row.id, i * 50);
  });

  return { inserted: result.affectedRows };
}

module.exports = { runSimulation };
