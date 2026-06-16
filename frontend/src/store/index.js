import { create } from 'zustand';
import api from '../api/client';

// Permission constants — mirrors the DB
const P = {
  // Users
  USERS_VIEW: 'users.view',
  USERS_CREATE: 'users.create',
  USERS_EDIT: 'users.edit',
  USERS_DELETE: 'users.delete',
  // Roles
  ROLES_VIEW: 'roles.view',
  ROLES_CREATE: 'roles.create',
  ROLES_EDIT: 'roles.edit',
  ROLES_DELETE: 'roles.delete',
  // Settings
  SETTINGS_VIEW: 'settings.view',
  SETTINGS_EDIT: 'settings.edit',
  // Products
  PRODUCTS_VIEW: 'products.view',
  PRODUCTS_CREATE: 'products.create',
  PRODUCTS_EDIT: 'products.edit',
  PRODUCTS_DELETE: 'products.delete',
  // Categories
  CATEGORIES_VIEW: 'categories.view',
  CATEGORIES_CREATE: 'categories.create',
  CATEGORIES_EDIT: 'categories.edit',
  CATEGORIES_DELETE: 'categories.delete',
  // Customers
  CUSTOMERS_VIEW: 'customers.view',
  CUSTOMERS_CREATE: 'customers.create',
  CUSTOMERS_EDIT: 'customers.edit',
  CUSTOMERS_DELETE: 'customers.delete',
  // Suppliers
  SUPPLIERS_VIEW: 'suppliers.view',
  SUPPLIERS_CREATE: 'suppliers.create',
  // Inventory
  INVENTORY_VIEW: 'inventory.view',
  INVENTORY_ADJUST: 'inventory.adjust',
  // Purchases
  PURCHASES_VIEW: 'purchases.view',
  PURCHASES_CREATE: 'purchases.create',
  // Expenses
  EXPENSES_VIEW: 'expenses.view',
  EXPENSES_CREATE: 'expenses.create',
  EXPENSES_DELETE: 'expenses.delete',
  // Sales
  SALES_CREATE: 'sales.create',
  SALES_VIEW: 'sales.view',
  // Reports
  REPORTS_VIEW: 'reports.view',
  // Shifts
  SHIFTS_VIEW: 'shifts.view',
  SHIFTS_MANAGE: 'shifts.manage',
};

export const useAuthStore = create((set, get) => ({
  user: null,
  token: localStorage.getItem('token') || null,
  permissions: JSON.parse(localStorage.getItem('permissions') || '[]'),
  isLocked: false,

  /** Check if current user has a specific permission */
  can: (perm) => {
    const { permissions } = get();
    return permissions.includes(perm);
  },

  login: async (username, password) => {
    const res = await api.post('/auth/login', { username, password });
    const { user, token } = res.data.data;
    const perms = user.permissions || [];
    localStorage.setItem('token', token);
    localStorage.setItem('permissions', JSON.stringify(perms));
    set({ user: { ...user, ...res.data.data }, token, permissions: perms });
  },

  loginPin: async (pin) => {
    const res = await api.post('/auth/pin', { pin });
    const { user, token } = res.data.data;
    const perms = user.permissions || [];
    localStorage.setItem('token', token);
    localStorage.setItem('permissions', JSON.stringify(perms));
    set({ user: { ...user, ...res.data.data }, token, permissions: perms });
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('permissions');
    set({ user: null, token: null, permissions: [], isLocked: false });
  },

  lockScreen: () => set({ isLocked: true }),

  unlockWithPin: async (pin) => {
    try {
      const res = await api.post('/auth/pin', { pin });
      const { user, token } = res.data.data;
      const perms = user.permissions || [];
      localStorage.setItem('token', token);
      localStorage.setItem('permissions', JSON.stringify(perms));
      set({ user: { ...user, ...res.data.data }, token, permissions: perms, isLocked: false });
      return true;
    } catch {
      return false;
    }
  },

  checkAuth: async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const res = await api.get('/auth/me');
      const d = res.data.data;
      const perms = d.permissions || [];
      localStorage.setItem('permissions', JSON.stringify(perms));
      set({ user: d, permissions: perms });
    } catch {
      localStorage.removeItem('token');
      localStorage.removeItem('permissions');
      set({ user: null, permissions: [] });
    }
  },
}));

export const useLangStore = create((set) => ({
  lang: localStorage.getItem('lang') || 'ar',
  setLang: (lang) => {
    localStorage.setItem('lang', lang);
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    set({ lang });
  },
}));

export { P };
