const prisma = require('../prisma');

async function list() {
  return prisma.role.findMany({ orderBy: { name: 'asc' }, include: { permissions: true } });
}
async function getById(id) {
  return prisma.role.findUnique({ where: { id }, include: { permissions: true } });
}
async function create({ name, description, permissions }) {
  return prisma.role.create({
    data: {
      name, description,
      permissions: { create: (permissions||[]).map(p => ({ permission: p })) }
    },
    include: { permissions: true },
  });
}
async function update(id, { name, description, permissions }) {
  return prisma.$transaction(async (tx) => {
    await tx.rolePermission.deleteMany({ where: { roleId: id } });
    return tx.role.update({
      where: { id },
      data: {
        name, description,
        permissions: { create: (permissions||[]).map(p => ({ permission: p })) }
      },
      include: { permissions: true },
    });
  });
}
async function deleteRole(id) {
  return prisma.role.delete({ where: { id } });
}

module.exports = { list, getById, create, update, deleteRole };