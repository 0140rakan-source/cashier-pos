const prisma = require('../prisma');

async function list(businessId, { from, to } = {}) {
  const where = { businessId };
  if (from) where.createdAt = { gte: new Date(from) };
  if (to) where.createdAt.lte = new Date(to);
  return prisma.purchase.findMany({
    where,
    include: { supplier: true, items: { include: { product: true } }, creator: { select: { fullName: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

async function create(businessId, userId, data) {
  return prisma.$transaction(async (tx) => {
    const purchase = await tx.purchase.create({
      data: {
        businessId,
        supplierId: data.supplierId,
        reference: `PO-${Date.now().toString().slice(-8)}`,
        totalAmount: Number(data.totalAmount),
        taxAmount: Number(data.taxAmount || 0),
        discount: Number(data.discount || 0),
        grandTotal: Number(data.grandTotal),
        paymentMethod: data.paymentMethod || 'CASH',
        paymentStatus: data.paymentStatus || 'PAID',
        notes: data.notes || '',
        createdBy: userId,
        items: { create: data.items.map(i => ({
          productId: i.productId,
          quantity: Number(i.quantity),
          unitPrice: Number(i.unitPrice),
          total: Number(i.total),
        })) },
      },
      include: { items: { include: { product: true } } },
    });

    // Auto stock-in
    for (const item of data.items) {
      const inv = await tx.inventory.findFirst({ where: { businessId, productId: item.productId } });
      if (inv) {
        const qty = Number(item.quantity);
        const prev = inv.currentStock;
        await tx.inventory.update({ where: { id: inv.id }, data: { currentStock: prev + qty, lastRestockedAt: new Date() } });
        await tx.inventoryLog.create({
          data: { businessId, productId: item.productId, changeType: 'PURCHASE', quantity: qty, previousQty: prev, newQty: prev + qty },
        });
      }
    }

    return purchase;
  });
}

module.exports = { list, create };
