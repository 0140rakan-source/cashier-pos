const express = require('express');
const { authenticate, requirePermission } = require('../../middleware/auth');
const prisma = require('../../prisma');
const router = express.Router();
router.use(authenticate);

router.get('/', requirePermission('expenses.view'), async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const where = { businessId: req.user.businessId };
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from);
      if (to) { const d = new Date(to); d.setHours(23,59,59,999); where.date.lte = d; }
    }
    const expenses = await prisma.expense.findMany({ where, orderBy: { date: 'desc' }, take: 500 });
    res.json({ success: true, data: expenses });
  } catch (err) { next(err); }
});

router.post('/', requirePermission('expenses.create'), async (req, res, next) => {
  try {
    const { amount, category, description, date } = req.body;
    if (!amount || Number(amount) <= 0) return res.status(422).json({ success: false, message: 'المبلغ غير صحيح' });
    if (!category?.trim()) return res.status(422).json({ success: false, message: 'الفئة مطلوبة' });
    const e = await prisma.expense.create({ data: { businessId: req.user.businessId, amount: Number(amount), category: category.trim(), description: description?.trim() || null, date: date ? new Date(date) : new Date() } });
    res.status(201).json({ success: true, data: e });
  } catch (err) { next(err); }
});

router.delete('/:id', requirePermission('expenses.delete'), async (req, res, next) => {
  try {
    await prisma.expense.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'تم الحذف' });
  } catch (err) { next(err); }
});

module.exports = router;
