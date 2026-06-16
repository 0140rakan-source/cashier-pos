const prisma = require('../prisma');

async function list(businessId, filter = {}) {
  return prisma.category.findMany({
    where: { businessId, ...(filter.businessMode && { businessMode: filter.businessMode }) },
    orderBy: { sortOrder: 'asc' },
  });
}

async function create(businessId, data) {
  return prisma.category.create({ data: { businessId, ...data } });
}

async function update(id, businessId, data) {
  return prisma.category.update({ where: { id, businessId }, data });
}

async function remove(id, businessId) {
  return prisma.category.delete({ where: { id, businessId } });
}

module.exports = { list, create, update, remove };