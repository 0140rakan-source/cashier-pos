const prisma = require('../prisma');

// Get all roles
async function getAll() {
  return prisma.role.findMany({ orderBy: { name: 'asc' } });
}

// Get role by ID
async function getById(id) {
  const role = await prisma.role.findUnique({
    where: { id },
    include: { permissions: { select: { permission: true } } },
  });
  if (!role) throw Object.assign(new Error('Role not found'), { statusCode: 404, code: 'ROLE_NOT_FOUND' });
  return { ...role, permissions: role.permissions.map(p => p.permission) };
}

// Create a new role
async function create({ name, description, permissions }) {
  // Basic validation: Ensure name is provided and not a system role name that is reserved
  if (!name || name.trim() === '') throw Object.assign(new Error('Role name is required'), { statusCode: 400, code: 'VALIDATION_ERROR' });
  if (['ADMIN', 'MANAGER', 'CASHIER'].includes(name.toUpperCase())) throw Object.assign(new Error('Cannot create system reserved role names'), { statusCode: 400, code: 'VALIDATION_ERROR' });

  // Check if role name already exists
  const existingRole = await prisma.role.findFirst({ where: { name: { equals: name, mode: 'insensitive' } } });
  if (existingRole) throw Object.assign(new Error('Role name already exists'), { statusCode: 409, code: 'ALREADY_EXISTS' });

  const role = await prisma.role.create({
    data: {
      name: name.trim(),
      description: description || '',
      permissions: {
        create: permissions.map(p => ({ permission: p })),
      },
    },
    include: { permissions: true },
  });

  return { ...role, permissions: role.permissions.map(p => p.permission) };
}

// Update a role
async function update(id, { name, description, permissions }) {
  // Check if the role to be updated is a system role
  const existingRole = await prisma.role.findUnique({ where: { id } });
  if (!existingRole) throw Object.assign(new Error('Role not found'), { statusCode: 404, code: 'ROLE_NOT_FOUND' });
  if (existingRole.isSystem) throw Object.assign(new Error('Cannot update system roles'), { statusCode: 400, code: 'BAD_REQUEST' });

  // Basic validation
  if (!name || name.trim() === '') throw Object.assign(new Error('Role name is required'), { statusCode: 400, code: 'VALIDATION_ERROR' });
  if (['ADMIN', 'MANAGER', 'CASHIER'].includes(name.toUpperCase())) throw Object.assign(new Error('Cannot update to reserved role names'), { statusCode: 400, code: 'VALIDATION_ERROR' });

  // Check if the new name conflicts with another role
  if (name.trim().toLowerCase() !== existingRole.name.toLowerCase()) {
    const nameConflict = await prisma.role.findFirst({ where: { name: { equals: name, mode: 'insensitive' } } });
    if (nameConflict) throw Object.assign(new Error('Role name already exists'), { statusCode: 409, code: 'ALREADY_EXISTS' });
  }

  // Use a transaction to update role and its permissions
  return prisma.$transaction(async (tx) => {
    await tx.rolePermission.deleteMany({ where: { roleId: id } }); // Delete old permissions
    const updatedRole = await tx.role.update({
      where: { id },
      data: {
        name: name.trim(),
        description: description || '',
        permissions: {
          create: permissions.map(p => ({ permission: p })),
        },
      },
      include: { permissions: true },
    });

    return { ...updatedRole, permissions: updatedRole.permissions.map(p => p.permission) };
  });
}

// Delete a role
async function deleteRole(id) {
  const role = await prisma.role.findUnique({ where: { id } });
  if (!role) throw Object.assign(new Error('Role not found'), { statusCode: 404, code: 'ROLE_NOT_FOUND' });
  if (role.isSystem) throw Object.assign(new Error('Cannot delete system roles'), { statusCode: 400, code: 'BAD_REQUEST' });

  // Check if any users are assigned to this role
  const usersInRole = await prisma.user.findFirst({ where: { roleId: id } });
  if (usersInRole) throw Object.assign(new Error('Cannot delete role that is assigned to users'), { statusCode: 409, code: 'CONFLICT' });

  await prisma.$transaction(async (tx) => {
    await tx.rolePermission.deleteMany({ where: { roleId: id } });
    await tx.role.delete({ where: { id } });
  });
}

module.exports = { getAll, getById, create, update, deleteRole };
