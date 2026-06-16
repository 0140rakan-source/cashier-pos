const prisma = require('../prisma');

async function open(businessId, userId, { startingCash, notes }) {
  // Close any open shifts first
  await prisma.shift.updateMany({ where: { businessId, userId, status: 'OPEN' }, data: { status: 'CLOSED' } });
  
  return prisma.shift.create({
    data: { businessId, userId, startingCash: Number(startingCash), notes: notes || '' },
  });
}

async function close(shiftId, userId, { endingCash, notes }) {
  const shift = await prisma.shift.findFirst({ where: { id: shiftId, userId, status: 'OPEN' } });
  if (!shift) throw Object.assign(new Error('Shift not found'), { statusCode: 404 });

  const sales = await prisma.sale.findMany({
    where: { shiftId, status: 'COMPLETED' },
    select: { grandTotal: true },
  });

  const totalSales = sales.reduce((sum, s) => sum + Number(s.grandTotal), 0);
  const expectedCash = Number(shift.startingCash) + totalSales;
  const variance = Number(endingCash) - expectedCash;

  return prisma.shift.update({
    where: { id: shiftId },
    data: { closedAt: new Date(), endingCash: Number(endingCash), expectedCash, variance, notes: notes || '', status: 'CLOSED' },
  });
}

async function list(businessId, { userId } = {}) {
  const where = { businessId };
  if (userId) where.userId = userId;
  return prisma.shift.findMany({
    where,
    include: { user: { select: { fullName: true } }, sales: { select: { grandTotal: true, saleType: true } } },
    orderBy: { openedAt: 'desc' },
    take: 50,
  });
}

module.exports = { open, close, list };
