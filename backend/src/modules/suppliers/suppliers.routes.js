const express = require('express');
const { authenticate, requirePermission } = require('../../middleware/auth');
const prisma = require('../../prisma');
const router = express.Router();
router.use(authenticate);

router.get('/', requirePermission('suppliers.view'), async (req, res, next) => {
  try {
    const suppliers = await prisma.supplier.findMany({ where: { businessId: req.user.businessId }, orderBy: { name: 'asc' } });
    res.json({ success: true, data: suppliers });
  } catch (err) { next(err); }
});

router.post('/', requirePermission('suppliers.create'), async (req, res, next) => {
  try {
    const { name, phone, email, address, notes } = req.body;
    if (!name?.trim()) return res.status(422).json({ success: false, message: 'اسم المورد مطلوب' });
    const s = await prisma.supplier.create({ data: { businessId: req.user.businessId, name: name.trim(), phone: phone?.trim() || null, email: email?.trim() || null, address: address?.trim() || null, notes: notes || null } });
    res.status(201).json({ success: true, data: s });
  } catch (err) { next(err); }
});

router.put('/:id', requirePermission('suppliers.edit'), async (req, res, next) => {
  try {
    const { name, phone, email, address, notes } = req.body;
    if (!name?.trim()) return res.status(422).json({ success: false, message: 'اسم المورد مطلوب' });
    const s = await prisma.supplier.update({ where: { id: req.params.id }, data: { name: name.trim(), phone: phone?.trim() || null, email: email?.trim() || null, address: address?.trim() || null, notes: notes || null } });
    res.json({ success: true, data: s });
  } catch (err) { next(err); }
});

router.delete('/:id', requirePermission('suppliers.delete'), async (req, res, next) => {
  try {
    await prisma.supplier.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'تم الحذف' });
  } catch (err) { next(err); }
});

module.exports = router;
