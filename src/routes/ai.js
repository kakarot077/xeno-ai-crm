'use strict';

const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

router.post('/generate-message', async (req, res, next) => {
  try {
    const { goal, segmentName, audience, channel } = req.body;
    const targetAudience = audience || segmentName;

    if (!goal || !targetAudience) {
      return res.status(400).json({
        error: 'Missing required fields: goal, segmentName'
      });
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `You are a D2C CRM expert. Write a short, personalized, high-conversion message.
Channel: ${channel || 'SMS'}
Goal: ${goal}
Target audience: ${targetAudience}
Return ONLY the message, no explanation or quotes.`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    res.json({ message: text.trim() });

  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /ai/generate-segment
//
// Converts a natural-language audience description into structured
// segment filters that match segmentService.js's FIELD_MAP / operators.
//
// Body: { description: string }
// Returns: { name, explanation, filters: [{ field, operator, value }] }
//
// FIELD_MAP whitelist (from segmentService.js) — Gemini is constrained
// to ONLY these fields/operators via the system prompt below, so the
// output is guaranteed compatible with buildWhereClause().
// ─────────────────────────────────────────────────────────────────────────────
router.post('/generate-segment', async (req, res, next) => {
  try {
    const { description } = req.body;

    if (!description || !description.trim()) {
      return res.status(400).json({ error: 'Missing required field: description' });
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `You are a CRM segmentation engine. Convert the marketer's natural-language
audience description into structured filter rules.

ONLY use these fields (exact names):
- ltv (number, customer lifetime value in ₹)
- order_count (integer, total orders placed)
- last_purchase_days (integer, days since last purchase)
- avg_order_value (number, average order value in ₹)
- engagement_score (number, 0-100)
- city (string, Indian city name)
- status (string: "active", "at-risk", or "churned")
- preferred_channel (string: "WhatsApp", "Email", "SMS", or "RCS")
- tags (array of strings, e.g. "fashion", "electronics", "premium", "loyal")

ONLY use these operators:
- gt, lt, gte, lte, eq, neq  (for numeric/string fields)
- in    (value must be an array — for city, status, preferred_channel)
- contains  (only for "tags" field — value is a single string)

Marketer's request: "${description}"

Return ONLY valid JSON, no markdown fences, no explanation:
{
  "name": "short segment name (max 5 words)",
  "explanation": "one sentence describing this audience",
  "filters": [
    { "field": "...", "operator": "...", "value": ... }
  ]
}`;

    const result = await model.generateContent(prompt);
    let text = result.response.text().trim();

    // Strip markdown code fences if Gemini adds them despite instructions
    text = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '');

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (parseErr) {
      return res.status(502).json({
        error: 'AI returned invalid JSON. Please rephrase your request and try again.',
      });
    }

    // Basic shape validation
    if (!parsed.filters || !Array.isArray(parsed.filters) || parsed.filters.length === 0) {
      return res.status(502).json({
        error: 'AI did not return any usable filters. Please rephrase your request.',
      });
    }

    res.json({
      name: parsed.name || 'AI Generated Segment',
      explanation: parsed.explanation || description,
      filters: parsed.filters,
    });

  } catch (err) {
    next(err);
  }
});

module.exports = router;