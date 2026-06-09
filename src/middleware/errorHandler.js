'use strict';

/**
 * errorHandler.js
 * Central error middleware — always returns a uniform JSON shape.
 * Must be registered LAST in Express (after all routes).
 */

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const status  = err.status || err.statusCode || 500;
  const message = err.message || 'Internal server error';

  if (process.env.NODE_ENV !== 'production') {
    console.error(`[error] ${req.method} ${req.path} →`, err);
  }

  res.status(status).json({ error: message });
}

module.exports = errorHandler;
