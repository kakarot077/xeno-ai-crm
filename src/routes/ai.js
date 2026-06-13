'use strict';

const express = require('express');
const router = express.Router();

router.post('/generate-message', async (req, res) => {
  try {
    const { goal, segmentName } = req.body;

    const cleanGoal = (goal || '').toLowerCase();

    const intros = {
      repeat: "We’d love to see you again!",
      inactive: "It’s been a while — we miss you!",
      vip: "Exclusive VIP access just for you!",
      default: "Special offer just for you!",
    };

    let toneKey = 'default';

    if (cleanGoal.includes('repeat')) toneKey = 'repeat';
    else if (cleanGoal.includes('inactive')) toneKey = 'inactive';
    else if (cleanGoal.includes('vip')) toneKey = 'vip';

    const intro = intros[toneKey];

    const templates = [
      `Hi ${segmentName}! ${intro} Enjoy a limited-time reward curated just for you.`,
      `Hello ${segmentName}, ${intro} Grab your exclusive offer before it expires.`,
      `Hey ${segmentName}! ${intro} Unlock your special deal today.`,
      `${intro} Hey ${segmentName}, don’t miss your personalized offer waiting inside.`,
    ];

    const message = templates[Math.floor(Math.random() * templates.length)];

    res.json({ message });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;