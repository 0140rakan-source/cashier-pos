const prisma = require('../prisma');

async function list(businessId) {
  return prisma.customer.findMany({
    where: { businessId },
    orderBy: { name: 'asc' },
  });
}

async function getById(id, businessId) {
  return prisma.customer.findFirst({ where: { id, businessId } });
}

async function create(businessId, data) {
  return prisma.customer.create({ data: { businessId, ...data } });
}

async function update(id, businessId, data) {
  return prisma.customer.update({ where: { id, businessId }, data });
}

async function remove(id, businessId) {
  return prisma.customer.delete({ where: { id, businessId } });
}

module.exports = { list, getById, create, update, remove };
