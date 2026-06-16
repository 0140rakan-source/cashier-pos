const express = require('express');
const { authenticate, requirePermission } = require('../../middleware/auth');
const prisma = require('../../prisma');
const router = express.Router();
router.use(authenticate);

const editPerm = requirePermission('products.edit');

// ─── GET /api/modifier-groups/:productId ───────────────────────────
// جلب كل مجموعات الخيارات لمنتج مع خياراتها (مرتبة)
router.get('/:productId', async (req, res, next) => {
  try {
    const groups = await prisma.productModifierGroup.findMany({
      where: { productId: req.params.productId, isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: { options: { orderBy: { sortOrder: 'asc' } } },
    });
    res.json({ success: true, data: groups });
  } catch (err) { next(err); }
});

// ─── PUT /api/modifier-groups/:productId ───────────────────────────
// حفظ كامل لمجموعات منتج دفعة واحدة (full replace) — يناسب شاشة المنتج
// body: { groups: [{ id?, nameAr, nameEn, required, minSelect, maxSelect, sortOrder,
//                    options: [{ id?, nameAr, nameEn, priceDelta, isAvailable, sortOrder }] }] }
router.put('/:productId', editPerm, async (req, res, next) => {
  try {
    const productId = req.params.productId;
    const incoming = Array.isArray(req.body.groups) ? req.body.groups : [];

    const product = await prisma.product.findFirst({
      where: { id: productId, businessId: req.user.businessId },
    });
    if (!product) return res.status(404).json({ success: false, message: 'المنتج غير موجود' });

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.productModifierGroup.findMany({
        where: { productId },
        include: { options: true },
      });
      const incomingGroupIds = incoming.filter(g => g.id).map(g => g.id);

      // حذف المجموعات التي أُزيلت من الواجهة (cascade يحذف خياراتها)
      const toDeleteGroups = existing.filter(g => !incomingGroupIds.includes(g.id)).map(g => g.id);
      if (toDeleteGroups.length) {
        await tx.productModifierGroup.deleteMany({ where: { id: { in: toDeleteGroups } } });
      }

      const savedGroups = [];
      for (let gi = 0; gi < incoming.length; gi++) {
        const g = incoming[gi];
        const nameAr = String(g.nameAr || '').trim();
        if (!nameAr) continue; // تجاهل المجموعات الفارغة
        let minSelect = Math.max(0, Number(g.minSelect) || 0);
        let maxSelect = Math.max(1, Number(g.maxSelect) || 1);
        if (maxSelect < minSelect) maxSelect = minSelect;
        const required = !!g.required;
        if (required && minSelect < 1) minSelect = 1;
        const groupData = {
          nameAr,
          nameEn: g.nameEn ? String(g.nameEn).trim() : null,
          required, minSelect, maxSelect,
          sortOrder: Number.isFinite(Number(g.sortOrder)) ? Number(g.sortOrder) : gi,
          isActive: true,
        };

        let group;
        if (g.id && existing.find(e => e.id === g.id)) {
          group = await tx.productModifierGroup.update({ where: { id: g.id }, data: groupData });
        } else {
          group = await tx.productModifierGroup.create({ data: { ...groupData, productId } });
        }

        // مزامنة الخيارات داخل المجموعة
        const existingOpts = existing.find(e => e.id === group.id)?.options || [];
        const incOpts = Array.isArray(g.options) ? g.options : [];
        const incOptIds = incOpts.filter(o => o.id).map(o => o.id);
        const delOpts = existingOpts.filter(o => !incOptIds.includes(o.id)).map(o => o.id);
        if (delOpts.length) {
          await tx.productModifierOption.deleteMany({ where: { id: { in: delOpts } } });
        }

        const savedOpts = [];
        for (let oi = 0; oi < incOpts.length; oi++) {
          const o = incOpts[oi];
          const optData = {
            nameAr: String(o.nameAr || '').trim(),
            nameEn: o.nameEn ? String(o.nameEn).trim() : null,
            priceDelta: Number(o.priceDelta) || 0,
            isAvailable: o.isAvailable !== false,
            sortOrder: Number.isFinite(Number(o.sortOrder)) ? Number(o.sortOrder) : oi,
          };
          if (!optData.nameAr) continue;

          let opt;
          if (o.id && existingOpts.find(e => e.id === o.id)) {
            opt = await tx.productModifierOption.update({ where: { id: o.id }, data: optData });
          } else {
            opt = await tx.productModifierOption.create({ data: { ...optData, groupId: group.id } });
          }
          savedOpts.push(opt);
        }
        savedGroups.push({ ...group, options: savedOpts });
      }
      return savedGroups;
    });

    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

// ─── DELETE /api/modifier-groups/group/:id ─────────────────────────
router.delete('/group/:id', editPerm, async (req, res, next) => {
  try {
    await prisma.productModifierGroup.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
