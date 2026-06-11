// src/routes/analytics.js
'use strict';

const express = require('express');
const router  = express.Router();
const { getCampaignStats, getSummary } = require('../controllers/analyticsController');

router.get('/summary',               getSummary);
router.get('/campaigns/:id/stats',   getCampaignStats);

module.exports = router;
