const express = require('express');
const { authenticate, requirePermission } = require('../../middleware/auth');
const prisma = require('../../prisma');

const router = express.Router();
router.use(authenticate);

// Reports — admin/manager only, NOT cashier
const viewPerm = requirePermission('reports.view');

// GET /api/reports/summary
router.get('/summary', viewPerm, async (req, res, next) => {
  try {
    const { businessId } = req.user;
    const { from, to } = req.query;

    // Today's date range
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // All-time sales
    const allSales = await prisma.sale.findMany({ where: { businessId, status: 'COMPLETED' } });
    const totalRevenue = allSales.reduce((sum, s) => sum + Number(s.grandTotal), 0);
    const salesCount = allSales.length;

    // Today's sales
    const todaySalesRows = await prisma.sale.findMany({
      where: { businessId, status: 'COMPLETED', createdAt: { gte: todayStart, lte: todayEnd } },
    });
    const todaySales = todaySalesRows.reduce((sum, s) => sum + Number(s.grandTotal), 0);
    const todayCount = todaySalesRows.length;

    // Filtered sales (from/to) — if provided, override todaySales/todayCount in response
    let filteredSales = todaySales;
    let filteredCount = todayCount;
    if (from || to) {
      const filterWhere = { businessId, status: 'COMPLETED' };
      // Parse dates in local server time (not UTC) to match actual business hours
      if (from) {
        const d = new Date(from);
        d.setHours(0, 0, 0, 0);
        filterWhere.createdAt = { ...filterWhere.createdAt, gte: d };
      }
      if (to) {
        const d = new Date(to);
        d.setHours(23, 59, 59, 999);
        filterWhere.createdAt = { ...filterWhere.createdAt, lte: d };
      }
      const filtered = await prisma.sale.findMany({ where: filterWhere });
      filteredSales = filtered.reduce((sum, s) => sum + Number(s.grandTotal), 0);
      filteredCount = filtered.length;
    }

    // Expenses summary
    const expenses = await prisma.expense.findMany({ where: { businessId } });
    const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

    // Inventory alerts
    const settings = await prisma.settings.findUnique({ where: { businessId } });
    const lowStockThreshold = settings?.lowStockThreshold || 5;
    const lowStockCount = await prisma.inventory.count({
      where: { businessId, currentStock: { lte: lowStockThreshold } },
    });

    // Counts
    const totalProducts = await prisma.product.count({ where: { businessId, isActive: true } });
    const totalCustomers = await prisma.customer.count({ where: { businessId } });
    const totalSuppliers = await prisma.supplier.count({ where: { businessId } });

    res.json({
      success: true,
      data: {
        todaySales: filteredSales,
        todayCount: filteredCount,
        totalRevenue,
        salesCount,
        totalExpenses,
        profit: totalRevenue - totalExpenses,
        totalProducts,
        totalCustomers,
        totalSuppliers,
        lowStockCount,
      },
    });
  } catch (err) { next(err); }
});

// GET /api/reports/inventory
router.get('/inventory', viewPerm, async (req, res, next) => {
  try {
    const { businessId } = req.user;
    const inventory = await prisma.inventory.findMany({
      where: { businessId },
      include: { product: { select: { nameAr: true, nameEn: true } } },
      orderBy: { currentStock: 'asc' },
      take: 500,
    });
    res.json({ success: true, data: inventory });
  } catch (err) { next(err); }
});

module.exports = router;
