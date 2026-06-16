const express = require('express');
const { authenticate, requirePermission } = require('../../middleware/auth');
const prisma = require('../../prisma');
const router = express.Router();
router.use(authenticate);

router.get('/', requirePermission('customers.view'), async (req, res, next) => {
  try {
    const { search } = req.query;
    const where = { businessId: req.user.businessId };
    if (search) where.OR = [{ name: { contains: search } }, { phone: { contains: search } }];
    const customers = await prisma.customer.findMany({ where, orderBy: { name: 'asc' }, take: 200 });
    res.json({ success: true, data: customers });
  } catch (err) { next(err); }
});

router.post('/', requirePermission('customers.create'), async (req, res, next) => {
  try {
    const { name, phone, email, notes } = req.body;
    if (!name?.trim()) return res.status(422).json({ success: false, message: 'اسم العميل مطلوب' });
    const customer = await prisma.customer.create({ data: { businessId: req.user.businessId, name: name.trim(), phone: phone?.trim() || null, email: email?.trim() || null, notes: notes || null } });
    res.status(201).json({ success: true, data: customer });
  } catch (err) { next(err); }
});

router.put('/:id', requirePermission('customers.edit'), async (req, res, next) => {
  try {
    const { name, phone, email, notes } = req.body;
    if (!name?.trim()) return res.status(422).json({ success: false, message: 'اسم العميل مطلوب' });
    const c = await prisma.customer.update({ where: { id: req.params.id }, data: { name: name.trim(), phone: phone?.trim() || null, email: email?.trim() || null, notes: notes || null } });
    res.json({ success: true, data: c });
  } catch (err) { next(err); }
});

router.delete('/:id', requirePermission('customers.delete'), async (req, res, next) => {
  try {
    await prisma.customer.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.json({ success: true, message: 'تم الحذف' });
  } catch (err) { next(err); }
});

router.get('/:id/sales', requirePermission('customers.view'), async (req, res, next) => {
  try {
    const sales = await prisma.sale.findMany({ where: { customerId: req.params.id, status: 'COMPLETED' }, include: { items: true, payments: true }, orderBy: { createdAt: 'desc' }, take: 50 });
    res.json({ success: true, data: sales });
  } catch (err) { next(err); }
});

module.exports = router;
