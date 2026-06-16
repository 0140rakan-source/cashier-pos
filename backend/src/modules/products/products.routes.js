const express = require('express');
const { authenticate, requirePermission } = require('../../middleware/auth');
const repo = require('../../repositories/product.repo');
const router = express.Router();
router.use(authenticate);

router.get('/', requirePermission('products.view'), async (req, res, next) => {
  try { res.json({ success: true, data: await repo.list(req.user.businessId, req.query) }); }
  catch (e) { next(e); }
});
router.get('/:id', requirePermission('products.view'), async (req, res, next) => {
  try { res.json({ success: true, data: await repo.getById(req.params.id, req.user.businessId) }); }
  catch (e) { next(e); }
});
router.post('/', requirePermission('products.create'), async (req, res, next) => {
  try { res.status(201).json({ success: true, data: await repo.create(req.user.businessId, req.body) }); }
  catch (e) { next(e); }
});
router.put('/:id', requirePermission('products.edit'), async (req, res, next) => {
  try { res.json({ success: true, data: await repo.update(req.params.id, req.user.businessId, req.body) }); }
  catch (e) { next(e); }
});

// Archive product (deactivate)
router.post('/:id/archive', requirePermission('products.delete'), async (req, res, next) => {
  try {
    const result = await repo.archive(req.params.id, req.user.businessId);
    res.json({ success: true, ...result });
  } catch (e) { next(e); }
});

// Hard delete product (only if no protected history)
router.delete('/:id', requirePermission('products.delete'), async (req, res, next) => {
  try {
    const { force } = req.query; // ?force=true skips archive fallback
    const result = await repo.remove(req.params.id, req.user.businessId, force === 'true');
    res.json({ success: true, ...result });
  } catch (e) { next(e); }
});

module.exports = router;
