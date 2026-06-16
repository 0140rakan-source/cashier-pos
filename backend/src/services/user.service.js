const bcrypt = require('bcryptjs');
const prisma = require('../prisma');

async function list(businessId, { search, role, active } = {}) {
  const where = { businessId };
  if (search) where.OR = [
    { fullName: { contains: search, mode: 'insensitive' } },
    { username: { contains: search, mode: 'insensitive' } },
  ];
  if (role) where.roleId = role;
  if (active !== undefined) where.isActive = active;

  return prisma.user.findMany({
    where, include: { role: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

async function getById(id, businessId) {
  const user = await prisma.user.findFirst({
    where: { id, businessId },
    include: { role: { include: { permissions: { select: { permission: true } } } } },
  });
  if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404, code: 'USER_NOT_FOUND' });
  const { passwordHash, ...rest } = user;
  return { ...rest, permissions: user.role.permissions.map(p => p.permission) };
}

async function create(businessId, { fullName, username, password, roleId, pin }) {
  if (!password || String(password).trim().length < 6) {
    throw Object.assign(new Error('Password must be at least 6 characters'), { statusCode: 400, code: 'WEAK_PASSWORD' });
  }
  if (!username || String(username).trim().length < 2) {
    throw Object.assign(new Error('Username must be at least 2 characters'), { statusCode: 400, code: 'INVALID_USERNAME' });
  }
  const hash = await bcrypt.hash(String(password), 10);
  return prisma.user.create({
    data: { businessId, fullName, username: String(username).trim(), passwordHash: hash, roleId, pin: pin || null },
    include: { role: { select: { id: true, name: true } } },
  });
}

async function update(id, businessId, { fullName, username, roleId, pin, isActive, password }) {
  const d = {};
  if (fullName !== undefined) d.fullName = fullName;
  if (username !== undefined) d.username = username;
  if (roleId !== undefined) d.roleId = roleId;
  if (pin !== undefined) d.pin = pin;
  if (isActive !== undefined) d.isActive = isActive;
  if (password !== undefined && password.length >= 8) {
    d.passwordHash = await bcrypt.hash(password, 10);
  }
  const user = await prisma.user.update({ where: { id }, data: d, include: { role: { select: { id: true, name: true } } } });
  const { passwordHash, ...rest } = user;
  return rest;
}

async function changePassword(id, businessId, { currentPassword, newPassword }) {
  const user = await prisma.user.findFirst({ where: { id, businessId } });
  if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });
  if (currentPassword) {
    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) throw Object.assign(new Error('Current password incorrect'), { statusCode: 401, code: 'WRONG_PASSWORD' });
  }
  if (!newPassword || newPassword.length < 8)
    throw Object.assign(new Error('Password must be at least 8 characters'), { statusCode: 400 });
  const hash = await bcrypt.hash(newPassword, 10);
  return prisma.user.update({ where: { id }, data: { passwordHash: hash } });
}

async function deactivate(id, businessId) {
  return prisma.user.update({ where: { id, businessId }, data: { isActive: false } });
}

async function resetPin(id, businessId, pin) {
  return prisma.user.update({ where: { id, businessId }, data: { pin } });
}

module.exports = { list, getById, create, update, deactivate, resetPin, changePassword };
