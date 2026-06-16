const express = require('express');
const { authenticate, requirePermission } = require('../../middleware/auth');
const prisma = require('../../prisma');
const router = express.Router();
router.use(authenticate);

// Purchases — admin/manager only
router.get('/', requirePermission('purchases.view'), async (req, res, next) => {
  try {
    const data = await prisma.purchase.findMany({
      where: { businessId: req.user.businessId },
      include: { supplier: true, items: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data });
  } catch (e) { next(e); }
});

router.post('/', requirePermission('purchases.create'), async (req, res, next) => {
  try {
    const { businessId, userId } = req.user;
    const { supplierId, paymentMethod, paymentStatus, notes, totalAmount, taxAmount, grandTotal, items } = req.body;

    if (!supplierId) return res.status(422).json({ success: false, message: 'supplierId required' });
    if (!items || items.length === 0) return res.status(422).json({ success: false, message: 'items required' });

    // Generate reference number
    const ref = 'PO-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + Date.now().toString().slice(-4);

    const purchase = await prisma.$transaction(async (tx) => {
      const p = await tx.purchase.create({
        data: {
          businessId,
          supplierId,
          reference: ref,
          totalAmount: Number(totalAmount) || 0,
          taxAmount: Number(taxAmount) || 0,
          discount: 0,
          grandTotal: Number(grandTotal) || 0,
          paymentMethod: paymentMethod || 'CASH',
          paymentStatus: paymentStatus || 'PAID',
          notes: notes || null,
          createdBy: userId,
          items: {
            create: items.map(i => ({
              productId: i.productId,
              quantity: Number(i.quantity) || 1,
              unitPrice: Number(i.unitPrice) || 0,
              total: (Number(i.quantity) || 1) * (Number(i.unitPrice) || 0),
            })),
          },
        },
        include: { items: true },
      });

      // Update inventory for each item
      for (const item of items) {
        const qty = Number(item.quantity) || 1;
        const inv = await tx.inventory.findFirst({ where: { businessId, productId: item.productId } });
        if (inv) {
          const prev = Number(inv.currentStock);
          const newQty = prev + qty;
          await tx.inventory.update({ where: { id: inv.id }, data: { currentStock: newQty, lastRestockedAt: new Date() } });
          await tx.inventoryLog.create({
            data: { businessId, productId: item.productId, changeType: 'PURCHASE', quantity: qty, previousQty: prev, newQty, referenceId: p.id },
          });
        }
      }

      return p;
    });

    res.status(201).json({ success: true, data: purchase });
  } catch (e) { next(e); }
});

router.put('/:id', requirePermission('purchases.edit'), async (req, res, next) => {
  try {
    const p = await prisma.purchase.update({
      where: { id: req.params.id },
      data: { paymentStatus: req.body.paymentStatus, notes: req.body.notes },
    });
    res.json({ success: true, data: p });
  } catch (e) { next(e); }
});

module.exports = router;
