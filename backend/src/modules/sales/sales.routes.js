const express = require('express');
const { authenticate, requirePermission } = require('../../middleware/auth');
const prisma = require('../../prisma');

const router = express.Router();
router.use(authenticate);

const viewPerm = requirePermission('sales.view');
const createPerm = requirePermission('sales.create');

// ─── POST /api/sales ──────────────────────────────────────────────────────────
router.post('/', createPerm, async (req, res, next) => {
  try {
    const { businessId, userId } = req.user;
    const { items, payments, discount = 0, notes, customerId, orderType, orderChannel } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0)
      return res.status(422).json({ success: false, message: 'يجب إضافة منتج واحد على الأقل' });
    if (!payments || !Array.isArray(payments) || payments.length === 0)
      return res.status(422).json({ success: false, message: 'يجب تحديد طريقة الدفع' });

    // Must have an open shift
    let activeShift = await prisma.shift.findFirst({ where: { businessId, userId, status: 'OPEN' } });
    if (!activeShift)
      activeShift = await prisma.shift.findFirst({ where: { businessId, status: 'OPEN' } });
    if (!activeShift)
      return res.status(400).json({ success: false, message: 'لا توجد وردية مفتوحة. افتح وردية أولاً قبل البيع.' });

    const sale = await createSale({ businessId, userId, shiftId: activeShift.id, items, payments, discount, notes, customerId, orderType, orderChannel });
    res.status(201).json({ success: true, data: sale });
  } catch (err) { next(err); }
});

