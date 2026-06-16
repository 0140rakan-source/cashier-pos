import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { Activity, ShoppingBag, Warehouse, Clock, Receipt } from 'lucide-react';

const Spinner = () => (
  <div className="flex items-center justify-center py-12">
    <div className="animate-spin w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full" />
  </div>
);

const EmptyState = () => (
  <tr>
    <td colSpan={10} className="px-4 py-8 text-center text-gray-400">لا توجد بيانات</td>
  </tr>
);

const fmt = (val) => Number(val || 0).toFixed(2);
const fmtCur = (val) => `${fmt(val)} ر.س`;

export default function AuditTrail() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/audit')
      .then(r => setData(r.data.data))
      .catch(e => setError(e.response?.data?.message || 'Failed to load audit data'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  if (error) return (
    <div className="p-8">
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-600">{error}</div>
    </div>
  );

  if (!data) return <Spinner />;

  const { sales, inventoryLogs, shifts, expenses } = data;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Activity className="text-brand-500" size={24} />
        <h2 className="text-2xl font-bold">Audit Trail / سجل النشاط</h2>
      </div>

      {/* Recent Sales */}
      <Section title="Recent Sales / المبيعات الأخيرة" icon={ShoppingBag} count={sales?.length}>
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cashier</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
            </tr>
          </thead>
          <tbody>
            {!sales?.length ? <EmptyState /> : sales.map(s => (
              <tr key={s.id} className="border-b hover:bg-gray-50/50">
                <td className="px-4 py-3 font-mono text-xs text-gray-400">{s.id.slice(0, 8)}…</td>
                <td className="px-4 py-3 font-medium">{s.cashier?.fullName || '—'}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    s.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' :
                    s.status === 'CANCELLED' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                  }`}>{s.status}</span>
                </td>
                <td className="px-4 py-3 text-right font-semibold">{fmtCur(s.grandTotal)}</td>
                <td className="px-4 py-3 text-xs text-gray-500">{new Date(s.createdAt).toLocaleString('ar-SA')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      {/* Inventory Changes */}
      <Section title="Inventory Changes / تغييرات المخزون" icon={Warehouse} count={inventoryLogs?.length}>
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product ID</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Qty Change</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">New Stock</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Note</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
            </tr>
          </thead>
          <tbody>
            {!inventoryLogs?.length ? <EmptyState /> : inventoryLogs.map(l => (
              <tr key={l.id} className="border-b hover:bg-gray-50/50">
                <td className="px-4 py-3 font-mono text-xs text-gray-400" title={l.productId}>
                  {l.productId ? l.productId.slice(0, 8) + '…' : '—'}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    l.changeType === 'IN' ? 'bg-emerald-100 text-emerald-700' :
                    l.changeType === 'OUT' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                  }`}>{l.changeType}</span>
                </td>
                <td className={`px-4 py-3 text-right font-semibold ${Number(l.quantity) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {Number(l.quantity) > 0 ? '+' : ''}{Number(l.quantity || 0)}
                </td>
                <td className="px-4 py-3 text-right">{Number(l.newQty || 0)}</td>
                <td className="px-4 py-3 text-gray-500 text-xs max-w-32 truncate">{l.note || '—'}</td>
                <td className="px-4 py-3 text-xs text-gray-500">{new Date(l.createdAt).toLocaleString('ar-SA')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      {/* Shifts */}
      <Section title="Shifts / الورديات" icon={Clock} count={shifts?.length}>
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cashier</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Opened</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Closed</th>
            </tr>
          </thead>
          <tbody>
            {!shifts?.length ? <EmptyState /> : shifts.map(s => (
              <tr key={s.id} className="border-b hover:bg-gray-50/50">
                <td className="px-4 py-3 font-medium">{s.user?.fullName || '—'}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    s.status === 'OPEN' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'
                  }`}>{s.status}</span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">{new Date(s.openedAt).toLocaleString('ar-SA')}</td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {s.closedAt ? new Date(s.closedAt).toLocaleString('ar-SA') : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      {/* Expenses */}
      <Section title="Expenses / المصروفات" icon={Receipt} count={expenses?.length}>
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">By</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
            </tr>
          </thead>
          <tbody>
            {!expenses?.length ? <EmptyState /> : expenses.map(e => (
              <tr key={e.id} className="border-b hover:bg-gray-50/50">
                <td className="px-4 py-3 font-medium">{e.description || '—'}</td>
                <td className="px-4 py-3 text-gray-500">{e.user?.fullName || '—'}</td>
                <td className="px-4 py-3 text-right font-semibold text-red-600">{fmtCur(e.amount)}</td>
                <td className="px-4 py-3 text-xs text-gray-500">{new Date(e.createdAt).toLocaleString('ar-SA')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </div>
  );
}

function Section({ title, icon: Icon, count, children }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4 border-b bg-gray-50">
        <Icon size={18} className="text-brand-500" />
        <h3 className="font-semibold text-gray-700">{title}</h3>
        {count !== undefined && (
          <span className="ml-auto text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">{count}</span>
        )}
      </div>
      {children}
    </div>
  );
}
