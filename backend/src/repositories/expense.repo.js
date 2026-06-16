const prisma = require('../prisma');

async function list(businessId) {
  return prisma.expenseCategory.findMany({ where: { businessId } });
}

async function listExpenses(businessId, from, to) {
  const where = { businessId };
  if (from && to) where.createdAt = { gte: new Date(from), lte: new Date(to) };
  return prisma.expense.findMany({ where, orderBy: { createdAt: 'desc' }, take: 200 });
}

async function add(businessId, userId, { amount, description, categoryId }) {
  return prisma.expense.create({
    data: { businessId, userId, amount: Number(amount), description, categoryId: categoryId || null },
  });
}

module.exports = { list, listExpenses, add };