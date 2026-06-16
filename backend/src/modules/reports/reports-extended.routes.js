const express = require('express');
const { authenticate, requirePermission } = require('../../middleware/auth');
const prisma = require('../../prisma');
const router = express.Router();
router.use(authenticate);
const viewPerm = requirePermission('reports.view');

// GET /api/reports/by-cashier
router.get('/by-cashier', viewPerm, async (req, res, next) => {
  try {
    const { businessId } = req.user;
    const { from, to } = req.query;
    const where = { businessId, status: 'COMPLETED' };
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) {
        const d = new Date(to);
        d.setHours(23, 59, 59, 999);
        where.createdAt.lte = d;
      }
    }
    const sales = await prisma.sale.findMany({
      where,
      include: { cashier: { select: { fullName: true, username: true } } },
    });
    const map = {};
    for (const s of sales) {
      const key = s.cashUserId;
      if (!map[key]) map[key] = { cashierId: key, cashierName: s.cashier?.fullName || 'Unknown', totalSales: 0, count: 0 };
      map[key].totalSales += Number(s.grandTotal);
      map[key].count++;
    }
    res.json({ success: true, data: Object.values(map).sort((a, b) => b.totalSales - a.totalSales) });
  } catch (err) { next(err); }
});

// GET /api/reports/by-product
router.get('/by-product', viewPerm, async (req, res, next) => {
  try {
    const { businessId } = req.user;
    const { from, to, limit = 20 } = req.query;
    const where = { sale: { businessId, status: 'COMPLETED' } };
    if (from || to) {
      where.sale.createdAt = {};
      if (from) where.sale.createdAt.gte = new Date(from);
      if (to) {
        const d = new Date(to);
        d.setHours(23, 59, 59, 999);
        where.sale.createdAt.lte = d;
      }
    }
    const items = await prisma.saleItem.findMany({
      where,
      include: { product: { select: { nameAr: true, nameEn: true } } },
    });
    const map = {};
    for (const i of items) {
      const key = i.productId;
      if (!map[key]) map[key] = { productId: key, nameAr: i.product?.nameAr || '—', nameEn: i.product?.nameEn || '—', totalQty: 0, totalRevenue: 0 };
      map[key].totalQty += Number(i.quantity);
      map[key].totalRevenue += Number(i.total);
    }
    const sorted = Object.values(map).sort((a, b) => b.totalRevenue - a.totalRevenue).slice(0, Number(limit));
    res.json({ success: true, data: sorted });
  } catch (err) { next(err); }
});

// GET /api/reports/by-payment
router.get('/by-payment', viewPerm, async (req, res, next) => {
  try {
    const { businessId } = req.user;
    const { from, to } = req.query;
    const where = { sale: { businessId, status: 'COMPLETED' } };
    if (from || to) {
      where.sale.createdAt = {};
      if (from) where.sale.createdAt.gte = new Date(from);
      if (to) {
        const d = new Date(to);
        d.setHours(23, 59, 59, 999);
        where.sale.createdAt.lte = d;
      }
    }
    const payments = await prisma.salePayment.findMany({ where });
    const map = {};
    for (const p of payments) {
      if (!map[p.method]) map[p.method] = { method: p.method, total: 0, count: 0 };
      map[p.method].total += Number(p.amount);
      map[p.method].count++;
    }
    res.json({ success: true, data: Object.values(map) });
  } catch (err) { next(err); }
});

// GET /api/reports/tax-summary
router.get('/tax-summary', viewPerm, async (req, res, next) => {
  try {
    const { businessId } = req.user;
    const { from, to } = req.query;
    const where = { businessId, status: 'COMPLETED' };
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) {
        const d = new Date(to);
        d.setHours(23, 59, 59, 999);
        where.createdAt.lte = d;
      }
    }
    const sales = await prisma.sale.findMany({
      where,
      select: { subtotal: true, taxAmount: true, grandTotal: true, discount: true },
    });
    const subtotalSum = sales.reduce((s, x) => s + Number(x.subtotal), 0);
    const taxSum = sales.reduce((s, x) => s + Number(x.taxAmount), 0);
    const discountSum = sales.reduce((s, x) => s + Number(x.discount), 0);
    const grandSum = sales.reduce((s, x) => s + Number(x.grandTotal), 0);
    res.json({ success: true, data: { subtotalSum, taxSum, discountSum, grandSum, count: sales.length } });
  } catch (err) { next(err); }
});

