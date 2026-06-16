const prisma = require('../prisma');

async function list(businessId) {
  return prisma.supplier.findMany({
    where: { businessId, isActive: true },
    orderBy: { name: 'asc' },
  });
}

async function create(businessId, data) {
  return prisma.supplier.create({ data: { businessId, ...data } });
}

async function update(id, businessId, data) {
  return prisma.supplier.update({ where: { id, businessId }, data });
}

async function remove(id, businessId) {
  return prisma.supplier.update({ where: { id, businessId }, data: { isActive: false } });
}

module.exports = { list, create, update, remove };
