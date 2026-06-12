// src/controllers/segmentController.js
'use strict';

const pool = require('../db/connection');
const { previewSegment, getAudienceCount } = require('../services/segmentService');

function generateSegmentId() {
  return `SEG-${Date.now()}`;
}

function parseFilters(raw) {
  if (!raw) return [];
  return typeof raw === 'string' ? JSON.parse(raw) : raw;
}

// ── GET /segments ─────────────────────────────────────────────
const listSegments = async (req, res, next) => {
  try {
    const [segments] = await pool.query(
      `SELECT id, name, explanation, filters, color, created_at
       FROM segments
       ORDER BY created_at DESC`
    );

    const result = await Promise.all(
      segments.map(async (s) => {
        const filters = parseFilters(s.filters);
        const count = await getAudienceCount(filters);

        return {
          ...s,
          filters,
          count,
        };
      })
    );

    res.json({ segments: result });
  } catch (err) {
    next(err);
  }
};

// ── GET /segments/:id ─────────────────────────────────────────
const getSegment = async (req, res, next) => {
  try {
    const [[segment]] = await pool.query(
      `SELECT id, name, explanation, filters, color, created_at
       FROM segments WHERE id = ?`,
      [req.params.id]
    );

    if (!segment) {
      return res.status(404).json({ error: `Segment '${req.params.id}' not found` });
    }

    const filters = parseFilters(segment.filters);
    const { count, sample } = await previewSegment(filters);

    res.json({
      segment: { ...segment, filters },
      audience: { count, sample },
    });
  } catch (err) {
    next(err);
  }
};

// ── POST /segments ────────────────────────────────────────────
const createSegment = async (req, res, next) => {
  try {
    const { name, explanation, filters, color } = req.body;

    if (!name || !filters || !Array.isArray(filters)) {
      return res.status(400).json({
        error: 'name and filters (array) are required',
      });
    }

    const id    = generateSegmentId();
    const count = await getAudienceCount(filters);

    await pool.execute(
      `INSERT INTO segments (id, name, explanation, filters, color, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [
        id,
        name,
        explanation || null,
        JSON.stringify(filters),
        color || '#4F46E5',
      ]
    );

    const [[segment]] = await pool.query(
      `SELECT id, name, explanation, filters, color, created_at
       FROM segments WHERE id = ?`,
      [id]
    );

    res.status(201).json({
      segment: { ...segment, filters: parseFilters(segment.filters) },
      audience_count: count,
    });
  } catch (err) {
    next(err);
  }
};

// ── POST /segments/preview ────────────────────────────────────
// Does NOT save — just returns count + sample for the UI preview step.
const previewSegmentHandler = async (req, res, next) => {
  try {
    const { filters } = req.body;

    if (!filters || !Array.isArray(filters)) {
      return res.status(400).json({ error: 'filters must be an array' });
    }

    const { count, sample } = await previewSegment(filters);
    res.json({ count, sample });
  } catch (err) {
    next(err);
  }
};

module.exports = { listSegments, getSegment, createSegment, previewSegmentHandler };
