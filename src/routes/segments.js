const express = require('express');
const router = express.Router();

const {
  listSegments,
  getSegment,
  createSegment,
  previewSegmentHandler,
} = require('../controllers/segmentController');

// IMPORTANT: preview route must come before /:id
router.get('/', listSegments);
router.post('/', createSegment);
router.post('/preview', previewSegmentHandler);
router.get('/:id', getSegment);

module.exports = router;