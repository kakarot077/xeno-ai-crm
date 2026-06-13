'use strict';

const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { getAudienceCount } = require('../services/segmentService');
const pool = require('../db/connection');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ─────────────────────────────────────────────────────────────────────────────
// POST /ai/generate-message
// (unchanged from before)
// ─────────────────────────────────────────────────────────────────────────────
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
// (unchanged from before)
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

    text = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '');

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (parseErr) {
      return res.status(502).json({
        error: 'AI returned invalid JSON. Please rephrase your request and try again.',
      });
    }

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

// ─────────────────────────────────────────────────────────────────────────────
// POST /ai/generate-campaign  ("AI Campaign Assistant")
//
// THE COMBINED FEATURE: one natural-language prompt → full campaign draft.
//
// Body: { prompt: string }
//   e.g. "run campaign for inactive users with 20% discount"
//
// Single Gemini call returns:
//   {
//     segment: { name, explanation, filters: [...] },
//     message: "...",
//     channel: "WhatsApp" | "Email" | "SMS" | "RCS",
//     goal: "..."
//   }
//
// Why ONE call instead of chaining generate-segment + generate-message?
//   - Half the latency, half the quota usage (important on free tier)
//   - The message can directly reference the segment's context
//     (e.g. "high-value inactive customers" → tone matches LTV)
//   - Channel selection is informed by the SAME reasoning as the
//     segment (e.g. premium customers → Email, young/fashion → WhatsApp)
//
// We do NOT auto-save the segment here — that decision belongs to the
// frontend/marketer. This endpoint returns a DRAFT. The marketer can
// review/edit before the frontend calls POST /segments and POST /campaigns.
// This matches the existing two-step pattern (generate → preview → save)
// already used by /ai/generate-segment, and avoids creating orphaned
// segments if the marketer abandons the flow.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/generate-campaign', async (req, res, next) => {
  try {
    const { prompt: userPrompt } = req.body;

    if (!userPrompt || !userPrompt.trim()) {
      return res.status(400).json({ error: 'Missing required field: prompt' });
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const systemPrompt = `You are an AI marketing strategist inside a D2C CRM platform.
A marketer gives you a one-line campaign brief. You design the full campaign:
the target audience (as structured filters), the message copy, and the best channel.

ONLY use these audience filter fields (exact names):
- ltv (number, customer lifetime value in ₹)
- order_count (integer, total orders placed)
- last_purchase_days (integer, days since last purchase)
- avg_order_value (number, average order value in ₹)
- engagement_score (number, 0-100)
- city (string, Indian city name)
- status (string: "active", "at-risk", or "churned")
- preferred_channel (string: "WhatsApp", "Email", "SMS", or "RCS")
- tags (array of strings, e.g. "fashion", "electronics", "premium", "loyal")

ONLY use these filter operators:
- gt, lt, gte, lte, eq, neq
- in    (value must be an array)
- contains  (only for "tags" — value is a single string)

For "inactive" interpret as last_purchase_days gt 30 (or higher if the brief
implies long inactivity). For "high value" use ltv gt 50000. Use your judgement
for ambiguous terms but stay within the allowed fields.

Channel must be exactly one of: "WhatsApp", "Email", "SMS", "RCS".
Pick based on the audience and message tone — e.g. premium/long-form → Email,
urgent/casual offers → WhatsApp or SMS, rich visual promos → RCS.

The message must:
- Use [Name] as a placeholder for the customer's name
- Mention any discount/offer from the brief explicitly
- Be under 200 characters
- Match the tone of the chosen channel (WhatsApp/SMS = casual + emoji okay,
  Email = slightly more formal, no emoji)

Marketer's brief: "${userPrompt}"

Return ONLY valid JSON, no markdown fences, no explanation:
{
  "segment": {
    "name": "short segment name (max 5 words)",
    "explanation": "one sentence describing this audience",
    "filters": [ { "field": "...", "operator": "...", "value": ... } ]
  },
  "message": "the campaign message text",
  "channel": "WhatsApp",
  "goal": "one sentence campaign goal/objective"
}`;

    const result = await model.generateContent(systemPrompt);
    let text = result.response.text().trim();

    text = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '');

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (parseErr) {
      return res.status(502).json({
        error: 'AI returned invalid JSON. Please rephrase your request and try again.',
      });
    }

    // ── Validate shape ──────────────────────────────────────────
    if (
      !parsed.segment || !Array.isArray(parsed.segment.filters) || parsed.segment.filters.length === 0 ||
      !parsed.message || !parsed.channel
    ) {
      return res.status(502).json({
        error: 'AI returned an incomplete campaign. Please rephrase your request.',
      });
    }

    const VALID_CHANNELS = ['WhatsApp', 'Email', 'SMS', 'RCS'];
    if (!VALID_CHANNELS.includes(parsed.channel)) {
      parsed.channel = 'WhatsApp'; // safe fallback
    }

    // ── Enrich with live audience count ─────────────────────────
    // Lets the frontend show "this segment matches 84 customers"
    // immediately, before the marketer saves anything.
    let audienceCount = 0;
    try {
      audienceCount = await getAudienceCount(parsed.segment.filters);
    } catch (e) {
      console.warn('[generate-campaign] audience count failed:', e.message);
    }

    res.json({
      segment: {
        name: parsed.segment.name || 'AI Generated Segment',
        explanation: parsed.segment.explanation || userPrompt,
        filters: parsed.segment.filters,
        audience_count: audienceCount,
      },
      message: parsed.message,
      channel: parsed.channel,
      goal: parsed.goal || userPrompt,
    });

  } catch (err) {
    next(err);
  }
});

module.exports = router;