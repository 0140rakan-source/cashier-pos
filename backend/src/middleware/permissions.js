const jwt = require('jsonwebtoken');
const config = require('../config');

/**
 * Authentication middleware - extracts user from JWT
 */
function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'UNAUTHORIZED', message: 'Missing token' });
  }
  try {
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, config.jwt.secret);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'INVALID_TOKEN', message: 'Invalid or expired token' });
  }
}

/**
 * Authorization middleware - checks if user has ANY of the required permissions
 */
function requirePermission(...perms) {
  return (req, res, next) => {
    const user = req.user;
    if (!user || !user.permissions) {
      return res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'No permissions assigned' });
    }
    const has = perms.some(p => user.permissions.includes(p));
    if (!has) {
      return res.status(403).json({
        success: false,
        error: 'INSUFFICIENT_PERMISSIONS',
        message: `Requires one of: ${perms.join(', ')}`,
      });
    }
    next();
  };
}

module.exports = { authenticate, requirePermission };