// src/routes/campaigns.js
//
// Only URL → controller mapping lives here.
// Zero business logic, zero SQL.

'use strict';

const express = require('express');
const router  = express.Router();

const {
  createCampaign,
  listCampaigns,
  getCampaign,
  updateCampaignStatus,
} = require('../controllers/campaignController');

// POST   /campaigns            — create new campaign (status: draft)
// GET    /campaigns            — paginated list with live stats
// GET    /campaigns/:id        — single campaign + segment info + comms sample
// PATCH  /campaigns/:id/status — advance lifecycle: draft → active → completed

router.post  ('/',           createCampaign);
router.get   ('/',           listCampaigns);
router.get   ('/:id',        getCampaign);
router.patch ('/:id/status', updateCampaignStatus);

module.exports = router;
