require('dotenv').config({ path: __dirname + '/../.env' });
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function seed() {
  console.log('🌱 Seeding...\n');

  try {
    // 1. Business
    const business = await prisma.business.create({
      data: {
        nameAr: 'متجر الكاشير', nameEn: 'Cashier Store',
        vatNumber: '300123456789003', crNumber: '1234567890',
        addressAr: 'شارع الملك فهد، المدينة', addressEn: 'King Fahd Road, Medina',
        phone: '+966512345678', email: 'info@cashier.local',
        businessMode: 'RETAIL', currency: 'SAR',
      },
    });
    console.log('✓ Business');

    // 2. Settings
    await prisma.settings.create({
      data: {
        businessId: business.id, language: 'ar',
        receiptHeaderAr: 'فاتورة ضريبية', receiptHeaderEn: 'Tax Invoice',
        receiptFooterAr: 'شكراً لزيارتكم!', receiptFooterEn: 'Thank you!',
        taxRate: 0.15, lowStockThreshold: 5,
        defaultPaymentMethod: 'CASH', autoPrintReceipt: true, zatcaPhase: 'NONE',
      },
    });
    console.log('✓ Settings');

    // 3. Roles
    const adminRole = await prisma.role.create({
      data: { name: 'ADMIN', isSystem: true, description: 'Full system access' },
    });
    const managerRole = await prisma.role.create({
      data: { name: 'MANAGER', isSystem: true, description: 'Management' },
    });
    const cashierRole = await prisma.role.create({
      data: { name: 'CASHIER', isSystem: true, description: 'POS access' },
    });
    console.log('✓ Roles');

    // 4. Permissions
    // ADMIN - full access
    const adminPerms = [
      'products.view','products.create','products.edit','products.delete',
      'sales.view','sales.create','sales.void','sales.return',
      'reports.view',
      'users.view','users.create','users.edit','users.delete',
      'roles.view','roles.create','roles.edit','roles.delete',
      'inventory.view','inventory.adjust',
      'settings.view','settings.edit',
      'categories.view','categories.create','categories.edit','categories.delete',
      'customers.view','customers.create','customers.edit','customers.delete',
      'suppliers.view','suppliers.create',
      'purchases.view','purchases.create',
      'expenses.view','expenses.create','expenses.delete',
      'shifts.view','shifts.manage',
    ];
    // MANAGER - all except users.delete and roles.edit
    const managerPerms = [
      'products.view','products.create','products.edit','products.delete',
      'sales.view','sales.create','sales.void',
      'reports.view',
      'users.view','users.create','users.edit',
      'roles.view',
      'inventory.view','inventory.adjust',
      'settings.view',
      'categories.view','categories.create','categories.edit',
      'customers.view','customers.create','customers.edit',
      'suppliers.view','suppliers.create',
      'purchases.view','purchases.create',
      'expenses.view','expenses.create',
      'shifts.view','shifts.manage',
    ];
    // CASHIER - POS only
    const cashierPerms = [
      'sales.create', 'sales.view',
      'products.view', 'products.barcode',
      'customers.view', 'customers.create',
      'shifts.view', 'shifts.manage',
      'categories.view',
    ];

    await prisma.rolePermission.createMany({
      data: adminPerms.map(p => ({ roleId: adminRole.id, permission: p })),
    });
    await prisma.rolePermission.createMany({
      data: managerPerms.map(p => ({ roleId: managerRole.id, permission: p })),
    });
    await prisma.rolePermission.createMany({
      data: cashierPerms.map(p => ({ roleId: cashierRole.id, permission: p })),
    });
    console.log('✓ Permissions');

    // 5. Users
    const adminHash = await bcrypt.hash('admin123', 10);
    const cashierHash = await bcrypt.hash('1234', 10);
    await prisma.user.create({
      data: { businessId: business.id, roleId: adminRole.id, fullName: 'مدير النظام', username: 'admin', passwordHash: adminHash, pin: '0000' },
    });
    await prisma.user.create({
      data: { businessId: business.id, roleId: cashierRole.id, fullName: 'كاشير تجريبي', username: 'cashier', passwordHash: cashierHash, pin: '1234' },
    });
    console.log('✓ Users (admin/admin123, cashier/1234)');

    // 6. Categories
    await prisma.category.createMany({
      data: [
        { businessId: business.id, nameAr: 'مشروبات', nameEn: 'Beverages', sortOrder: 1 },
        { businessId: business.id, nameAr: 'وجبات رئيسية', nameEn: 'Main Courses', sortOrder: 2 },
        { businessId: business.id, nameAr: 'حلويات', nameEn: 'Desserts', sortOrder: 3 },
        { businessId: business.id, nameAr: 'إضافات', nameEn: 'Add-ons', sortOrder: 4 },
      ],
    });
    console.log('✓ Categories');

    // 7. Products + Inventory
    const categories = await prisma.category.findMany({ where: { businessId: business.id } });
    const beverage = categories.find(c => c.nameEn === 'Beverages');
    const mains = categories.find(c => c.nameEn === 'Main Courses');
    const desserts = categories.find(c => c.nameEn === 'Desserts');

    const productData = [
      { cat: beverage, nameAr: 'ماء', nameEn: 'Water', price: 2, stock: 100 },
      { cat: beverage, nameAr: 'عصير برتقال', nameEn: 'Orange Juice', price: 12, stock: 50 },
      { cat: beverage, nameAr: 'قهوة عربية', nameEn: 'Arabic Coffee', price: 15, stock: 30 },
      { cat: mains, nameAr: 'كبسة دجاج', nameEn: 'Chicken Kabsa', price: 45, stock: 20 },
      { cat: mains, nameAr: 'برغر لحم', nameEn: 'Beef Burger', price: 35, stock: 25 },
      { cat: desserts, nameAr: 'كنافة', nameEn: 'Kunafa', price: 20, stock: 15 },
      { cat: desserts, nameAr: 'بسبوسة', nameEn: 'Basbousa', price: 10, stock: 40 },
    ];

    for (const pd of productData) {
      const product = await prisma.product.create({
        data: {
          businessId: business.id, categoryId: pd.cat.id,
          nameAr: pd.nameAr, nameEn: pd.nameEn,
          salePrice: pd.price, costPrice: pd.price * 0.6,
          taxRate: 0.15, trackStock: true, isActive: true,
        },
      });
      await prisma.inventory.create({
        data: {
          businessId: business.id, productId: product.id,
          currentStock: pd.stock, minStock: 5,
          unit: 'piece', lastRestockedAt: new Date(),
        },
      });
    }
    console.log(`✓ ${productData.length} Products + Inventory`);

    // 8. Sample Customer
    await prisma.customer.create({
      data: { businessId: business.id, name: 'محمد أحمد', phone: '0555123456' },
    });
    await prisma.customer.create({
      data: { businessId: business.id, name: 'فاطمة علي', phone: '0555654321', email: 'f@demo.com' },
    });
    console.log('✓ Customers');

    // 9. Sample Supplier
    await prisma.supplier.create({
      data: { businessId: business.id, name: 'شركة التوريد السريع', phone: '0123456789' },
    });
    console.log('✓ Suppliers');

    // 10. License seed
    await prisma.license.upsert({
      where: { key: 'CLAW-2026-TEST-0001' },
      create: { key: 'CLAW-2026-TEST-0001', isActive: false },
      update: {},
    });
    console.log('✓ License (CLAW-2026-TEST-0001)');

    console.log('\n✅ Seeding complete!\n');
  } catch (error) {
    console.error('❌ Seed error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

seed();
