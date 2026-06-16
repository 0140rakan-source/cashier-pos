const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const authService = require('../../services/auth.service');
const prisma = require('../../prisma');
const { authenticate } = require('../../middleware/auth');

const router = express.Router();

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'اسم المستخدم وكلمة المرور مطلوبان' });
    const result = await authService.login({ username, password });
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

// ─── POST /api/auth/pin ───────────────────────────────────────────────────────
router.post('/pin', async (req, res, next) => {
  try {
    const { pin } = req.body;
    if (!pin || !/^\d{4}$/.test(String(pin)))
      return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'PIN يجب أن يكون 4 أرقام' });
    const result = await authService.loginWithPin({ pin });
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await authService.getMe(req.user.userId);
    res.json({ success: true, data: user });
  } catch (err) { next(err); }
});

// ─── POST /api/auth/offline-activate ─────────────────────────────────────────
// Validates HMAC activation code, creates/updates license record
router.post('/offline-activate', async (req, res, next) => {
  try {
    const { requestCode, activationCode, deviceFingerprint } = req.body;
    if (!requestCode || !activationCode)
      return res.status(400).json({ success: false, message: 'requestCode و activationCode مطلوبان' });

    const ACTIVATION_SECRET = process.env.ACTIVATION_SECRET;
    if (!ACTIVATION_SECRET) {
      return res.status(500).json({ success: false, error: 'SERVER_MISCONFIGURED', message: 'Activation secret not configured on server' });
    }
    const cleanRequest = requestCode.toUpperCase().replace(/[^A-Z0-9-]/g, '').trim();

    // Compute expected code
    const expectedHex = crypto
      .createHmac('sha256', ACTIVATION_SECRET)
      .update(cleanRequest)
      .digest('hex')
      .slice(0, 16)
      .toUpperCase();
    const expectedFormatted = expectedHex.match(/.{1,4}/g).join('-');
    const cleanInput = activationCode.replace(/[^A-F0-9]/gi, '').toUpperCase();
    const cleanExpected = expectedFormatted.replace(/-/g, '');

    if (cleanInput !== cleanExpected)
      return res.status(403).json({ success: false, message: 'رمز التفعيل غير صحيح / Invalid activation code' });

    // Upsert license — idempotent for same request code
    const licenseKey = `OFFLINE-${cleanRequest.replace(/-/g, '').slice(0, 16)}`;
    await prisma.license.upsert({
      where: { key: licenseKey },
      update: { isActive: true, activatedAt: new Date(), deviceFingerprint: deviceFingerprint || cleanRequest },
      create: { key: licenseKey, isActive: true, activatedAt: new Date(), deviceFingerprint: deviceFingerprint || cleanRequest },
    });

    res.json({ success: true, message: 'تم التفعيل بنجاح / Activated successfully', data: { activated: true } });
  } catch (err) { next(err); }
});

// ─── POST /api/auth/activate — online license key activation ─────────────────
router.post('/activate', async (req, res, next) => {
  try {
    const { licenseKey, deviceFingerprint } = req.body;
    if (!licenseKey)
      return res.status(400).json({ success: false, message: 'licenseKey مطلوب' });

    const license = await prisma.license.findUnique({ where: { key: licenseKey } });
    if (!license)
      return res.status(404).json({ success: false, message: 'مفتاح الترخيص غير موجود' });

    // Already bound to a different device
    if (license.isActive && license.deviceFingerprint && license.deviceFingerprint !== deviceFingerprint)
      return res.status(403).json({ success: false, code: 'DEVICE_ALREADY_BOUND', message: 'هذا الترخيص مفعّل على جهاز آخر' });

    if (license.expiresAt && new Date() > new Date(license.expiresAt))
      return res.status(402).json({ success: false, code: 'LICENSE_EXPIRED', message: 'انتهت صلاحية الترخيص' });

    const updated = await prisma.license.update({
      where: { key: licenseKey },
      data: { isActive: true, activatedAt: new Date(), deviceFingerprint: deviceFingerprint || null },
    });

    res.json({ success: true, message: 'تم التفعيل بنجاح', data: { activated: true, expiresAt: updated.expiresAt } });
  } catch (err) { next(err); }
});

// ─── POST /api/auth/force-activate — transfer license (requires admin auth) ──
router.post('/force-activate', authenticate, async (req, res, next) => {
  try {
    // Only admins can force-transfer a license
    if (req.user.roleName !== 'ADMIN')
      return res.status(403).json({ success: false, message: 'هذه العملية تتطلب صلاحية المدير' });

    const { licenseKey, deviceFingerprint } = req.body;
    if (!licenseKey)
      return res.status(400).json({ success: false, message: 'licenseKey مطلوب' });

    const license = await prisma.license.findUnique({ where: { key: licenseKey } });
    if (!license)
      return res.status(404).json({ success: false, message: 'مفتاح الترخيص غير موجود' });

    const updated = await prisma.license.update({
      where: { key: licenseKey },
      data: { isActive: true, activatedAt: new Date(), deviceFingerprint: deviceFingerprint || null },
    });

    res.json({ success: true, message: 'تم نقل الترخيص بنجاح', data: { activated: true, expiresAt: updated.expiresAt } });
  } catch (err) { next(err); }
});

// ─── GET /api/auth/license-status ────────────────────────────────────────────
router.get('/license-status', authenticate, async (req, res, next) => {
  try {
    const { businessId } = req.user;
    let license = await prisma.license.findFirst({ where: { businessId, isActive: true } });
    if (!license) license = await prisma.license.findFirst({ where: { isActive: true } });
    if (!license) return res.json({ success: true, data: { activated: false } });

    const daysLeft = license.expiresAt
      ? Math.ceil((new Date(license.expiresAt) - new Date()) / 86400000)
      : null;

    res.json({ success: true, data: { activated: license.isActive, expiresAt: license.expiresAt, daysLeft } });
  } catch (err) { next(err); }
});

module.exports = router;
