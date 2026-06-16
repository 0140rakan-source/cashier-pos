import { useState, useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore, useLangStore, P } from '../../store';
import {
  LayoutDashboard, ShoppingCart, Package, Layers, Warehouse,
  Users, Truck, Receipt, Wallet, LineChart, Settings, LogOut, Menu, Lock, Shield,
  CalendarCheck, Search, Bell, Moon, Sun, Maximize2
} from 'lucide-react';

export default function Layout() {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, can } = useAuthStore();
  const { lang, setLang } = useLangStore();
  const [collapsed, setCollapsed] = useState(false);
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  const [search, setSearch] = useState('');

  const isAdmin = can(P.SETTINGS_VIEW) || can(P.USERS_VIEW);
  const isRTL = i18n.language === 'ar';

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
  const handleLogout = () => { logout(); navigate('/login'); };
  const handleLock = () => { useAuthStore.getState().lockScreen(); };

  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    try { localStorage.setItem('theme', next ? 'dark' : 'light'); } catch {}
  };
  useEffect(() => {
    try {
      const saved = localStorage.getItem('theme');
      if (saved === 'dark') { document.documentElement.classList.add('dark'); setDark(true); }
    } catch {}
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  };

  const onSearch = (e) => {
    if (e.key === 'Enter' && search.trim()) navigate('/products');
  };

  return (
    <div className="flex h-screen bg-canvas dark:bg-navy-900 text-ink dark:text-slate-100"
      dir={isRTL ? 'rtl' : 'ltr'}>

      {/* Sidebar */}
      <aside className={`${collapsed ? 'w-20' : 'w-64'} shrink-0 bg-navy-900 text-slate-200 flex flex-col transition-all duration-300`}>
        <div className="h-16 px-5 flex items-center justify-between border-b border-white/5">
          {!collapsed && <h1 className="text-xl font-extrabold text-white tracking-tight">كاشير</h1>}
          <button onClick={() => setCollapsed(!collapsed)}
            className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition">
            <Menu size={18} />
          </button>
        </div>

        <nav className="flex-1 overflow-auto py-4 px-3 space-y-1">
          {filteredNavItems.map(({ path, label, icon: Icon }) => {
            const active = isActive(path);
            return (
              <Link key={path} to={path} title={collapsed ? label : undefined}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                  ${active ? 'bg-brand-600 text-white shadow-md' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}>
                <Icon size={20} className="shrink-0" />
                {!collapsed && <span className="truncate">{label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-white/5">
          <div className="flex items-center gap-3 px-2 py-2 mb-2">
            <div className="w-10 h-10 rounded-full bg-brand-600 flex items-center justify-center text-white font-bold shrink-0">
              {user?.fullName?.charAt(0) || 'U'}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{user?.fullName || 'مدير النظام'}</p>
                <p className="text-[11px] text-slate-400 uppercase tracking-wide">{user?.roleName || 'ADMIN'}</p>
              </div>
            )}
          </div>

          <button onClick={handleLock}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-300 hover:bg-white/10 hover:text-white rounded-xl transition mb-1">
            <Lock size={16} className="shrink-0" />
            {!collapsed && <span>قفل الشاشة</span>}
          </button>

          <button onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-400 hover:bg-red-500/15 hover:text-red-300 rounded-xl transition">
            <LogOut size={16} className="shrink-0" />
            {!collapsed && <span>{t('common.logout') || 'تسجيل خروج'}</span>}
          </button>
        </div>
      </aside>

      {/* Right column */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 shrink-0 bg-white dark:bg-navy-800 border-b border-line dark:border-white/5 flex items-center gap-3 px-5">
          <div className="relative flex-1 max-w-2xl mx-auto">
            <Search size={18} className="absolute start-3 top-1/2 -translate-y-1/2 text-muted" />
            <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={onSearch}
              placeholder="ابحث عن منتج، عميل، طلب…"
              className="w-full ps-10 pe-4 py-2.5 bg-canvas dark:bg-navy-900 border border-line dark:border-white/10 rounded-xl text-sm text-ink dark:text-slate-100 placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 transition" />
          </div>

          <div className="flex items-center gap-1">
            <button title="الإشعارات"
              className="relative p-2.5 text-muted hover:text-ink dark:hover:text-white hover:bg-canvas dark:hover:bg-white/10 rounded-xl transition">
              <Bell size={19} />
              <span className="absolute top-1.5 end-1.5 w-2 h-2 bg-red-500 rounded-full" />
            </button>
            <button onClick={toggleDark} title="الوضع الليلي"
              className="p-2.5 text-muted hover:text-ink dark:hover:text-white hover:bg-canvas dark:hover:bg-white/10 rounded-xl transition">
              {dark ? <Sun size={19} /> : <Moon size={19} />}
            </button>
            <button onClick={toggleFullscreen} title="ملء الشاشة"
              className="p-2.5 text-muted hover:text-ink dark:hover:text-white hover:bg-canvas dark:hover:bg-white/10 rounded-xl transition">
              <Maximize2 size={19} />
            </button>

            <div className="flex items-center gap-2 ps-3 ms-1 border-s border-line dark:border-white/10">
              <div className="text-end hidden sm:block">
                <p className="text-sm font-semibold leading-tight">{user?.fullName || 'مدير النظام'}</p>
                <p className="text-[11px] text-muted uppercase">{user?.roleName || 'ADMIN'}</p>
              </div>
              <div className="w-9 h-9 rounded-full bg-brand-600 flex items-center justify-center text-white font-bold">
                {user?.fullName?.charAt(0) || 'U'}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6 bg-canvas dark:bg-navy-900">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
