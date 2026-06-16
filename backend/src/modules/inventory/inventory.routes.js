const express = require('express');
const { authenticate, requirePermission } = require('../../middleware/auth');
const prisma = require('../../prisma');
const router = express.Router();
router.use(authenticate);

// Inventory — admin/manager only, NOT cashier
const invPerm = requirePermission('inventory.view');
const adjPerm = requirePermission('inventory.adjust');

router.get('/',       invPerm, async(req,res,next) => { try{ res.json({success:true,data:await prisma.inventory.findMany({where:{businessId:req.user.businessId},include:{product:true}})}); } catch(e){next(e);} });
router.get('/low',    invPerm, async(req,res,next) => { try{ const settings=await prisma.settings.findUnique({where:{businessId:req.user.businessId}}); res.json({success:true,data:await prisma.inventory.findMany({where:{businessId:req.user.businessId,currentStock:{lte:settings?.lowStockThreshold||5}},include:{product:true}})}); } catch(e){next(e);} });
router.get('/low-stock', invPerm, async(req,res,next) => { try{ const settings=await prisma.settings.findUnique({where:{businessId:req.user.businessId}}); res.json({success:true,data:await prisma.inventory.findMany({where:{businessId:req.user.businessId,currentStock:{lte:settings?.lowStockThreshold||5}},include:{product:true}})}); } catch(e){next(e);} });
router.get('/logs', invPerm, async(req,res,next) => { try{ const logs=await prisma.inventoryLog.findMany({where:{businessId:req.user.businessId},orderBy:{createdAt:'desc'},take:50}); res.json({success:true,data:logs}); } catch(e){next(e);} });
router.post('/adjust',adjPerm, async(req,res,next) => {
  try {
    const { productId, quantity, changeType, note } = req.body;

    // ─── Validation ─────────────────────────────────────────
    if (!productId) return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'productId is required' });
    if (quantity === undefined || quantity === null) return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'quantity is required' });

    const changeNum = Number(quantity);
    if (isNaN(changeNum)) return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'quantity must be a valid number' });

    // ─── Determine signed change ────────────────────────────
    let signedChange = changeNum;
    switch (changeType) {
      case 'OUT':   signedChange = -Math.abs(changeNum); break;
      case 'ADJUST': signedChange = changeNum; break;
      default:      signedChange = Math.abs(changeNum); break; // IN
    }

    // ─── Find inventory record ──────────────────────────────
    const inv = await prisma.inventory.findFirst({
      where: { businessId: req.user.businessId, productId },
    });
    if (!inv) return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Inventory record not found for this product' });

    // ─── Decimal-safe calculation ───────────────────────────
    const prev = Number(inv.currentStock);
    const next = prev + signedChange;
    if (next < 0) return res.status(400).json({ success: false, error: 'INVALID_VALUE', message: 'Stock cannot be negative' });

    // ─── Update ─────────────────────────────────────────────
    await prisma.inventory.update({ where: { id: inv.id }, data: { currentStock: next } });
    await prisma.inventoryLog.create({
      data: {
        businessId: req.user.businessId,
        productId,
        changeType: changeType || 'ADJUST',
        quantity: signedChange,
        previousQty: prev,
        newQty: next,
        note: note || '',
      },
    });

    res.json({ success: true, data: { previousStock: prev, newStock: next, change: signedChange } });
  } catch (e) {
    console.error('Inventory adjust error:', e);
    next(e);
  }
});

module.exports = router;