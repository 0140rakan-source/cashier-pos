const prisma = require('../prisma');

async function create(businessId, userId, { shiftId, customerId, items, payments, notes, discount, tableNumber, orderType }) {
  return prisma.$transaction(async (tx) => {
    let subtotal = 0;
    let totalTax = 0;
    for (const item of items) {
      const itemSubtotal = Number(item.unitPrice) * Number(item.quantity);
      const itemTax = itemSubtotal * Number(item.taxRate || 0.15);
      subtotal += itemSubtotal;
      totalTax += itemTax;
    }
    discount = Number(discount || 0);
    const grandTotal = subtotal + totalTax - discount;

    let totalPaid = 0;
    for (const p of payments) totalPaid += Number(p.amount);
    if (totalPaid < grandTotal - 0.01) throw Object.assign(new Error('Insufficient payment'), { statusCode: 400, code: 'INSUFFICIENT_PAYMENT' });

    const sale = await tx.sale.create({
      data: {
        businessId, shiftId: shiftId || null, customerId: customerId || null,
        cashUserId: userId, saleType: 'STANDARD', status: 'COMPLETED',
        subtotal, taxAmount: totalTax, discount, grandTotal,
        amountPaid: totalPaid,
        amountChange: totalPaid - grandTotal,
        notes, tableNumber, orderType,
        items: { create: items.map(i => ({
          productId: i.productId, quantity: Number(i.quantity), unitPrice: Number(i.unitPrice),
          taxRate: Number(i.taxRate || 0.15),
          taxAmount: Number(i.quantity) * Number(i.unitPrice) * Number(i.taxRate || 0.15),
          discount: Number(i.discount || 0),
          total: Number(i.quantity) * Number(i.unitPrice) * (1 + Number(i.taxRate || 0.15)) - Number(i.discount || 0),
        })) },
        payments: { create: payments.map(p => ({ method: p.method, amount: Number(p.amount), referenceNo: p.referenceNo || null })) },
      },
      include: { items: { include: { product: true } }, payments: true, customer: true },
    });

    // Decrement inventory for each sold product
    for (const item of sale.items) {
      if (item.product.trackStock !== false) {
        const inv = await tx.inventory.findFirst({ where: { businessId, productId: item.productId } });
        if (inv) {
          const prev = inv.currentStock;
          const newQty = prev - Number(item.quantity);
          await tx.inventory.update({ where: { id: inv.id }, data: { currentStock: newQty } });
          await tx.inventoryLog.create({
            data: { businessId, productId: item.productId, changeType: 'SALE', quantity: -Number(item.quantity), previousQty: prev, newQty: newQty, referenceId: sale.id },
          });
        }
      }
    }

    return sale;
  });
}

async function list(businessId, { from, to } = {}) {
  const where = { businessId };
  if (from || to) where.createdAt = {};
  if (from) where.createdAt.gte = new Date(from);
  if (to) where.createdAt.lte = new Date(to);

  return prisma.sale.findMany({
    where, orderBy: { createdAt: 'desc' }, take: 100,
    include: { cashier: { select: { fullName: true } }, items: { include: { product: true } } },
  });
}

async function getById(id, businessId) {
  return prisma.sale.findFirst({
    where: { id, businessId },
    include: { items: { include: { product: true } }, payments: true, customer: true, cashier: { select: { fullName: true } } },
  });
}

async function returnSale(saleId, businessId, userId, { reason } = {}) {
  return prisma.sale.update({
    where: { id: saleId },
    data: { status: 'VOIDED', notes: reason || 'Returned' },
  });
}

module.exports = { create, list, getById, returnSale };
