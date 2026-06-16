const express = require('express');
const { authenticate, requirePermission } = require('../../middleware/auth');
const prisma = require('../../prisma');
const router = express.Router();
router.use(authenticate);
const adminPerm = requirePermission('settings.view');

// GET /api/audit — recent significant actions
router.get('/', adminPerm, async (req, res, next) => {
  try {
    const { businessId } = req.user;
    const [sales, inventoryLogs, shifts, expenses] = await Promise.all([
      prisma.sale.findMany({
        where: { businessId },
        select: {
          id: true,
          grandTotal: true,
          status: true,
          createdAt: true,
          cashier: { select: { fullName: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      prisma.inventoryLog.findMany({
        where: { businessId },
        select: {
          id: true,
          productId: true,
          changeType: true,
          quantity: true,
          newQty: true,
          note: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      prisma.shift.findMany({
        where: { businessId },
        select: {
          id: true,
          status: true,
          openedAt: true,
          closedAt: true,
          user: { select: { fullName: true } },
        },
        orderBy: { openedAt: 'desc' },
        take: 20,
      }),
      prisma.expense.findMany({
        where: { businessId },
        select: {
          id: true,
          amount: true,
          description: true,
          createdAt: true,
          user: { select: { fullName: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);
    res.json({ success: true, data: { sales, inventoryLogs, shifts, expenses } });
  } catch (err) { next(err); }
});

module.exports = router;
