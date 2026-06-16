const prisma = require('../../prisma');

async function create(businessId, userId, shiftId, { items, discount, paymentMethod, amountPaid }) {
  return prisma.$transaction(async (tx) => {
    // Build sale items & calculate totals
    let subtotal = 0, taxTotal = 0;
    const saleItems = [];
    
    for (const i of items) {
      const inv = await tx.inventory.findUnique({ where: { productId: i.productId } });
      const product = await tx.product.findUnique({ where: { id: i.productId } });
      if (!inv) throw Object.assign(new Error(`Inventory not found for product ${i.productId}`), { statusCode: 400 });
      
      const qty = i.quantity || 1;
      const price = product.salePrice || 0;
      const tax = (price * qty) * (product.taxRate || 0.15);
      subtotal += price * qty;
      taxTotal += tax;
      
      saleItems.push({ productId: i.productId, quantity: qty, unitPrice: price, taxRate: product.taxRate || 0.15, taxAmount: tax, discount: 0, total: price * qty + tax });
      
      // Decrease stock
      await tx.inventory.update({ where: { id: inv.id }, data: { currentStock: inv.currentStock - qty } });
      await tx.inventoryLog.create({ data: { businessId, productId: i.productId, changeType: 'SALE', quantity: -qty, previousQty: inv.currentStock, newQty: inv.currentStock - qty, referenceId: 'sale-' + Date.now() } });
    }

    const grandTotal = subtotal + taxTotal - (discount || 0);
    const amtPaid = amountPaid || grandTotal;

    const sale = await tx.sale.create({
      data: {
        businessId, cashUserId: userId, shiftId, saleType: 'STANDARD', status: 'COMPLETED',
        subtotal, taxAmount: taxTotal, discount: discount || 0, grandTotal,
        amountPaid: amtPaid, amountChange: Math.max(0, amtPaid - grandTotal),
        items: { create: saleItems },
        payments: { create: [{ method: paymentMethod || 'CASH', amount: amtPaid }] },
      },
      include: { items: { include: { product: true } }, payments: true },
    });

    return sale;
  });
}

async function list(businessId) {
  return prisma.sale.findMany({
    where: { businessId, status: 'COMPLETED' },
    include: { cashier: { select: { fullName: true } }, shift: true, customer: true, items: { include: { product: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
}

module.exports = { create, list };