// ─── GET /api/sales ───────────────────────────────────────────────────────────
router.get('/', viewPerm, async (req, res, next) => {
  try {
    const { businessId } = req.user;
    const { from, to, status, limit = 200 } = req.query;
    const where = { businessId };

    if (from || to) {
      where.createdAt = {};
      if (from) { const d = new Date(from); d.setHours(0,0,0,0); where.createdAt.gte = d; }
      if (to)   { const d = new Date(to);   d.setHours(23,59,59,999); where.createdAt.lte = d; }
    }
    if (status) where.status = status;

    const sales = await prisma.sale.findMany({
      where,
      include: {
        items: { include: { product: { select: { nameAr: true, nameEn: true, barcode: true } } } },
        payments: true,
        cashier: { select: { fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Number(limit) || 200, 1000),
    });
    res.json({ success: true, data: sales });
  } catch (err) { next(err); }
});

// ─── GET /api/sales/:id ───────────────────────────────────────────────────────
router.get('/:id', viewPerm, async (req, res, next) => {
  try {
    const sale = await prisma.sale.findUnique({
      where: { id: req.params.id },
      include: {
        items: { include: { product: { select: { nameAr: true, nameEn: true, barcode: true, costPrice: true } } } },
        payments: true,
        cashier: { select: { fullName: true } },
        customer: { select: { name: true, phone: true } },
      },
    });
    if (!sale) return res.status(404).json({ success: false, message: 'العملية غير موجودة' });
    res.json({ success: true, data: sale });
  } catch (err) { next(err); }
});

// ─── POST /api/sales/:id/void ─────────────────────────────────────────────────
router.post('/:id/void', requirePermission('sales.void'), async (req, res, next) => {
  try {
    const { businessId } = req.user;
    const { reason } = req.body;

    const sale = await prisma.sale.findUnique({ where: { id: req.params.id }, include: { items: true } });
    if (!sale) return res.status(404).json({ success: false, message: 'العملية غير موجودة' });
    if (sale.businessId !== businessId) return res.status(403).json({ success: false, message: 'غير مصرح' });
    if (sale.status === 'VOIDED') return res.status(400).json({ success: false, message: 'هذه العملية ملغية بالفعل' });

    await prisma.$transaction(async (tx) => {
      await tx.sale.update({
        where: { id: sale.id },
        data: { status: 'VOIDED', notes: `[إلغاء] ${reason || ''}`.trim() },
      });
      for (const item of sale.items) {
        const inv = await tx.inventory.findFirst({ where: { businessId, productId: item.productId } });
        if (inv) {
          const prev = Number(inv.currentStock);
          const newQty = prev + Number(item.quantity);
          await tx.inventory.update({ where: { id: inv.id }, data: { currentStock: newQty } });
          await tx.inventoryLog.create({ data: {
            businessId, productId: item.productId, changeType: 'RETURN',
            quantity: Number(item.quantity), previousQty: prev, newQty,
            referenceId: sale.id, note: 'إلغاء عملية بيع',
          }});
        }
      }
    });

    const updated = await prisma.sale.findUnique({
      where: { id: sale.id },
      include: { items: { include: { product: true } }, payments: true },
    });
    res.json({ success: true, data: updated, message: 'تم إلغاء العملية بنجاح' });
  } catch (err) { next(err); }
});

// ─── POST /api/sales/:id/return ───────────────────────────────────────────────
router.post('/:id/return', requirePermission('sales.return'), async (req, res, next) => {
  try {
    const { businessId, userId } = req.user;
    const { returnItems, reason } = req.body;

    if (!returnItems || !Array.isArray(returnItems) || returnItems.length === 0)
      return res.status(422).json({ success: false, message: 'حدد المنتجات المراد إرجاعها' });

    const originalSale = await prisma.sale.findUnique({
      where: { id: req.params.id },
      include: { items: true, payments: true },
    });
    if (!originalSale) return res.status(404).json({ success: false, message: 'العملية غير موجودة' });
    if (originalSale.businessId !== businessId) return res.status(403).json({ success: false, message: 'غير مصرح' });
    if (originalSale.status === 'VOIDED') return res.status(400).json({ success: false, message: 'لا يمكن الإرجاع من عملية ملغية' });

    // Calculate already-returned quantities per saleItem
    const prevReturns = await prisma.sale.findMany({
      where: { businessId, saleType: 'RETURN', notes: { contains: originalSale.id.slice(-8) } },
      include: { items: true },
    });
    const returnedQtyBySaleItemId = {};
    for (const rs of prevReturns) {
      for (const ri of rs.items) {
        returnedQtyBySaleItemId[ri.productId] = (returnedQtyBySaleItemId[ri.productId] || 0) + Number(ri.quantity);
      }
    }

    const returnSale = await prisma.$transaction(async (tx) => {
      let returnSubtotal = 0, returnTax = 0;
      const returnItemsData = [];

      for (const ri of returnItems) {
        const origItem = originalSale.items.find(i => i.id === ri.saleItemId);
        if (!origItem) continue;

        const alreadyReturned = returnedQtyBySaleItemId[origItem.productId] || 0;
        const maxReturnable = Number(origItem.quantity) - alreadyReturned;
        if (maxReturnable <= 0) continue;

        const qty = Math.min(Number(ri.quantity) || 1, maxReturnable);
        const lineTotal = Number(origItem.unitPrice) * qty;
        const lineTax = lineTotal * Number(origItem.taxRate);

        returnSubtotal += lineTotal;
        returnTax += lineTax;
        returnItemsData.push({
          productId: origItem.productId,
          quantity: qty,
          unitPrice: Number(origItem.unitPrice),
          taxRate: Number(origItem.taxRate),
          taxAmount: lineTax,
          discount: 0,
          total: lineTotal + lineTax,
        });

        // Restore stock
        const inv = await tx.inventory.findFirst({ where: { businessId, productId: origItem.productId } });
        if (inv) {
          const prev = Number(inv.currentStock);
          await tx.inventory.update({ where: { id: inv.id }, data: { currentStock: prev + qty } });
          await tx.inventoryLog.create({ data: {
            businessId, productId: origItem.productId, changeType: 'RETURN',
            quantity: qty, previousQty: prev, newQty: prev + qty,
            referenceId: req.params.id, note: reason || 'إرجاع منتج',
          }});
        }
      }

      if (returnItemsData.length === 0)
        throw Object.assign(new Error('لا توجد كميات قابلة للإرجاع'), { statusCode: 400 });

      const returnGrand = returnSubtotal + returnTax;
      const activeShift = await tx.shift.findFirst({ where: { businessId, status: 'OPEN' } });

      return tx.sale.create({
        data: {
          businessId, cashUserId: userId, shiftId: activeShift?.id || null,
          saleType: 'RETURN', status: 'COMPLETED',
          subtotal: returnSubtotal, taxAmount: returnTax, discount: 0,
          grandTotal: -returnGrand, amountPaid: -returnGrand, amountChange: 0,
          notes: `[إرجاع من فاتورة ${req.params.id.slice(-8)}] ${reason || ''}`.trim(),
          items: { create: returnItemsData },
          payments: { create: [{ method: originalSale.payments?.[0]?.method || 'CASH', amount: -returnGrand }] },
        },
        include: { items: { include: { product: true } }, payments: true },
      });
    });

    res.json({ success: true, data: returnSale, message: 'تم الإرجاع بنجاح' });
  } catch (err) { next(err); }
});

// ─── DELETE /api/sales/purge ──────────────────────────────────────────────────
router.delete('/purge', requirePermission('users.delete'), async (req, res, next) => {
  try {
    const { businessId } = req.user;
    const { before, confirm } = req.query;
    if (confirm !== 'CONFIRM_PURGE')
      return res.status(400).json({ success: false, message: 'أرسل confirm=CONFIRM_PURGE للتأكيد' });

    const where = { businessId };
    if (before) { const d = new Date(before); d.setHours(23,59,59,999); where.createdAt = { lte: d }; }

    const count = await prisma.sale.count({ where });
    if (count === 0) return res.json({ success: true, message: 'لا توجد سجلات للحذف', deleted: 0 });

    const saleIds = (await prisma.sale.findMany({ where, select: { id: true } })).map(s => s.id);
    await prisma.$transaction(async (tx) => {
      await tx.salePayment.deleteMany({ where: { saleId: { in: saleIds } } });
      await tx.saleItem.deleteMany({ where: { saleId: { in: saleIds } } });
      await tx.invoice.deleteMany({ where: { saleId: { in: saleIds } } });
      await tx.sale.deleteMany({ where: { id: { in: saleIds } } });
    });

    res.json({ success: true, message: `تم حذف ${count} سجل`, deleted: count });
  } catch (err) { next(err); }
});

// ─── createSale helper ────────────────────────────────────────────────────────
// SECURITY: Always fetch product price from DB — never trust client-supplied price.
// Validates modifier groups (required/min/max) server-side and stores OrderItemModifier snapshots.
async function createSale({ businessId, userId, shiftId, items, payments, discount = 0, notes, customerId, orderType, orderChannel }) {
  return prisma.$transaction(async (tx) => {
    let subtotal = 0, totalTax = 0;
    const saleItemsToCreate = [];

    for (const item of items) {
      const product = await tx.product.findUnique({ where: { id: item.productId } });
      if (!product)
        throw Object.assign(new Error(`المنتج غير موجود: ${item.productId}`), { statusCode: 400 });
      if (product.businessId !== businessId)
        throw Object.assign(new Error('منتج غير مصرح به'), { statusCode: 403 });

      const qty = Number(item.quantity);
      if (!qty || qty <= 0)
        throw Object.assign(new Error(`كمية غير صحيحة للمنتج ${product.nameAr}`), { statusCode: 422 });

      // ── Stock check ──
      const inv = await tx.inventory.findFirst({ where: { businessId, productId: item.productId } });
      if (product.trackStock !== false) {
        if (!inv || Number(inv.currentStock) < qty)
          throw Object.assign(new Error(`المخزون غير كافٍ للمنتج: ${product.nameAr} (متاح: ${inv ? Number(inv.currentStock) : 0})`), { statusCode: 400 });
      }

      // ── Modifiers: validate + price from DB ──
      const selectedOptionIds = Array.isArray(item.modifiers)
        ? item.modifiers.map(m => m.optionId).filter(Boolean)
        : [];

      let modifierDelta = 0;
      const modifierSnapshots = [];

      const groups = await tx.productModifierGroup.findMany({
        where: { productId: product.id, isActive: true },
        include: { options: true },
      });

      for (const g of groups) {
        const chosen = g.options.filter(o => selectedOptionIds.includes(o.id) && o.isAvailable);

        if (g.required && chosen.length < Math.max(1, g.minSelect))
          throw Object.assign(new Error(`يجب اختيار من المجموعة الإجبارية: ${g.nameAr}`), { statusCode: 422 });
        if (chosen.length < g.minSelect)
          throw Object.assign(new Error(`اختر ${g.minSelect} على الأقل من: ${g.nameAr}`), { statusCode: 422 });
        if (chosen.length > g.maxSelect)
          throw Object.assign(new Error(`الحد الأقصى ${g.maxSelect} خيارات في: ${g.nameAr}`), { statusCode: 422 });

        for (const o of chosen) {
          modifierDelta += Number(o.priceDelta);
          modifierSnapshots.push({
            optionId: o.id,
            groupName: g.nameAr,
            optionName: o.nameAr,
            priceDelta: Number(o.priceDelta),
            quantity: 1,
          });
        }
      }

      // Price ALWAYS from DB (base + verified modifier deltas)
      const unitPrice = Number(product.salePrice) + modifierDelta;
      const taxRate = Number(product.taxRate || 0.15);
      const itemDiscount = Number(item.discount || 0);
      const lineBase = unitPrice * qty - itemDiscount;
      const lineTax = lineBase * taxRate;

      subtotal += lineBase;
      totalTax += lineTax;

      saleItemsToCreate.push({
        data: {
          productId: item.productId,
          quantity: qty,
          unitPrice,
          taxRate,
          discount: itemDiscount,
          taxAmount: lineTax,
          total: lineBase + lineTax,
          notes: item.notes || null,
        },
        modifierSnapshots,
      });

      // Deduct stock
      if (product.trackStock !== false && inv) {
        const prev = Number(inv.currentStock);
        const newQty = prev - qty;
        await tx.inventory.update({ where: { id: inv.id }, data: { currentStock: newQty } });
        await tx.inventoryLog.create({ data: {
          businessId, productId: item.productId, changeType: 'SALE',
          quantity: qty, previousQty: prev, newQty, referenceId: 'pending', note: 'بيع',
        }});
      }
    }

    const discountAmount = Math.max(0, Number(discount));
    const grandTotal = Math.max(0, subtotal + totalTax - discountAmount);
    const totalPaid = payments.reduce((s, p) => s + Number(p.amount), 0);

    const sale = await tx.sale.create({
      data: {
        businessId, cashUserId: userId,
        customerId: customerId || null,
        shiftId: shiftId || null,
        saleType: 'STANDARD', status: 'COMPLETED',
        subtotal, taxAmount: totalTax,
        discount: discountAmount, grandTotal,
        amountPaid: totalPaid,
        amountChange: Math.max(0, totalPaid - grandTotal),
        notes: notes || null,
        orderType: orderType || null,
        orderChannel: orderChannel || null,
        payments: { create: payments.map(p => ({ method: p.method || 'CASH', amount: Number(p.amount) })) },
      },
    });

    for (const si of saleItemsToCreate) {
      const created = await tx.saleItem.create({ data: { saleId: sale.id, ...si.data } });
      if (si.modifierSnapshots.length) {
        await tx.orderItemModifier.createMany({
          data: si.modifierSnapshots.map(m => ({ saleItemId: created.id, ...m })),
        });
      }
    }

    await tx.inventoryLog.updateMany({
      where: { businessId, referenceId: 'pending' },
      data: { referenceId: sale.id },
    });

    return tx.sale.findUnique({
      where: { id: sale.id },
      include: {
        items: {
          include: {
            product: { select: { nameAr: true, nameEn: true, barcode: true } },
            orderModifiers: true,
          },
        },
        payments: true,
      },
    });
  });
}

module.exports = router;