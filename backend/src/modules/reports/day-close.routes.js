const express = require('express');
const { authenticate, requirePermission } = require('../../middleware/auth');
const prisma = require('../../prisma');
const router = express.Router();
router.use(authenticate);
const adminPerm = requirePermission('reports.view');

// POST /api/day-close — إغلاق اليوم وحفظ التقرير
router.post('/', adminPerm, async (req, res, next) => {
  try {
    const { businessId, userId } = req.user;

    // آخر إغلاق يوم
    const lastClose = await prisma.dayClose.findFirst({
      where: { businessId },
      orderBy: { closedAt: 'desc' },
    });

    const periodStart = lastClose ? new Date(lastClose.closedAt) : new Date('2000-01-01');
    const periodEnd = new Date();

    // جلب المبيعات من آخر إغلاق حتى الآن
    const sales = await prisma.sale.findMany({
      where: {
        businessId,
        status: 'COMPLETED',
        createdAt: { gte: periodStart, lte: periodEnd },
      },
      include: {
        items: { include: { product: { select: { nameAr: true, costPrice: true } } } },
        payments: true,
        cashier: { select: { fullName: true } },
      },
    });

    // حساب الإجماليات
    let cashTotal = 0, cardTotal = 0;
    for (const sale of sales) {
      for (const p of (sale.payments || [])) {
        if (p.method === 'CASH') cashTotal += Number(p.amount);
        else cardTotal += Number(p.amount);
      }
      if (!sale.payments || sale.payments.length === 0) cashTotal += Number(sale.grandTotal);
      cashTotal -= Number(sale.amountChange) || 0;
    }

    const subtotal = sales.reduce((s, x) => s + Number(x.subtotal || 0), 0);
    const tax = sales.reduce((s, x) => s + Number(x.taxAmount || 0), 0);
    const discount = sales.reduce((s, x) => s + Number(x.discount || 0), 0);
    const grandTotal = sales.reduce((s, x) => s + Number(x.grandTotal || 0), 0);

    // تفصيل المنتجات
    const productMap = {};
    for (const sale of sales) {
      for (const item of (sale.items || [])) {
        const key = item.productId;
        if (!productMap[key]) {
          productMap[key] = { nameAr: item.product?.nameAr || '—', totalQty: 0, totalRevenue: 0, totalCost: 0 };
        }
        const qty = Number(item.quantity) || 0;
        productMap[key].totalQty += qty;
        productMap[key].totalRevenue += Number(item.total) || 0;
        productMap[key].totalCost += qty * Number(item.product?.costPrice || 0);
      }
    }
    const products = Object.values(productMap);
    const totalCost = products.reduce((s, p) => s + p.totalCost, 0);

    // تفصيل الكاشير
    const cashierMap = {};
    for (const sale of sales) {
      const name = sale.cashier?.fullName || '—';
      if (!cashierMap[name]) cashierMap[name] = { name, count: 0, total: 0 };
      cashierMap[name].count++;
      cashierMap[name].total += Number(sale.grandTotal);
    }

    const snapshot = JSON.stringify({
      products: Object.values(productMap),
      cashiers: Object.values(cashierMap),
    });

    // حفظ التقرير
    const dayClose = await prisma.dayClose.create({
      data: {
        businessId,
        closedBy: userId,
        periodStart,
        periodEnd,
        saleCount: sales.length,
        subtotal,
        tax,
        discount,
        grandTotal,
        cashSales: cashTotal,
        cardSales: cardTotal,
        totalCost,
        grossProfit: grandTotal - totalCost,
        snapshot,
      },
    });

    res.json({
      success: true,
      message: 'تم إغلاق اليوم بنجاح',
      data: {
        ...dayClose,
        products: Object.values(productMap),
        cashiers: Object.values(cashierMap),
      },
    });
  } catch (err) { next(err); }
});

