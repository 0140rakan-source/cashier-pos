import { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore, useLangStore, P } from '../../store';
import {
  LayoutDashboard, ShoppingCart, Package, Layers, Warehouse,
  Users, Truck, Receipt, Wallet, LineChart, Settings, LogOut, Menu, Lock, Shield, CalendarCheck
} from 'lucide-react';

export default function Layout() {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, can } = useAuthStore();
  const { lang, setLang } = useLangStore();
  const [collapsed, setCollapsed] = useState(false);

  const isAdmin = can(P.SETTINGS_VIEW) || can(P.USERS_VIEW);

  const allNavItems = [
    { path: '/dashboard', label: t('nav.dashboard'), icon: LayoutDashboard, cashier: true },
    { path: '/pos',       label: t('nav.pos'),       icon: ShoppingCart,    cashier: true },
    { path: '/customers', label: t('nav.customers'),  icon: Users,          cashier: true },
    { path: '/shifts',    label: t('nav.shifts'),     icon: Wallet,         cashier: true },
    { path: '/products',  label: t('nav.products'),   icon: Package,        perm: P.PRODUCTS_VIEW },
    { path: '/categories',label: t('nav.categories'), icon: Layers,         perm: P.CATEGORIES_VIEW },
    { path: '/suppliers', label: t('nav.suppliers'),   icon: Truck,          perm: P.SUPPLIERS_VIEW },
    { path: '/inventory', label: t('nav.inventory'),   icon: Warehouse,      perm: P.INVENTORY_VIEW },
    { path: '/purchases', label: t('nav.purchases'),   icon: Receipt,        perm: P.PURCHASES_VIEW },
    { path: '/expenses',  label: t('nav.expenses'),    icon: Wallet,         perm: P.EXPENSES_VIEW },
    { path: '/reports',   label: t('nav.reports'),     icon: LineChart,      perm: P.REPORTS_VIEW },
    { path: '/dayclose',  label: 'إغلاق اليوم',        icon: CalendarCheck,  perm: P.REPORTS_VIEW },
    { path: '/users',     label: t('nav.users'),       icon: Users,          perm: P.USERS_VIEW },
    { path: '/roles',     label: 'الأدوار / Roles',    icon: Shield,         perm: P.ROLES_VIEW },
    { path: '/settings',  label: t('nav.settings'),    icon: Settings,       perm: P.SETTINGS_VIEW },
  ];

  const filteredNavItems = isAdmin
    ? allNavItems.filter(item => !item.perm || can(item.perm))
    : allNavItems.filter(item => item.cashier === true);

  const isActive = (path) => location.pathname === path;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleLock = () => {
    useAuthStore.getState().lockScreen();
  };

  return (
    <div className="flex h-screen bg-gray-50" dir={i18n.language === 'ar' ? 'rtl' : 'ltr'}>
      <aside className={`${collapsed ? 'w-20' : 'w-64'} bg-white shadow-lg transition-all duration-300 flex flex-col`}>
        <div className="p-6 border-b flex items-center justify-between">
          {!collapsed && <h1 className="text-xl font-bold text-brand-600">كاشير</h1>}
          <button onClick={() => setCollapsed(!collapsed)} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <Menu size={18} />
          </button>
        </div>

        <nav className="flex-1 overflow-auto py-4 px-3">
          {filteredNavItems.map(({ path, label, icon: Icon }) => (
            <Link
              key={path}
              to={path}
              className={`flex items-center gap-3 px-3 py-3 rounded-lg mb-1 transition-all text-sm ${
                isActive(path)
                  ? 'bg-brand-500 text-white shadow-md'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Icon size={20} />
              {!collapsed && <span>{label}</span>}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-brand-500 flex items-center justify-center text-white font-bold">
              {user?.fullName?.charAt(0) || 'U'}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user?.fullName}</p>
                <p className="text-xs text-gray-500">{user?.roleName}</p>
              </div>
            )}
          </div>

          <button onClick={handleLock}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-amber-600 hover:bg-amber-50 rounded-lg mb-1">
            <Lock size={16} />
            {!collapsed && <span>قفل الشاشة / Break</span>}
          </button>

          <button onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-500 hover:bg-red-50 rounded-lg">
            <LogOut size={16} />
            {!collapsed && <span>{t('common.logout')}</span>}
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}
