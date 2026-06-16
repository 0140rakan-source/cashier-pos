import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { TrendingUp, Users, ShoppingBag, CreditCard } from 'lucide-react';
import { useAuthStore, P } from '../store';

const StatCard = ({ title, value, icon: Icon, color }) => (
  <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm text-gray-500 mb-1 font-medium">{title}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      </div>
      <div className={`p-3 rounded-lg ${color}`}>
        <Icon size={20} className="text-white" />
      </div>
    </div>
  </div>
);

export default function Dashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, can } = useAuthStore();
  const [todayData, setTodayData] = useState({ todaySales: 0, todayCount: 0 });
  const [allData, setAllData] = useState({ lowStockCount: 0, totalCustomers: 0 });

  const loadStats = () => {
    const today = new Date().toISOString().split('T')[0];
    api.get(`/reports/summary?from=${today}&to=${today}`)
      .then(r => {
        const d = r.data.data || {};
        setTodayData({ todaySales: d.todaySales ?? 0, todayCount: d.todayCount ?? 0 });
        setAllData({ lowStockCount: d.lowStockCount ?? 0, totalCustomers: d.totalCustomers ?? 0 });
      })
      .catch((e) => {
        console.error('Dashboard stats error:', e);
        // Dashboard stats failure is non-critical — show zeros silently
      });
  };

  useEffect(() => {
    loadStats();
    // Auto-refresh when user returns to this tab/window
    window.addEventListener('focus', loadStats);
    return () => window.removeEventListener('focus', loadStats);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {t('common.welcome')}, {user?.fullName || '...'} 👋
        </h1>
        <p className="text-gray-500 mt-1">{t('dashboard.subtitle')}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={t('dashboard.today_sales')}
          value={`${Number(todayData.todaySales).toFixed(2)} ${t('common.currency')}`}
          icon={TrendingUp}
          color="bg-green-500"
        />
        <StatCard
          title={t('dashboard.today_transactions')}
          value={Number(todayData.todayCount)}
          icon={ShoppingBag}
          color="bg-blue-500"
        />
        <StatCard
          title={t('dashboard.low_stock_products')}
          value={Number(allData.lowStockCount)}
          icon={CreditCard}
          color="bg-orange-500"
        />
        <StatCard
          title={t('dashboard.customers')}
          value={Number(allData.totalCustomers)}
          icon={Users}
          color="bg-purple-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('dashboard.quick_actions')}</h3>
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => navigate('/pos')}
              className="p-4 rounded-lg bg-brand-500 text-white font-medium text-sm hover:bg-brand-600 transition"
            >
              🛒 {t('nav.pos')}
            </button>
            <button
              onClick={() => navigate('/customers')}
              className="p-4 rounded-lg bg-white text-gray-700 border border-gray-200 font-medium text-sm hover:bg-gray-50 transition"
            >
              👤 {t('nav.customers')}
            </button>
            {can(P.REPORTS_VIEW) && (
              <button
                onClick={() => navigate('/reports')}
                className="p-4 rounded-lg bg-white text-gray-700 border border-gray-200 font-medium text-sm hover:bg-gray-50 transition"
              >
                📊 {t('nav.reports')}
              </button>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('dashboard.system_info')}</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Business</span><span>{user?.business?.nameAr || user?.business?.nameEn || '—'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">User</span><span>{user?.fullName} ({user?.roleName})</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Time</span><span>{new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Version</span><span>v1.0.0</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
