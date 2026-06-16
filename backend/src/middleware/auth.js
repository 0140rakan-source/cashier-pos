const jwt = require('jsonwebtoken');
const config = require('../config');
const prisma = require('../prisma');

// ─── authenticate ─────────────────────────────────────────────────────────────
function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer '))
    return res.status(401).json({ success: false, error: 'UNAUTHORIZED', message: 'Missing token' });
  try {
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, config.jwt.secret);
    req.user = decoded;
    req.permissions = decoded.permissions || [];
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'INVALID_TOKEN', message: 'Invalid or expired token' });
  }
}

// ─── requirePermission ────────────────────────────────────────────────────────
function requirePermission(...perms) {
  return (req, res, next) => {
    const permissions = req.user?.permissions || [];
    // Admin bypasses all permission checks
    if (req.user?.roleName === 'ADMIN') return next();
    const has = perms.some(p => permissions.includes(p));
    if (!has)
      return res.status(403).json({ success: false, error: 'INSUFFICIENT_PERMISSIONS', message: `Requires: ${perms.join(' or ')}` });
    next();
  };
}

// ─── requireLicense ───────────────────────────────────────────────────────────
async function requireLicense(req, res, next) {
  try {
    const deviceFingerprint = req.headers['x-device-fingerprint'] || null;
    const { businessId } = req.user || {};

    // Check business-bound license first, then any active license
    let license = businessId
      ? await prisma.license.findFirst({ where: { businessId, isActive: true } })
      : null;
    if (!license)
      license = await prisma.license.findFirst({ where: { isActive: true } });

    if (!license)
      return res.status(402).json({ success: false, error: 'LICENSE_REQUIRED', message: 'التطبيق غير مفعّل. يرجى إدخال مفتاح التفعيل.' });

    if (license.expiresAt && new Date() > new Date(license.expiresAt))
      return res.status(402).json({ success: false, error: 'LICENSE_EXPIRED', message: 'انتهت صلاحية الترخيص. يرجى التجديد.' });

    // Device fingerprint check — only enforce if license was bound to a specific device
    // and the incoming fingerprint is known (not 'unknown' fallback)
    if (
      license.deviceFingerprint &&
      deviceFingerprint &&
      deviceFingerprint !== 'unknown' &&
      license.deviceFingerprint !== deviceFingerprint
    ) {
      return res.status(403).json({ success: false, error: 'DEVICE_MISMATCH', message: 'هذا الترخيص مفعّل على جهاز مختلف.' });
    }

    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { authenticate, requirePermission, requireLicense };