// GET /api/reports/low-stock
router.get('/low-stock', viewPerm, async (req, res, next) => {
  try {
    const { businessId } = req.user;
    const settings = await prisma.settings.findUnique({ where: { businessId } });
    const threshold = Number(settings?.lowStockThreshold || 5);
    const items = await prisma.inventory.findMany({
      where: { businessId, currentStock: { lte: threshold } },
      include: { product: { select: { nameAr: true, nameEn: true, isActive: true } } },
      orderBy: { currentStock: 'asc' },
    });
    res.json({ success: true, data: items });
  } catch (err) { next(err); }
});

// GET /api/reports/shifts
router.get('/shifts', viewPerm, async (req, res, next) => {
  try {
    const { businessId } = req.user;
    const shifts = await prisma.shift.findMany({
      where: { businessId },
      include: {
        user: { select: { fullName: true } },
        sales: { include: { payments: true } },
      },
      orderBy: { openedAt: 'desc' },
      take: 20,
    });
    const data = shifts.map(s => {
      const completedSales = s.sales.filter(x => x.status !== 'VOIDED');
      let cashSales = 0, cardSales = 0;
      for (const sale of completedSales) {
        for (const p of (sale.payments || [])) {
          const amt = Number(p.amount) || 0;
          if (p.method === 'CASH') cashSales += amt;
          else cardSales += amt;
        }
        if (!sale.payments || sale.payments.length === 0) cashSales += Number(sale.grandTotal) || 0;
        cashSales -= Number(sale.amountChange) || 0;
      }
      return {
        ...s,
        totalSales: completedSales.reduce((sum, x) => sum + Number(x.grandTotal), 0),
        totalTax: completedSales.reduce((sum, x) => sum + Number(x.taxAmount), 0),
        saleCount: completedSales.length,
        cashSales,
        cardSales,
      };
    });
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// GET /api/reports/day-close — تقرير إغلاق اليوم مع دعم الوردية
// إذا تم تمرير shiftId يعرض تقرير الوردية فقط
// إذا تم تمرير date يعرض تقرير اليوم كله
router.get('/day-close', viewPerm, async (req, res, next) => {
  try {
    const { businessId } = req.user;
    const { date, shiftId } = req.query;

    let dayStart, dayEnd, reportLabel;

    if (shiftId) {
      // تقرير وردية محددة
      const shift = await prisma.shift.findUnique({ where: { id: shiftId } });
      if (!shift) return res.status(404).json({ success: false, message: 'الوردية غير موجودة' });
      dayStart = new Date(shift.openedAt);
      dayEnd = shift.closedAt ? new Date(shift.closedAt) : new Date();
      reportLabel = dayStart.toISOString().split('T')[0];
    } else {
      // تقرير يوم كامل
      const targetDate = date ? new Date(date) : new Date();
      dayStart = new Date(targetDate);
      dayStart.setHours(0, 0, 0, 0);
      dayEnd = new Date(targetDate);
      dayEnd.setHours(23, 59, 59, 999);
      reportLabel = dayStart.toISOString().split('T')[0];
    }

    const salesWhere = {
      businessId,
      status: 'COMPLETED',
      createdAt: { gte: dayStart, lte: dayEnd },
    };

    // إذا شفت وردية محددة، فلتر بالوردية
    if (shiftId) {
      salesWhere.shiftId = shiftId;
    }

    const sales = await prisma.sale.findMany({
      where: salesWhere,
      include: {
        items: { include: { product: { select: { nameAr: true, nameEn: true, costPrice: true } } } },
        payments: true,
        cashier: { select: { fullName: true } },
      },
    });

    // Payment breakdown
    let cashTotal = 0, cardTotal = 0;
    for (const sale of sales) {
      for (const p of (sale.payments || [])) {
        const amt = Number(p.amount) || 0;
        if (p.method === 'CASH') cashTotal += amt;
        else cardTotal += amt;
      }
      if (!sale.payments || sale.payments.length === 0) {
        cashTotal += Number(sale.grandTotal) || 0;
      }
      cashTotal -= Number(sale.amountChange) || 0;
    }

    // Product breakdown
    const productMap = {};
    for (const sale of sales) {
      for (const item of (sale.items || [])) {
        const key = item.productId;
        if (!productMap[key]) {
          productMap[key] = {
            productId: key,
            nameAr: item.product?.nameAr || '—',
            nameEn: item.product?.nameEn || '—',
            costPrice: Number(item.product?.costPrice || 0),
            totalQty: 0,
            totalRevenue: 0,
            totalCost: 0,
          };
        }
        const qty = Number(item.quantity) || 0;
        productMap[key].totalQty += qty;
        productMap[key].totalRevenue += Number(item.total) || 0;
        productMap[key].totalCost += qty * Number(item.product?.costPrice || 0);
      }
    }
    const products = Object.values(productMap).sort((a, b) => b.totalRevenue - a.totalRevenue);

    // Cashier breakdown
    const cashierMap = {};
    for (const sale of sales) {
      const key = sale.cashUserId;
      if (!cashierMap[key]) cashierMap[key] = { name: sale.cashier?.fullName || '—', count: 0, total: 0 };
      cashierMap[key].count++;
      cashierMap[key].total += Number(sale.grandTotal) || 0;
    }

    // Channel breakdown
    const channelMap = {};
    for (const sale of sales) {
      const ch = sale.orderChannel || 'DIRECT';
      if (!channelMap[ch]) channelMap[ch] = { channel: ch, count: 0, total: 0 };
      channelMap[ch].count++;
      channelMap[ch].total += Number(sale.grandTotal) || 0;
    }

    const subtotalSum = sales.reduce((s, x) => s + Number(x.subtotal || 0), 0);
    const taxSum = sales.reduce((s, x) => s + Number(x.taxAmount || 0), 0);
    const discountSum = sales.reduce((s, x) => s + Number(x.discount || 0), 0);
    const grandSum = sales.reduce((s, x) => s + Number(x.grandTotal || 0), 0);
    const totalCost = products.reduce((s, p) => s + p.totalCost, 0);

    res.json({
      success: true,
      data: {
        date: reportLabel,
        shiftId: shiftId || null,
        periodStart: dayStart.toISOString(),
        periodEnd: dayEnd.toISOString(),
        saleCount: sales.length,
        subtotal: subtotalSum,
        tax: taxSum,
        discount: discountSum,
        grandTotal: grandSum,
        cashSales: cashTotal,
        cardSales: cardTotal,
        totalCost,
        grossProfit: grandSum - totalCost,
        products,
        cashiers: Object.values(cashierMap),
        channels: Object.values(channelMap),
      },
    });
  } catch (err) { next(err); }
});

// GET /api/reports/by-channel
router.get('/by-channel', viewPerm, async (req, res, next) => {
  try {
    const { businessId } = req.user;
    const { from, to } = req.query;
    const where = { businessId, status: 'COMPLETED' };
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) { const d = new Date(to); d.setHours(23,59,59,999); where.createdAt.lte = d; }
    }
    const sales = await prisma.sale.findMany({ where, include: { payments: true } });
    const map = {};
    for (const s of sales) {
      const ch = s.orderChannel || 'DIRECT';
      if (!map[ch]) map[ch] = { channel: ch, totalSales: 0, count: 0, cashRevenue: 0, cardRevenue: 0 };
      map[ch].totalSales += Number(s.grandTotal);
      map[ch].count++;
      let cashPay = 0, cardPay = 0;
      for (const p of (s.payments || [])) {
        if (p.method === 'CASH') cashPay += Number(p.amount); else cardPay += Number(p.amount);
      }
      cashPay -= Number(s.amountChange) || 0;
      map[ch].cashRevenue += cashPay;
      map[ch].cardRevenue += cardPay;
    }
    res.json({ success: true, data: Object.values(map).sort((a,b) => b.totalSales - a.totalSales) });
  } catch (err) { next(err); }
});

// GET /api/reports/sale/:id
router.get('/sale/:id', viewPerm, async (req, res, next) => {
  try {
    const sale = await prisma.sale.findUnique({
      where: { id: req.params.id },
      include: {
        items: { include: { product: { select: { nameAr: true, nameEn: true, costPrice: true } } } },
        payments: true,
        cashier: { select: { fullName: true } },
        customer: { select: { name: true, phone: true } },
        shift: { select: { id: true, openedAt: true } },
      },
    });
    if (!sale) return res.status(404).json({ success: false, message: 'Sale not found' });
    res.json({ success: true, data: sale });
  } catch (err) { next(err); }
});

// GET /api/reports/closed-shifts — قائمة الورديات المغلقة للاختيار
router.get('/closed-shifts', viewPerm, async (req, res, next) => {
  try {
    const { businessId } = req.user;
    const shifts = await prisma.shift.findMany({
      where: { businessId, status: 'CLOSED' },
      include: { user: { select: { fullName: true } } },
      orderBy: { closedAt: 'desc' },
      take: 30,
    });
    res.json({ success: true, data: shifts });
  } catch (err) { next(err); }
});

module.exports = router;
