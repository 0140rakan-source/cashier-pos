const express = require('express');
const path = require('path');
const fs = require('fs');
const { authenticate, requirePermission } = require('../../middleware/auth');
const prisma = require('../../prisma');

const router = express.Router();
router.use(authenticate);

// Settings — admin only (NOT cashier)
const viewPerm = requirePermission('settings.view');
const editPerm = requirePermission('settings.edit');

// Business fields that live in the `business` table
const BUSINESS_FIELDS = ['nameAr', 'nameEn', 'addressAr', 'addressEn', 'phone', 'email', 'vatNumber', 'crNumber', 'logo'];
const SETTINGS_JSON_FIELDS = ['orderChannels']; // fields stored as JSON

// GET /api/settings
router.get('/', viewPerm, async (req, res, next) => {
  try {
    const { businessId } = req.user;
    const settings = await prisma.settings.findUnique({ where: { businessId } });
    const business = await prisma.business.findUnique({ where: { id: businessId } });

    // Merge business fields into settings response
    const merged = {
      ...settings,
      nameAr: business?.nameAr,
      nameEn: business?.nameEn,
      addressAr: business?.addressAr,
      addressEn: business?.addressEn,
      phone: business?.phone,
      email: business?.email,
      vatNumber: business?.vatNumber,
      crNumber: business?.crNumber,
      logo: business?.logo,
    };
    // Parse JSON string fields for SQLite compat
    if (typeof merged.orderChannels === 'string') {
      try { merged.orderChannels = JSON.parse(merged.orderChannels); } catch (_) {}
    }

    res.json({ success: true, data: merged });
  } catch (err) { next(err); }
});

// PUT /api/settings
router.put('/', editPerm, async (req, res, next) => {
  try {
    const { businessId } = req.user;
    const body = { ...req.body };

    // Split business fields from settings fields
    const businessUpdate = {};
    const settingsUpdate = {};

    for (const key of Object.keys(body)) {
      if (BUSINESS_FIELDS.includes(key)) {
        businessUpdate[key] = body[key];
      } else {
        settingsUpdate[key] = body[key];
      }
    }

    // Update business table if needed
    if (Object.keys(businessUpdate).length > 0) {
      await prisma.business.update({ where: { id: businessId }, data: businessUpdate });
    }

    // Update settings table
    const settings = await prisma.settings.upsert({
      where: { businessId },
      create: { businessId, ...settingsUpdate },
      update: settingsUpdate,
    });

    // Return merged
    const business = await prisma.business.findUnique({ where: { id: businessId } });
    res.json({
      success: true,
      data: {
        ...settings,
        nameAr: business?.nameAr,
        nameEn: business?.nameEn,
        addressAr: business?.addressAr,
        addressEn: business?.addressEn,
        phone: business?.phone,
        email: business?.email,
        vatNumber: business?.vatNumber,
        crNumber: business?.crNumber,
        logo: business?.logo,
      },
    });
  } catch (err) { next(err); }
});

// GET /api/settings/channels — order channels (accessible by all authenticated users incl cashier)
router.get('/channels', async (req, res, next) => {
  try {
    const { businessId } = req.user;
    const settings = await prisma.settings.findUnique({ where: { businessId }, select: { orderChannels: true } });
    const raw = settings?.orderChannels;
    const channels = (typeof raw === 'string' ? JSON.parse(raw) : raw) || [
      { key: 'DIRECT', label: 'مباشر', enabled: true, defaultPayment: 'CASH' },
    ];
    // Only return enabled channels
    const enabled = channels.filter(c => c.enabled !== false);
    res.json({ success: true, data: enabled });
  } catch (err) { next(err); }
});

// PUT /api/settings/channels — admin update order channels
router.put('/channels', editPerm, async (req, res, next) => {
  try {
    const { businessId } = req.user;
    const { channels } = req.body;
    if (!Array.isArray(channels)) {
      return res.status(400).json({ success: false, message: 'channels must be an array' });
    }
    await prisma.settings.update({
      where: { businessId },
      data: { orderChannels: JSON.stringify(channels) },
    });
    res.json({ success: true, data: channels });
  } catch (err) { next(err); }
});

// POST /api/settings/reset-store — admin-only: reset store identity for a new customer
router.post('/reset-store', editPerm, async (req, res, next) => {
  try {
    const { businessId } = req.user;
    const { nameAr, nameEn, addressAr, addressEn, phone, email, vatNumber, crNumber, businessMode } = req.body;

    if (!nameAr) return res.status(400).json({ success: false, message: 'اسم المتجر بالعربي مطلوب' });

    // Update business identity
    await prisma.business.update({
      where: { id: businessId },
      data: {
        nameAr, nameEn: nameEn || nameAr,
        addressAr: addressAr || null, addressEn: addressEn || null,
        phone: phone || null, email: email || null,
        vatNumber: vatNumber || null, crNumber: crNumber || null,
        businessMode: businessMode || 'RETAIL',
        logo: null, // clear old logo
      },
    });

    // Reset receipt texts
    await prisma.settings.update({
      where: { businessId },
      data: {
        receiptHeaderAr: 'فاتورة ضريبية',
        receiptFooterAr: 'شكراً لزيارتكم!',
        orderChannels: JSON.stringify([{ key: 'DIRECT', label: 'مباشر', enabled: true, defaultPayment: 'CASH' }]),
      },
    });

    res.json({ success: true, message: 'تم تحديث بيانات المتجر بنجاح' });
  } catch (err) { next(err); }
});

// POST /api/settings/logo — upload store logo
let multer;
try { multer = require('multer'); } catch (e) { multer = null; }

if (multer) {
  const uploadsDir = process.env.UPLOADS_DIR || path.join(__dirname, '../../../../uploads');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || '.png';
      cb(null, `logo_${Date.now()}${ext}`);
    },
  });
  const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

  router.post('/logo', editPerm, upload.single('logo'), async (req, res, next) => {
    try {
      if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

      const logoUrl = `/uploads/${req.file.filename}`;
      await prisma.business.update({
        where: { id: req.user.businessId },
        data: { logo: logoUrl },
      });

      res.json({ success: true, data: { logoUrl } });
    } catch (err) { next(err); }
  });
} else {
  // Multer not installed yet — placeholder route
  router.post('/logo', editPerm, (req, res) => {
    res.status(503).json({ success: false, message: 'Logo upload not available — install multer' });
  });
}

module.exports = router;
