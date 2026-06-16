const express = require('express');
const { authenticate, requirePermission } = require('../../middleware/auth');
const prisma = require('../../prisma');
const router = express.Router();
router.use(authenticate);

router.get('/', requirePermission('categories.view'), async (req, res, next) => {
  try {
    const cats = await prisma.category.findMany({ where: { businessId: req.user.businessId }, orderBy: { nameAr: 'asc' } });
    res.json({ success: true, data: cats });
  } catch (err) { next(err); }
});

router.post('/', requirePermission('categories.create'), async (req, res, next) => {
  try {
    const { nameAr, nameEn, description } = req.body;
    if (!nameAr?.trim()) return res.status(422).json({ success: false, message: 'الاسم العربي مطلوب' });
    const cat = await prisma.category.create({ data: { businessId: req.user.businessId, nameAr: nameAr.trim(), nameEn: nameEn?.trim() || nameAr.trim(), description: description || '' } });
    res.status(201).json({ success: true, data: cat });
  } catch (err) { next(err); }
});

router.put('/:id', requirePermission('categories.edit'), async (req, res, next) => {
  try {
    const { nameAr, nameEn, description } = req.body;
    if (!nameAr?.trim()) return res.status(422).json({ success: false, message: 'الاسم العربي مطلوب' });
    const cat = await prisma.category.update({ where: { id: req.params.id }, data: { nameAr: nameAr.trim(), nameEn: nameEn?.trim() || nameAr.trim(), description: description || '' } });
    res.json({ success: true, data: cat });
  } catch (err) { next(err); }
});

router.delete('/:id', requirePermission('categories.delete'), async (req, res, next) => {
  try {
    const count = await prisma.product.count({ where: { categoryId: req.params.id } });
    if (count > 0) return res.status(400).json({ success: false, message: `لا يمكن حذف هذا القسم — يحتوي على ${count} منتج` });
    await prisma.category.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'تم الحذف' });
  } catch (err) { next(err); }
});

module.exports = router;
