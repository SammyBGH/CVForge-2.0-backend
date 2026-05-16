import { logger } from '../utils/logger.js';

export function notFoundHandler(req, res) {
  res.status(404).json({ error: 'Not found', path: req.originalUrl });
}

export function errorHandler(err, req, res, next) {
  // eslint-disable-next-line no-unused-vars
  const _next = next;
  logger.error(err.message, err.stack);
  const status = err.status || err.statusCode || 500;
  const message = status === 500 && process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message;
  res.status(status).json({ error: message, details: err.details });
}
