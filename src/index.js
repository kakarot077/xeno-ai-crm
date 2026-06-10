'use strict';

require('dotenv').config();

const express      = require('express');
const cors         = require('cors');
const errorHandler = require('./middleware/errorHandler');

// Route modules
const customersRouter = require('./routes/customers');
const campaignRoutes = require('./routes/campaigns');

// ─────────────────────────────────────────
const app  = express();
const PORT = parseInt(process.env.PORT || '4000', 10);

// ─────────────────────────────────────────
// Global middleware
// ─────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ─────────────────────────────────────────
// Health check
// ─────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─────────────────────────────────────────
// API routes — Phase 1
// ─────────────────────────────────────────
app.use('/customers', customersRouter);
app.use('/campaigns', campaignRoutes);

// ─────────────────────────────────────────
// 404 catch-all
// ─────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// ─────────────────────────────────────────
// Central error handler (must be last)
// ─────────────────────────────────────────
app.use(errorHandler);

// ─────────────────────────────────────────
// Start
// ─────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[server] CRM backend running on http://localhost:${PORT}`);
  console.log(`[server] Health: http://localhost:${PORT}/health`);
  console.log(`[server] Customers: http://localhost:${PORT}/customers`);
});

module.exports = app;
