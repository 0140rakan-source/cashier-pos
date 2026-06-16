const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const prisma = require('../prisma');

async function login({ username, password }) {
  const user = await prisma.user.findFirst({
    where: { username, isActive: true },
    include: { role: { include: { permissions: true } }, business: true },
  });

  if (!user) throw Object.assign(new Error('Invalid credentials'), { statusCode: 401, code: 'INVALID_CREDENTIALS' });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw Object.assign(new Error('Invalid credentials'), { statusCode: 401, code: 'INVALID_CREDENTIALS' });

  const payload = {
    userId: user.id,
    username: user.username,
    businessId: user.businessId,
    roleId: user.roleId,
    roleName: user.role.name,
    permissions: user.role.permissions.map(p => p.permission),
  };

  const token = jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expiresIn });

  return {
    user: {
      id: user.id,
      fullName: user.fullName,
      username: user.username,
      roleName: user.role.name,
      businessId: user.businessId,
      permissions: user.role.permissions.map(p => p.permission),
      business: { nameAr: user.business.nameAr, nameEn: user.business.nameEn },
    },
    token,
  };
}

async function loginWithPin({ pin }) {
  if (!pin || pin.length !== 4) throw Object.assign(new Error('PIN must be 4 digits'), { statusCode: 400, code: 'INVALID_PIN' });

  const user = await prisma.user.findFirst({
    where: { pin, isActive: true },
    include: { role: { include: { permissions: true } }, business: true },
  });

  if (!user) throw Object.assign(new Error('Invalid PIN'), { statusCode: 401, code: 'INVALID_PIN' });

  const payload = {
    userId: user.id,
    username: user.username,
    businessId: user.businessId,
    roleId: user.roleId,
    roleName: user.role.name,
    permissions: user.role.permissions.map(p => p.permission),
  };

  const token = jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expiresIn });

  return {
    user: {
      id: user.id, fullName: user.fullName, username: user.username,
      roleName: user.role.name, businessId: user.businessId,
      business: { nameAr: user.business.nameAr, nameEn: user.business.nameEn },
      permissions: user.role.permissions.map(p => p.permission),
    },
    token,
  };
}

async function getMe(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: { include: { permissions: true } }, business: true },
  });
  if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404, code: 'USER_NOT_FOUND' });

  return {
    id: user.id, fullName: user.fullName, username: user.username,
    roleName: user.role.name, businessId: user.businessId,
    business: { nameAr: user.business.nameAr, nameEn: user.business.nameEn },
    permissions: user.role.permissions.map(p => p.permission),
  };
}

module.exports = { login, loginWithPin, getMe };
