const prisma = require('../prisma');

async function list(businessId, filter = {}) {
  const where = { businessId };

  if (filter.categoryId) where.categoryId = filter.categoryId;

  if (filter.search) {
    where.OR = [
      { nameAr: { contains: filter.search, mode: 'insensitive' } },
      { nameEn: { contains: filter.search, mode: 'insensitive' } },
      { barcode: { contains: filter.search, mode: 'insensitive' } },
      { sku: { contains: filter.search, mode: 'insensitive' } },
    ];
  }

  // Default: show only active products unless explicitly asked for all/inactive
  if (filter.active === 'false') {
    where.isActive = false;
  } else if (filter.active === 'all') {
    // no filter — show everything
  } else {
    where.isActive = true; // default: active only
  }

  return prisma.product.findMany({
    where,
    include: { category: true, inventory: true },
    orderBy: { nameAr: 'asc' },
  });
}

async function getById(id, businessId) {
  return prisma.product.findFirst({
    where: { id, businessId },
    include: { category: true, inventory: true },
  });
}

async function create(businessId, data) {
  const { openingStock, ...productData } = data;

  // Validate barcode uniqueness within business if provided
  if (productData.barcode && productData.barcode.trim()) {
    const existing = await prisma.product.findFirst({
      where: { businessId, barcode: productData.barcode.trim(), isActive: true },
    });
    if (existing) {
      const err = new Error('هذا الباركود مستخدم بالفعل لمنتج آخر / Barcode already in use');
      err.statusCode = 409;
      throw err;
    }
  }

  // categoryId is required in schema — auto-create "عام / General" category if none given
  if (!productData.categoryId) {
    let general = await prisma.category.findFirst({ where: { businessId, nameEn: 'General' } });
    if (!general) {
      general = await prisma.category.create({
        data: { businessId, nameAr: 'عام', nameEn: 'General', sortOrder: 999 },
      });
    }
    productData.categoryId = general.id;
  }

  // Create product + inventory record in a transaction
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.create({
      data: {
        businessId,
        ...productData,
        barcode: productData.barcode?.trim() || null,
      },
      include: { category: true },
    });

    // Auto-create inventory record if trackStock is true
    if (productData.trackStock !== false) {
      const stockQty = Number(openingStock) || 0;
      await tx.inventory.create({
        data: {
          businessId,
          productId: product.id,
          currentStock: stockQty,
          minStock: 5,
          unit: 'piece',
          lastRestockedAt: stockQty > 0 ? new Date() : null,
        },
      });

      // Log the opening stock if > 0
      if (stockQty > 0) {
        await tx.inventoryLog.create({
          data: {
            businessId,
            productId: product.id,
            changeType: 'IN',
            quantity: stockQty,
            previousQty: 0,
            newQty: stockQty,
            note: 'مخزون افتتاحي / Opening stock',
          },
        });
      }
    }

    return { ...product, inventory: { currentStock: Number(openingStock) || 0 } };
  });
}

async function update(id, businessId, data) {
  const { openingStock, ...updateData } = data;

  // Validate barcode uniqueness if changed
  if (updateData.barcode && updateData.barcode.trim()) {
    const existing = await prisma.product.findFirst({
      where: {
        businessId,
        barcode: updateData.barcode.trim(),
        isActive: true,
        NOT: { id },
      },
    });
    if (existing) {
      const err = new Error('هذا الباركود مستخدم بالفعل لمنتج آخر / Barcode already in use');
      err.statusCode = 409;
      throw err;
    }
  }

  if (updateData.barcode !== undefined) {
    updateData.barcode = updateData.barcode?.trim() || null;
  }

  return prisma.product.update({
    where: { id },
    data: updateData,
    include: { category: true, inventory: true },
  });
}

/**
 * Archive: always deactivates (isActive = false).
 */
async function archive(id, businessId) {
  const product = await prisma.product.findFirst({ where: { id, businessId } });
  if (!product) {
    const err = new Error('المنتج غير موجود'); err.statusCode = 404; throw err;
  }
  await prisma.product.update({ where: { id }, data: { isActive: false } });
  return { archived: true, message: 'تم أرشفة المنتج بنجاح' };
}

/**
 * Hard delete:
 * - If product has sales or purchases → BLOCK with clear error
 * - If no protected history → hard delete (product + inventory + logs)
 */
async function remove(id, businessId, force = false) {
  const product = await prisma.product.findFirst({ where: { id, businessId } });
  if (!product) {
    const err = new Error('المنتج غير موجود'); err.statusCode = 404; throw err;
  }

  const [saleItemCount, purchaseItemCount] = await Promise.all([
    prisma.saleItem.count({ where: { productId: id } }),
    prisma.purchaseItem.count({ where: { productId: id } }),
  ]);

  const hasHistory = saleItemCount > 0 || purchaseItemCount > 0;

  if (hasHistory) {
    const err = new Error('لا يمكن حذف هذا المنتج نهائياً — لديه سجل مبيعات أو مشتريات. استخدم الأرشفة بدلاً.');
    err.statusCode = 409;
    err.hasHistory = true;
    err.saleCount = saleItemCount;
    err.purchaseCount = purchaseItemCount;
    throw err;
  }

  await prisma.$transaction(async (tx) => {
    await tx.inventoryLog.deleteMany({ where: { productId: id } });
    await tx.inventory.deleteMany({ where: { productId: id } });
    await tx.product.delete({ where: { id } });
  });
  return { hardDeleted: true, message: 'تم حذف المنتج نهائياً' };
}

module.exports = { list, getById, create, update, archive, remove };
