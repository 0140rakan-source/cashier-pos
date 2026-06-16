require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const authRoutes        = require('./modules/auth/auth.routes');
const userRoutes        = require('./modules/users/users.routes');
const roleRoutes        = require('./modules/roles/roles.routes');
const settingsRoutes    = require('./modules/settings/settings.routes');
const categoryRoutes    = require('./modules/categories/categories.routes');
const productRoutes     = require('./modules/products/products.routes');
const modifierRoutes    = require('./modules/products/modifiers.routes');
const customerRoutes    = require('./modules/customers/customers.routes');
const supplierRoutes    = require('./modules/suppliers/suppliers.routes');
const inventoryRoutes   = require('./modules/inventory/inventory.routes');
const expenseRoutes     = require('./modules/expenses/expenses.routes');
const purchaseRoutes    = require('./modules/purchases/purchases.routes');
const reportRoutes      = require('./modules/reports/reports.routes');
const reportExtRoutes   = require('./modules/reports/reports-extended.routes');
const dayCloseRoutes    = require('./modules/reports/day-close.routes');
const auditRoutes       = require('./modules/settings/audit.routes');
const salesRoutes       = require('./modules/sales/sales.routes');
const shiftsRoutes      = require('./modules/shifts/shifts.routes');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const { authenticate, requireLicense } = require('./middleware/auth');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'TOO_MANY_REQUESTS', message: 'محاولات كثيرة. حاول بعد 15 دقيقة.' },
});

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
});

function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(cors({ origin: (origin, cb) => cb(null, true), credentials: true }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  if (process.env.NODE_ENV !== 'production') {
    app.use(morgan('dev'));
  }

  app.use('/api', apiLimiter);
  app.use('/api/auth/login', loginLimiter);
  app.use('/api/auth/pin',   loginLimiter);

  const uploadsDir = process.env.UPLOADS_DIR
    || (fs.existsSync(path.join(__dirname, '../../uploads'))
        ? path.join(__dirname, '../../uploads')
        : path.join(__dirname, '../uploads'));
  app.use('/uploads', express.static(uploadsDir));

  // Public routes
  app.use('/api/auth', authRoutes);

  // Admin routes
  app.use('/api/users',     authenticate, userRoutes);
  app.use('/api/roles',     authenticate, roleRoutes);
  app.use('/api/settings',  authenticate, settingsRoutes);
  app.use('/api/audit',     authenticate, auditRoutes);
  app.use('/api/purchases', authenticate, purchaseRoutes);
  app.use('/api/expenses',  authenticate, expenseRoutes);
  app.use('/api/suppliers', authenticate, supplierRoutes);

  // Operational routes
  app.use('/api/sales',      authenticate, requireLicense, salesRoutes);
  app.use('/api/reports',    authenticate, requireLicense, reportRoutes);
  app.use('/api/reports',    authenticate, requireLicense, reportExtRoutes);
  app.use('/api/day-close',  authenticate, requireLicense, dayCloseRoutes);
  app.use('/api/shifts',     authenticate, requireLicense, shiftsRoutes);
  app.use('/api/products',   authenticate, requireLicense, productRoutes);
  app.use('/api/modifiers',  authenticate, requireLicense, modifierRoutes);
  app.use('/api/categories', authenticate, requireLicense, categoryRoutes);
  app.use('/api/customers',  authenticate, requireLicense, customerRoutes);
  app.use('/api/inventory',  authenticate, requireLicense, inventoryRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
