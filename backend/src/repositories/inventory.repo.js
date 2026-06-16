const prisma = require('../../prisma');

async function list(businessId) {
  return prisma.inventory.findMany({
    where: { businessId },
    include: { product: true },
  });
}

async function adjust(businessId, productId, change, note) {
  return prisma.$transaction(async (tx) => {
    const inv = await tx.inventory.findFirst({ where: { businessId, productId } });
    if (!inv) throw Object.assign(new Error('Inventory not found'), { statusCode: 404 });
    const prev = inv.currentStock;
    const next = prev + change;
    await tx.inventory.update({ where: { id: inv.id }, data: { currentStock: next } });
    await tx.inventoryLog.create({
      data: { businessId, productId, changeType: change > 0 ? 'IN' : 'OUT', quantity: change, previousQty: prev, newQty: next, note },
    });
  });
}

module.exports = { list, adjust };