const express = require('express');
const { authenticate, requirePermission } = require('../../middleware/auth');
const prisma = require('../../prisma');

const router = express.Router();
router.use(authenticate);

// Permission helper: is this user an admin/manager?
function isManager(req) {
  const perms = req.user?.permissions || [];
  return perms.includes('shifts.manage') || perms.includes('users.view');
}

// GET /api/shifts
// - Cashier: sees only their own shifts
// - Admin/Manager: sees all shifts for the business
router.get('/', requirePermission('shifts.view'), async (req, res, next) => {
  try {
    const { businessId, userId } = req.user;
    const where = isManager(req)
      ? { businessId }
      : { businessId, userId };

    const shifts = await prisma.shift.findMany({
      where,
      include: { user: { select: { fullName: true } }, sales: { include: { payments: true } } },
      orderBy: { openedAt: 'desc' },
    });
    res.json({ success: true, data: shifts });
  } catch (err) { next(err); }
});

// POST /api/shifts — open a shift for current user
// Any user with shifts.view can open their own shift (cashier included)
router.post('/', requirePermission('shifts.view'), async (req, res, next) => {
  try {
    const { businessId, userId } = req.user;
    const startingCash = Number(req.body.startingCash);
    if (isNaN(startingCash) || startingCash < 0) {
      return res.status(422).json({ success: false, message: 'startingCash must be a valid non-negative number' });
    }
    // Block if user already has an open shift
    const existing = await prisma.shift.findFirst({ where: { businessId, userId, status: 'OPEN' } });
    if (existing) {
      return res.status(409).json({ success: false, message: 'You already have an open shift', data: existing });
    }
    const shift = await prisma.shift.create({
      data: { businessId, userId, startingCash },
    });
    res.status(201).json({ success: true, data: shift });
  } catch (err) { next(err); }
});

// PUT /api/shifts/:id — close a shift
// Cashier: can only close their own shift
// Admin/Manager: can close any shift
router.put('/:id', requirePermission('shifts.view'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { businessId, userId } = req.user;
    const endingCash = req.body.endingCash ?? req.body.closingCash;

    const shift = await prisma.shift.findUnique({
      where: { id },
      include: { sales: { include: { payments: true } } },
    });
    if (!shift) return res.status(404).json({ success: false, message: 'Shift not found' });

    // Ownership check: cashier can only close their own shift
    if (!isManager(req) && shift.userId !== userId) {
      return res.status(403).json({ success: false, message: 'You can only close your own shift' });
    }

    // Force all monetary values to numbers (Prisma Decimal returns strings)
    const startingCash = Number(shift.startingCash) || 0;

    // Only count COMPLETED sales; subtract change from cash to get NET revenue
    let cashFromSales = 0;
    let cardFromSales = 0;
    for (const sale of shift.sales) {
      if (sale.status === 'VOIDED') continue; // skip voided sales entirely
      const payments = sale.payments || [];
      if (payments.length > 0) {
        for (const p of payments) {
          const amt = Number(p.amount) || 0;
          if (p.method === 'CASH') cashFromSales += amt;
          else cardFromSales += amt;
        }
      } else {
        cashFromSales += Number(sale.grandTotal) || 0;
      }
      // Subtract change given back to customer (only affects cash)
      cashFromSales -= Number(sale.amountChange) || 0;
    }

    const endingCashNum = Number(endingCash) || 0;
    const expectedCash = startingCash + cashFromSales;
    const variance = endingCashNum - expectedCash;

    if (isNaN(expectedCash) || isNaN(variance)) {
      return res.status(422).json({ success: false, message: 'Invalid cash values - cannot close shift' });
    }

    const updated = await prisma.shift.update({
      where: { id },
      data: { status: 'CLOSED', endingCash: endingCashNum, expectedCash, variance, closedAt: new Date() },
    });
    res.json({ success: true, data: { ...updated, cashSales: cashFromSales, cardSales: cardFromSales } });
  } catch (err) { next(err); }
});

// GET /api/shifts/:id/summary — detailed shift summary for close/day-close
router.get('/:id/summary', requirePermission('shifts.view'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { businessId, userId } = req.user;

    const shift = await prisma.shift.findUnique({
      where: { id },
      include: {
        user: { select: { fullName: true } },
        sales: {
          where: { status: 'COMPLETED' },
          include: { items: { include: { product: { select: { nameAr: true, nameEn: true } } } }, payments: true },
        },
      },
    });
    if (!shift) return res.status(404).json({ success: false, message: 'Shift not found' });

    // Ownership check
    if (!isManager(req) && shift.userId !== userId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Payment breakdown — net revenue (cash minus change)
    let cashTotal = 0, cardTotal = 0;
    for (const sale of shift.sales) {
      for (const p of (sale.payments || [])) {
        const amt = Number(p.amount) || 0;
        if (p.method === 'CASH') cashTotal += amt;
        else cardTotal += amt;
      }
      if (!sale.payments || sale.payments.length === 0) {
        cashTotal += Number(sale.grandTotal) || 0;
      }
      // Subtract change given back to get net cash revenue
      cashTotal -= Number(sale.amountChange) || 0;
    }

    // Product breakdown
    const productMap = {};
    for (const sale of shift.sales) {
      for (const item of (sale.items || [])) {
        const key = item.productId;
        if (!productMap[key]) {
          productMap[key] = {
            productId: key,
            nameAr: item.product?.nameAr || '—',
            nameEn: item.product?.nameEn || '—',
            totalQty: 0,
            totalRevenue: 0,
          };
        }
        productMap[key].totalQty += Number(item.quantity) || 0;
        productMap[key].totalRevenue += Number(item.total) || 0;
      }
    }

    const startingCash = Number(shift.startingCash) || 0;
    const expectedDrawerCash = startingCash + cashTotal;
    const totalSales = cashTotal + cardTotal;
    const subtotalSum = shift.sales.reduce((s, x) => s + Number(x.subtotal || 0), 0);
    const taxSum = shift.sales.reduce((s, x) => s + Number(x.taxAmount || 0), 0);
    const discountSum = shift.sales.reduce((s, x) => s + Number(x.discount || 0), 0);

    res.json({
      success: true,
      data: {
        shiftId: shift.id,
        cashier: shift.user?.fullName || '—',
        openedAt: shift.openedAt,
        closedAt: shift.closedAt,
        status: shift.status,
        startingCash,
        cashSales: cashTotal,
        cardSales: cardTotal,
        totalSales,
        expectedDrawerCash,
        endingCash: shift.endingCash ? Number(shift.endingCash) : null,
        variance: shift.variance ? Number(shift.variance) : null,
        subtotal: subtotalSum,
        tax: taxSum,
        discount: discountSum,
        saleCount: shift.sales.length,
        products: Object.values(productMap).sort((a, b) => b.totalRevenue - a.totalRevenue),
      },
    });
  } catch (err) { next(err); }
});

module.exports = router;
