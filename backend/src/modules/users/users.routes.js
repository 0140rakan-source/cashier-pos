const express = require('express');
const { authenticate, requirePermission } = require('../../middleware/auth');
const userService = require('../../services/user.service');

const router = express.Router();
router.use(authenticate);

// Self password change — must be before /:id routes
router.post('/me/change-password', async (req, res, next) => {
  try {
    await userService.changePassword(req.user.userId, req.user.businessId, req.body);
    res.json({ success: true, message: 'Password changed' });
  } catch (err) { next(err); }
});

// Users — admin only
router.get('/', requirePermission('users.view'), async (req, res, next) => {
  try { res.json({ success: true, data: await userService.list(req.user.businessId, req.query) }); }
  catch (e) { next(e); }
});
router.post('/', requirePermission('users.create'), async (req, res, next) => {
  try { res.status(201).json({ success: true, data: await userService.create(req.user.businessId, req.body) }); }
  catch (e) { next(e); }
});
router.get('/:id', requirePermission('users.view'), async (req, res, next) => {
  try { res.json({ success: true, data: await userService.getById(req.params.id, req.user.businessId) }); }
  catch (e) { next(e); }
});
router.put('/:id', requirePermission('users.edit'), async (req, res, next) => {
  try { res.json({ success: true, data: await userService.update(req.params.id, req.user.businessId, req.body) }); }
  catch (e) { next(e); }
});
router.delete('/:id', requirePermission('users.delete'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { businessId, userId: requesterId } = req.user;
    const prisma = require('../../prisma');
    // Guard: cannot delete self
    if (id === requesterId) {
      return res.status(400).json({ success: false, message: 'Cannot delete your own account' });
    }
    // Guard: cannot delete last active admin
    const targetUser = await prisma.user.findFirst({ where: { id, businessId }, include: { role: true } });
    if (!targetUser) return res.status(404).json({ success: false, message: 'User not found' });
    if (targetUser.role?.name === 'ADMIN') {
      const adminCount = await prisma.user.count({ where: { businessId, isActive: true, role: { name: 'ADMIN' } } });
      if (adminCount <= 1) return res.status(400).json({ success: false, message: 'Cannot delete the last admin account' });
    }
    // Guard: deactivate instead of hard delete if user has ANY protected linked records
    const [salesCount, shiftsCount, purchasesCount, expensesCount] = await Promise.all([
      prisma.sale.count({ where: { cashUserId: id } }),
      prisma.shift.count({ where: { userId: id } }),
      prisma.purchase.count({ where: { createdBy: id } }),
      prisma.expense.count({ where: { userId: id } }),
    ]);
    const hasHistory = salesCount + shiftsCount + purchasesCount + expensesCount > 0;
    if (hasHistory) {
      await prisma.user.update({ where: { id }, data: { isActive: false } });
      const reasons = [];
      if (shiftsCount > 0) reasons.push(`${shiftsCount} وردية`);
      if (salesCount > 0) reasons.push(`${salesCount} عملية بيع`);
      if (purchasesCount > 0) reasons.push(`${purchasesCount} عملية شراء`);
      if (expensesCount > 0) reasons.push(`${expensesCount} مصروف`);
      return res.json({
        success: true,
        deactivated: true,
        message: `لا يمكن حذف المستخدم نهائياً لأنه مرتبط بـ: ${reasons.join('، ')}. تم تعطيله بدلاً من الحذف.`,
      });
    }
    await prisma.user.delete({ where: { id } });
    res.json({ success: true, message: 'تم حذف المستخدم نهائياً' });
  } catch (e) { next(e); }
});
router.post('/:id/reset-pin', requirePermission('users.edit'), async (req, res, next) => {
  try { await userService.resetPin(req.params.id, req.user.businessId, req.body.pin); res.json({ success: true }); }
  catch (e) { next(e); }
});
router.post('/:id/change-password', requirePermission('users.edit'), async (req, res, next) => {
  try {
    await userService.changePassword(req.params.id, req.user.businessId, req.body);
    res.json({ success: true, message: 'Password changed' });
  } catch (err) { next(err); }
});

module.exports = router;