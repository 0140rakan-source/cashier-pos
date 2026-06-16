const express = require('express');
const { authenticate, requirePermission } = require('../../middleware/auth');
const prisma = require('../../prisma');
const router = express.Router();
router.use(authenticate);

// GET /api/modifiers/:productId — جلب إضافات منتج
router.get('/:productId', async (req, res, next) => {
  try {
    const modifiers = await prisma.productModifier.findMany({
      where: { productId: req.params.productId },
      orderBy: { sortOrder: 'asc' },
    });
    res.json({ success: true, data: modifiers });
  } catch (err) { next(err); }
});

// POST /api/modifiers/:productId — إضافة modifier جديد
router.post('/:productId', requirePermission('products.edit'), async (req, res, next) => {
  try {
    const { nameAr, nameEn, price, isDefault, sortOrder } = req.body;
    const modifier = await prisma.productModifier.create({
      data: {
        productId: req.params.productId,
        nameAr,
        nameEn: nameEn || '',
        price: Number(price) || 0,
        isDefault: isDefault || false,
        sortOrder: Number(sortOrder) || 0,
      },
    });
    res.json({ success: true, data: modifier });
  } catch (err) { next(err); }
});

// PUT /api/modifiers/item/:id — تعديل modifier
router.put('/item/:id', requirePermission('products.edit'), async (req, res, next) => {
  try {
    const { nameAr, nameEn, price, isDefault, sortOrder } = req.body;
    const modifier = await prisma.productModifier.update({
      where: { id: req.params.id },
      data: {
        nameAr,
        nameEn: nameEn || '',
        price: Number(price) || 0,
        isDefault: isDefault || false,
        sortOrder: Number(sortOrder) || 0,
      },
    });
    res.json({ success: true, data: modifier });
  } catch (err) { next(err); }
});

// DELETE /api/modifiers/item/:id — حذف modifier
router.delete('/item/:id', requirePermission('products.edit'), async (req, res, next) => {
  try {
    await prisma.productModifier.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
