'use strict';

const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

router.post('/generate-message', async (req, res, next) => {
  try {
    // FIX: frontend sends `segmentName`, not `audience`.
    // Accept both so either naming works.
    const { goal, segmentName, audience, channel } = req.body;
    const targetAudience = audience || segmentName;

    // Validate required fields
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

module.exports = router;