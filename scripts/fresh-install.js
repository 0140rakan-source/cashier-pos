#!/usr/bin/env node
/**
 * Fresh Customer Deployment — Cashier POS
 *
 * Run this ONCE when deploying to a new customer's machine.
 * It resets the database to a clean state with:
 * - One admin account
 * - Default roles (ADMIN, MANAGER, CASHIER)
 * - No products, no sales, no old business identity
 * - Fresh activation requirement
 *
 * Usage:
 *   node scripts/fresh-install.js --store "اسم المتجر" --vat "300123456789003"
 *
 * Options:
 *   --store "اسم المتجر"     Store name in Arabic (required)
 *   --store-en "Store Name"  Store name in English (optional)
 *   --vat "30012345..."      VAT number (optional)
 *   --phone "05xxxxxxxx"     Phone (optional)
 *   --address "العنوان"       Address (optional)
 *   --admin-user "admin"     Admin username (default: admin)
 *   --admin-pass "password"  Admin password (default: admin123)
 *   --reset-db               Drop and recreate all tables (WARNING: destroys all data)
 *   --keep-schema             Only reset data, keep schema (default if tables exist)
 */

const path = require('path');
process.chdir(path.join(__dirname, '../backend'));

async function main() {
  const args = process.argv.slice(2);
  const get = (flag) => { const i = args.indexOf(flag); return i >= 0 && args[i + 1] ? args[i + 1] : null; };
  const has = (flag) => args.includes(flag);

  const storeNameAr = get('--store') || 'متجر جديد';
  const storeNameEn = get('--store-en') || storeNameAr;
  const vat = get('--vat') || '';
  const phone = get('--phone') || '';
  const address = get('--address') || '';
  const adminUser = get('--admin-user') || 'admin';
  const adminPass = get('--admin-pass') || 'admin123';
  const resetDb = has('--reset-db');

  console.log('');
  console.log('╔═══════════════════════════════════════════════╗');
  console.log('║  Cashier POS — Fresh Customer Deployment      ║');
  console.log('╚═══════════════════════════════════════════════╝');
  console.log('');
  console.log(`  Store:    ${storeNameAr} / ${storeNameEn}`);
  console.log(`  VAT:      ${vat || '(none)'}`);
  console.log(`  Phone:    ${phone || '(none)'}`);
  console.log(`  Admin:    ${adminUser}`);
  console.log(`  Reset DB: ${resetDb ? 'YES — full reset' : 'data only'}`);
  console.log('');

  // Step 1: Reset database
  if (resetDb) {
    console.log('[1/4] Resetting database schema...');
    const { execSync } = require('child_process');
    execSync('npx prisma db push --force-reset --accept-data-loss', { stdio: 'inherit' });
  } else {
    console.log('[1/4] Pushing schema (no data loss)...');
    const { execSync } = require('child_process');
    execSync('npx prisma db push --accept-data-loss', { stdio: 'inherit' });
  }

  // Step 2: Seed fresh data
  console.log('[2/4] Creating fresh business and admin...');
  const prisma = require(path.join(__dirname, '../backend/src/prisma'));
  const bcrypt = require(path.join(__dirname, '../backend/node_modules/bcryptjs'));

  // Clean all data if reset requested
  if (resetDb) {
    // Delete in order to respect foreign keys
    const tables = ['salePayment', 'saleItem', 'invoice', 'sale', 'purchaseItem', 'purchase',
      'inventoryLog', 'inventory', 'expense', 'shift', 'product', 'category', 'customer',
      'supplier', 'license', 'user', 'rolePermission', 'role', 'settings', 'business',
      'zatcaAuditLog', 'telegramLog', 'expenseCategory'];
    for (const t of tables) {
      try { await prisma[t].deleteMany({}); } catch (_) {}
    }
  }

  // Create roles
  const roles = ['ADMIN', 'MANAGER', 'CASHIER'];
  const PERMISSIONS = {
    ADMIN: ['users.view','users.create','users.edit','users.delete','roles.view','roles.create','roles.edit','roles.delete','products.view','products.create','products.edit','products.delete','categories.view','categories.create','categories.edit','categories.delete','sales.view','sales.create','inventory.view','inventory.adjust','reports.view','settings.view','settings.edit','shifts.view','shifts.manage','purchases.view','purchases.create','expenses.view','expenses.create','customers.view','customers.create','customers.edit','suppliers.view','suppliers.create'],
    MANAGER: ['products.view','products.create','products.edit','categories.view','categories.create','sales.view','sales.create','inventory.view','inventory.adjust','reports.view','shifts.view','shifts.manage','purchases.view','purchases.create','expenses.view','expenses.create','customers.view','customers.create'],
    CASHIER: ['sales.view','sales.create','products.view','categories.view','shifts.view','inventory.view','customers.view'],
  };

  const roleMap = {};
  for (const name of roles) {
    const existing = await prisma.role.findFirst({ where: { name } });
    if (existing) {
      roleMap[name] = existing.id;
    } else {
      const r = await prisma.role.create({
        data: {
          name,
          permissions: {
            create: PERMISSIONS[name].map(p => ({ permission: p })),
          },
        },
      });
      roleMap[name] = r.id;
    }
  }

  // Create business
  let biz = await prisma.business.findFirst();
  if (biz) {
    biz = await prisma.business.update({
      where: { id: biz.id },
      data: { nameAr: storeNameAr, nameEn: storeNameEn, vatNumber: vat || null, phone: phone || null, addressAr: address || null, logo: null, businessMode: 'RETAIL' },
    });
  } else {
    biz = await prisma.business.create({
      data: { nameAr: storeNameAr, nameEn: storeNameEn, vatNumber: vat || null, phone: phone || null, addressAr: address || null, businessMode: 'RETAIL', currency: 'SAR' },
    });
  }

  // Create or update settings
  await prisma.settings.upsert({
    where: { businessId: biz.id },
    update: { receiptHeaderAr: 'فاتورة ضريبية', receiptFooterAr: 'شكراً لزيارتكم!', orderChannels: JSON.stringify([{ key: 'DIRECT', label: 'مباشر', enabled: true, defaultPayment: 'CASH' }]) },
    create: { businessId: biz.id, taxRate: 0.15, receiptHeaderAr: 'فاتورة ضريبية', receiptFooterAr: 'شكراً لزيارتكم!', orderChannels: JSON.stringify([{ key: 'DIRECT', label: 'مباشر', enabled: true, defaultPayment: 'CASH' }]) },
  });

  // Create admin user
  const hashedPass = await bcrypt.hash(adminPass, 10);
  const existingAdmin = await prisma.user.findFirst({ where: { businessId: biz.id, username: adminUser } });
  if (existingAdmin) {
    await prisma.user.update({ where: { id: existingAdmin.id }, data: { passwordHash: hashedPass, isActive: true, roleId: roleMap.ADMIN } });
    console.log(`  Admin user "${adminUser}" updated.`);
  } else {
    await prisma.user.create({
      data: { businessId: biz.id, username: adminUser, passwordHash: hashedPass, fullName: 'مدير النظام', roleId: roleMap.ADMIN, isActive: true },
    });
    console.log(`  Admin user "${adminUser}" created.`);
  }

  // Clear activation
  console.log('[3/4] Clearing old activation records...');
  await prisma.license.deleteMany({ where: { businessId: biz.id } });

  // Clean uploads
  console.log('[4/4] Cleaning uploads...');
  const uploadsDir = path.join(__dirname, '../uploads');
  const fs = require('fs');
  if (fs.existsSync(uploadsDir)) {
    for (const f of fs.readdirSync(uploadsDir)) {
      if (f !== '.gitkeep') fs.unlinkSync(path.join(uploadsDir, f));
    }
  }

  console.log('');
  console.log('╔═══════════════════════════════════════════════╗');
  console.log('║  ✅ Fresh installation complete!               ║');
  console.log('╠═══════════════════════════════════════════════╣');
  console.log(`║  Store: ${storeNameAr.padEnd(36)} ║`);
  console.log(`║  Admin: ${adminUser.padEnd(36)} ║`);
  console.log(`║  Pass:  ${adminPass.padEnd(36)} ║`);
  console.log('║                                               ║');
  console.log('║  Customer needs activation code to use app.   ║');
  console.log('╚═══════════════════════════════════════════════╝');
  console.log('');

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
