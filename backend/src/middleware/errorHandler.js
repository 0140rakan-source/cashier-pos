function errorHandler(err, req, res, _next) {
  const status = err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';
  // Sanitize message to avoid any non-JSON-safe characters
  const safeMessage = String(err.message || 'Internal server error').replace(/[\u0000-\u001F]/g, ' ');
  const response = {
    success: false,
    error: code,
    message: safeMessage,
  };
  // Only include stack in development, and sanitize it
  if (process.env.NODE_ENV === 'development' && err.stack) {
    response.stack = String(err.stack).replace(/[\u0000-\u001F]/g, ' ');
  }
  res.status(status).json(response);
}

function notFound(_req, res) {
  res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Route not found' });
}

module.exports = { errorHandler, notFound };