// GET /api/day-close — قائمة تقارير الإغلاق
router.get('/', adminPerm, async (req, res, next) => {
  try {
    const { businessId } = req.user;
    const closes = await prisma.dayClose.findMany({
      where: { businessId },
      orderBy: { closedAt: 'desc' },
      take: 30,
    });
    res.json({ success: true, data: closes });
  } catch (err) { next(err); }
});

// GET /api/day-close/current — المبيعات منذ آخر إغلاق
router.get('/current', adminPerm, async (req, res, next) => {
  try {
    const { businessId } = req.user;

    const lastClose = await prisma.dayClose.findFirst({
      where: { businessId },
      orderBy: { closedAt: 'desc' },
    });

    const periodStart = lastClose ? new Date(lastClose.closedAt) : new Date('2000-01-01');
    const periodEnd = new Date();

    const sales = await prisma.sale.findMany({
      where: {
        businessId,
        status: 'COMPLETED',
        createdAt: { gte: periodStart, lte: periodEnd },
      },
      include: {
        items: { include: { product: { select: { nameAr: true, costPrice: true } } } },
        payments: true,
        cashier: { select: { fullName: true } },
      },
    });

    let cashTotal = 0, cardTotal = 0;
    for (const sale of sales) {
      for (const p of (sale.payments || [])) {
        if (p.method === 'CASH') cashTotal += Number(p.amount);
        else cardTotal += Number(p.amount);
      }
      if (!sale.payments || sale.payments.length === 0) cashTotal += Number(sale.grandTotal);
      cashTotal -= Number(sale.amountChange) || 0;
    }

    const subtotal = sales.reduce((s, x) => s + Number(x.subtotal || 0), 0);
    const tax = sales.reduce((s, x) => s + Number(x.taxAmount || 0), 0);
    const discount = sales.reduce((s, x) => s + Number(x.discount || 0), 0);
    const grandTotal = sales.reduce((s, x) => s + Number(x.grandTotal || 0), 0);

    const productMap = {};
    for (const sale of sales) {
      for (const item of (sale.items || [])) {
        const key = item.productId;
        if (!productMap[key]) {
          productMap[key] = { nameAr: item.product?.nameAr || '—', totalQty: 0, totalRevenue: 0, totalCost: 0 };
        }
        const qty = Number(item.quantity) || 0;
        productMap[key].totalQty += qty;
        productMap[key].totalRevenue += Number(item.total) || 0;
        productMap[key].totalCost += qty * Number(item.product?.costPrice || 0);
      }
    }

    const cashierMap = {};
    for (const sale of sales) {
      const name = sale.cashier?.fullName || '—';
      if (!cashierMap[name]) cashierMap[name] = { name, count: 0, total: 0 };
      cashierMap[name].count++;
      cashierMap[name].total += Number(sale.grandTotal);
    }

    const totalCost = Object.values(productMap).reduce((s, p) => s + p.totalCost, 0);

    res.json({
      success: true,
      data: {
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
        lastCloseAt: lastClose?.closedAt || null,
        saleCount: sales.length,
        subtotal,
        tax,
        discount,
        grandTotal,
        cashSales: cashTotal,
        cardSales: cardTotal,
        totalCost,
        grossProfit: grandTotal - totalCost,
        products: Object.values(productMap),
        cashiers: Object.values(cashierMap),
      },
    });
  } catch (err) { next(err); }
});

// GET /api/day-close/:id — تقرير إغلاق محدد
router.get('/:id', adminPerm, async (req, res, next) => {
  try {
    const { businessId } = req.user;
    const close = await prisma.dayClose.findFirst({
      where: { id: req.params.id, businessId },
    });
    if (!close) return res.status(404).json({ success: false, message: 'التقرير غير موجود' });

    const snapshot = close.snapshot ? JSON.parse(close.snapshot) : {};
    res.json({ success: true, data: { ...close, ...snapshot } });
  } catch (err) { next(err); }
});

module.exports = router;
