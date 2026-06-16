import React, { useState, useEffect, useCallback } from 'react';
import api from '../api/client';
import toast, { Toaster } from 'react-hot-toast';
import {
  BarChart2, TrendingUp, ShoppingBag, Users, Package, AlertTriangle,
  DollarSign, Receipt, Clock, RefreshCw, Printer, Eye, X, Banknote, CreditCard, CalendarCheck,
  Trash2, RotateCcw, Ban, ShieldAlert
} from 'lucide-react';
import { useAuthStore } from '../store';

const Spinner = () => (
  <div className="flex items-center justify-center py-12">
    <div className="animate-spin w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full" />
  </div>
);

const EmptyState = ({ message = 'لا توجد بيانات' }) => (
  <div className="text-center py-12 text-gray-400">
    <BarChart2 size={40} className="mx-auto mb-3 opacity-30" />
    <p>{message}</p>
  </div>
);

const ErrorState = ({ message }) => (
  <div className="text-center py-8">
    <p className="text-red-500 bg-red-50 border border-red-200 rounded-lg px-4 py-3 inline-block">{message}</p>
  </div>
);

const DateRangePicker = ({ from, to, onChange }) => (
  <div className="flex items-center gap-2 mb-4 flex-wrap">
    <label className="text-xs text-gray-500">من</label>
    <input type="date" value={from} onChange={e => onChange({ from: e.target.value, to })}
      className="px-3 py-1.5 border rounded-lg bg-white text-sm" />
    <label className="text-xs text-gray-500">إلى</label>
    <input type="date" value={to} onChange={e => onChange({ from, to: e.target.value })}
      className="px-3 py-1.5 border rounded-lg bg-white text-sm" />
    <button onClick={() => onChange({ from: '', to: '' })} className="px-3 py-1.5 text-xs bg-gray-100 rounded-lg hover:bg-gray-200">مسح</button>
  </div>
);

const fmt = (val) => Number(val || 0).toFixed(2);
const fmtCur = (val) => `${fmt(val)} ر.س`;

// Print helper — uses window.print() directly (works in Electron)
function printSection(id) {
  window.print();
}

// ── Overview Tab ──────────────────────────────────────────────────────────────
function OverviewTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setLoading(true); setError(null);
    api.get('/reports/summary').then(r => setData(r.data.data)).catch(e => setError(e.response?.data?.message || 'Failed')).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); window.addEventListener('focus', load); return () => window.removeEventListener('focus', load); }, [load]);

  if (loading && !data) return <Spinner />;
  if (error) return <ErrorState message={error} />;
  if (!data) return <EmptyState />;

  const stats = [
    { label: "مبيعات اليوم", value: fmtCur(data.todaySales), sub: `${data.todayCount || 0} عملية`, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'إجمالي الإيرادات', value: fmtCur(data.totalRevenue), sub: `${data.salesCount || 0} عملية`, icon: DollarSign, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'إجمالي المصروفات', value: fmtCur(data.totalExpenses), sub: 'الكل', icon: Receipt, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'الأرباح', value: fmtCur(data.profit), sub: 'إيرادات - مصروفات', icon: BarChart2, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'المنتجات', value: data.totalProducts || 0, sub: 'في الكتالوج', icon: Package, color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: 'العملاء', value: data.totalCustomers || 0, sub: 'مسجلين', icon: Users, color: 'text-teal-600', bg: 'bg-teal-50' },
    { label: 'مخزون منخفض', value: data.lowStockCount || 0, sub: 'تحتاج انتباه', icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'الموردين', value: data.totalSuppliers || 0, sub: 'نشط', icon: ShoppingBag, color: 'text-indigo-600', bg: 'bg-indigo-50' },
  ];

  return (
    <div id="report-overview">
      <div className="flex justify-end mb-3 no-print">
        <button onClick={load} disabled={loading}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-brand-600 px-3 py-1.5 bg-white border rounded-lg hover:border-brand-400 transition disabled:opacity-50">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> تحديث
        </button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map(({ label, value, sub, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-xl border shadow-sm p-5">
            <div className={`w-10 h-10 ${bg} ${color} rounded-lg flex items-center justify-center mb-3`}><Icon size={20} /></div>
            <p className="text-xl font-bold text-gray-800">{value}</p>
            <p className="text-xs font-medium text-gray-700 mt-1">{label}</p>
            <p className="text-xs text-gray-400">{sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Sales List Tab ─────────────────────────────────────────────────────────────
function SalesTab() {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [range, setRange] = useState({ from: '', to: '' });
  const [expandedSale, setExpandedSale] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = {};
      if (range.from) params.from = range.from;
      if (range.to) params.to = range.to;
      const res = await api.get('/sales', { params });
      setSales(res.data.data || []);
    } catch (e) { setError(e.response?.data?.message || 'Failed'); }
    finally { setLoading(false); }
  }, [range]);

  useEffect(() => { load(); }, [load]);

  const totalCash = sales.reduce((sum, s) => {
    const cashPay = (s.payments || []).filter(p => p.method === 'CASH').reduce((a, p) => a + Number(p.amount), 0);
    return sum + (cashPay || (s.payments?.length === 0 ? Number(s.grandTotal) : 0));
  }, 0);
  const totalCard = sales.reduce((sum, s) => {
    return sum + (s.payments || []).filter(p => p.method !== 'CASH').reduce((a, p) => a + Number(p.amount), 0);
  }, 0);

  return (
    <div id="report-sales">
      <DateRangePicker from={range.from} to={range.to} onChange={setRange} />
      {loading ? <Spinner /> : error ? <ErrorState message={error} /> : sales.length === 0 ? <EmptyState /> : (
        <>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
              <div className="flex items-center gap-2 text-emerald-700 mb-1"><Banknote size={16} /><span className="text-sm font-medium">إجمالي النقد</span></div>
              <p className="text-xl font-bold text-emerald-800">{fmtCur(totalCash)}</p>
            </div>
            <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
              <div className="flex items-center gap-2 text-blue-700 mb-1"><CreditCard size={16} /><span className="text-sm font-medium">إجمالي الشبكة / البطاقة</span></div>
              <p className="text-xl font-bold text-blue-800">{fmtCur(totalCard)}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
              <div className="flex items-center gap-2 text-gray-700 mb-1"><DollarSign size={16} /><span className="text-sm font-medium">إجمالي المبيعات</span></div>
              <p className="text-xl font-bold text-gray-800">{fmtCur(totalCash + totalCard)}</p>
            </div>
          </div>

          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">رقم</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">الكاشير</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">القناة</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">الطريقة</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">المجموع</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">الضريبة</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">الإجمالي</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">التاريخ</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase no-print">التفاصيل</th>
                </tr>
              </thead>
              <tbody>
                {sales.map(s => {
                  const methods = [...new Set((s.payments || []).map(p => p.method))];
                  const methodLabel = methods.map(m => m === 'CASH' ? 'نقد' : m === 'CARD' ? 'بطاقة' : m).join(', ') || 'نقد';
                  return (
                    <React.Fragment key={s.id}>
                      <tr className={`border-b hover:bg-gray-50/50 cursor-pointer ${s.status === 'VOIDED' ? 'opacity-50 bg-red-50/30' : ''} ${s.saleType === 'RETURN' ? 'bg-amber-50/30' : ''}`} onClick={() => setExpandedSale(expandedSale === s.id ? null : s.id)}>
                        <td className="px-4 py-3 font-mono text-xs text-gray-400">
                          {s.id.slice(0, 8)}…
                          {s.status === 'VOIDED' && <span className="block text-[10px] text-red-500 font-medium">ملغي</span>}
                          {s.saleType === 'RETURN' && <span className="block text-[10px] text-amber-600 font-medium">إرجاع</span>}
                        </td>
                        <td className="px-4 py-3">{s.cashier?.fullName || '—'}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-600">
                            {s.orderChannel === 'DIRECT' ? 'مباشر' : s.orderChannel || 'مباشر'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${methods.includes('CASH') ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                            {methodLabel}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">{fmtCur(s.subtotal)}</td>
                        <td className="px-4 py-3 text-right text-orange-600">{fmtCur(s.taxAmount)}</td>
                        <td className="px-4 py-3 text-right font-semibold">{fmtCur(s.grandTotal)}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">{new Date(s.createdAt).toLocaleString('ar-SA')}</td>
                        <td className="px-4 py-3 text-center no-print">
                          <button className="text-gray-400 hover:text-brand-500"><Eye size={16} /></button>
                        </td>
                      </tr>
                      {expandedSale === s.id && (
                        <tr>
                          <td colSpan={8} className="bg-gray-50 px-6 py-4">
                            <div className="space-y-2">
                              <h4 className="font-semibold text-sm text-gray-700 mb-2">تفاصيل العملية</h4>
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="text-gray-400 border-b">
                                    <th className="text-right py-1">المنتج</th>
                                    <th className="text-center py-1">الكمية</th>
                                    <th className="text-right py-1">سعر الوحدة</th>
                                    <th className="text-right py-1">الضريبة</th>
                                    <th className="text-right py-1">الإجمالي</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(s.items || []).map((item, i) => (
                                    <tr key={i} className="border-b border-dashed border-gray-200">
                                      <td className="py-1.5">{item.product?.nameAr || '—'}</td>
                                      <td className="text-center">{Number(item.quantity).toFixed(0)}</td>
                                      <td className="text-right">{fmt(item.unitPrice)}</td>
                                      <td className="text-right text-orange-500">{fmt(item.taxAmount)}</td>
                                      <td className="text-right font-medium">{fmt(item.total)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              {Number(s.discount) > 0 && (
                                <p className="text-xs text-red-600">خصم: {fmtCur(s.discount)}</p>
                              )}
                              <div className="flex gap-4 text-xs text-gray-500 mt-2">
                                {(s.payments || []).map((p, i) => (
                                  <span key={i}>{p.method === 'CASH' ? '💵 نقد' : '💳 بطاقة'}: {fmtCur(p.amount)}</span>
                                ))}
                              </div>
                              {s.status === 'COMPLETED' && s.saleType !== 'RETURN' && (
                                <div className="flex gap-2 mt-3 pt-2 border-t no-print">
                                  <button
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      try {
                                        await api.post(`/sales/${s.id}/void`, { reason: 'إلغاء من التقارير' });
                                        toast.success('تم إلغاء العملية');
                                        load();
                                      } catch (err) { toast.error(err.response?.data?.message || 'فشل'); }
                                    }}
                                    className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-medium hover:bg-red-100 border border-red-200"
                                  ><Ban size={12} /> إلغاء العملية</button>
                                  <button
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      const items = (s.items || []).map(it => ({ saleItemId: it.id, quantity: Number(it.quantity) }));
                                      try {
                                        await api.post(`/sales/${s.id}/return`, { returnItems: items, reason: 'إرجاع كامل' });
                                        toast.success('تم الإرجاع بنجاح');
                                        load();
                                      } catch (err) { toast.error(err.response?.data?.message || 'فشل'); }
                                    }}
                                    className="flex items-center gap-1 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg text-xs font-medium hover:bg-amber-100 border border-amber-200"
                                  ><RotateCcw size={12} /> إرجاع كامل</button>
                                </div>
                              )}
                              {s.status === 'VOIDED' && <p className="text-xs text-red-500 mt-2 font-medium">⛔ هذه العملية ملغية</p>}
                              {s.saleType === 'RETURN' && <p className="text-xs text-amber-600 mt-2 font-medium">↩️ عملية إرجاع</p>}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
            <div className="px-4 py-3 bg-gray-50 text-right text-sm font-semibold text-gray-700">
              المجموع: {fmtCur(sales.reduce((sum, s) => sum + Number(s.grandTotal || 0), 0))} — {sales.length} عملية
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Day Close Tab ──────────────────────────────────────────────────────────────
function DayCloseTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [mode, setMode] = useState('date'); // 'date' or 'shift'
  const [shifts, setShifts] = useState([]);
  const [selectedShift, setSelectedShift] = useState('');

  useEffect(() => {
    api.get('/reports/closed-shifts').then(r => setShifts(r.data.data || [])).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setError(null); setData(null);
    try {
      const params = mode === 'shift' && selectedShift
        ? { shiftId: selectedShift }
        : { date };
      const res = await api.get('/reports/day-close', { params });
      setData(res.data.data);
    } catch (e) { setError(e.response?.data?.message || 'Failed'); }
    finally { setLoading(false); }
  }, [date, mode, selectedShift]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex gap-2">
          <button onClick={() => setMode('date')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${mode === 'date' ? 'bg-brand-500 text-white' : 'bg-gray-100'}`}>
            بحث بالتاريخ
          </button>
          <button onClick={() => setMode('shift')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${mode === 'shift' ? 'bg-brand-500 text-white' : 'bg-gray-100'}`}>
            بحث بالوردية
          </button>
        </div>
        {mode === 'date' ? (
          <>
            <label className="text-sm text-gray-500">التاريخ:</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="px-3 py-1.5 border rounded-lg bg-white text-sm" />
          </>
        ) : (
          <select value={selectedShift} onChange={e => setSelectedShift(e.target.value)}
            className="px-3 py-1.5 border rounded-lg bg-white text-sm">
            <option value="">اختر وردية...</option>
            {shifts.map(s => (
              <option key={s.id} value={s.id}>
                {s.user?.fullName} — {new Date(s.openedAt).toLocaleString('ar-SA')} → {s.closedAt ? new Date(s.closedAt).toLocaleString('ar-SA') : '—'}
              </option>
            ))}
          </select>
        )}
        <button onClick={() => window.print()}
          className="no-print flex items-center gap-1 px-3 py-1.5 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm">
          <Printer size={14} /> طباعة
        </button>
      </div>

      {loading ? <Spinner /> : error ? <ErrorState message={error} /> : !data ? <EmptyState /> : (
        <div id="day-close-print">
          <h2 className="text-lg font-bold mb-4">📋 تقرير إغلاق اليوم — {data.date}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="bg-white rounded-xl border p-4">
              <p className="text-xs text-gray-500">عدد العمليات</p>
              <p className="text-2xl font-bold">{data.saleCount}</p>
            </div>
            <div className="bg-emerald-50 rounded-xl border border-emerald-100 p-4">
              <p className="text-xs text-emerald-700">إجمالي النقد</p>
              <p className="text-2xl font-bold text-emerald-800">{fmtCur(data.cashSales)}</p>
            </div>
            <div className="bg-blue-50 rounded-xl border border-blue-100 p-4">
              <p className="text-xs text-blue-700">إجمالي الشبكة</p>
              <p className="text-2xl font-bold text-blue-800">{fmtCur(data.cardSales)}</p>
            </div>
            <div className="bg-gray-50 rounded-xl border p-4">
              <p className="text-xs text-gray-500">إجمالي المبيعات</p>
              <p className="text-2xl font-bold">{fmtCur(data.grandTotal)}</p>
            </div>
          </div>

          <div className="bg-white rounded-xl border p-5 mb-6 space-y-2 text-sm">
            <h3 className="font-semibold border-b pb-2 mb-3">ملخص مالي</h3>
            <div className="flex justify-between"><span className="text-gray-500">المجموع قبل الضريبة</span><span>{fmtCur(data.subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">ضريبة القيمة المضافة</span><span className="text-orange-600">{fmtCur(data.tax)}</span></div>
            {data.discount > 0 && <div className="flex justify-between"><span className="text-gray-500">الخصومات</span><span className="text-red-600">-{fmtCur(data.discount)}</span></div>}
            <div className="flex justify-between font-bold border-t pt-2"><span>الإجمالي النهائي</span><span>{fmtCur(data.grandTotal)}</span></div>
            <div className="flex justify-between text-gray-500"><span>تكلفة البضاعة</span><span>{fmtCur(data.totalCost)}</span></div>
            <div className="flex justify-between font-bold text-purple-700"><span>إجمالي الربح</span><span>{fmtCur(data.grossProfit)}</span></div>
          </div>

          {data.products?.length > 0 && (
            <div className="bg-white rounded-xl border overflow-hidden mb-6">
              <h3 className="px-5 py-3 font-semibold border-b text-sm">تفصيل المنتجات المباعة</h3>
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-right text-xs text-gray-500">المنتج</th>
                    <th className="px-4 py-2 text-center text-xs text-gray-500">الكمية</th>
                    <th className="px-4 py-2 text-right text-xs text-gray-500">الإيراد</th>
                    <th className="px-4 py-2 text-right text-xs text-gray-500">التكلفة</th>
                    <th className="px-4 py-2 text-right text-xs text-gray-500">الربح</th>
                  </tr>
                </thead>
                <tbody>
                  {data.products.map(p => (
                    <tr key={p.productId} className="border-b hover:bg-gray-50/50">
                      <td className="px-4 py-2 font-medium">{p.nameAr}</td>
                      <td className="px-4 py-2 text-center">{Number(p.totalQty).toFixed(0)}</td>
                      <td className="px-4 py-2 text-right">{fmtCur(p.totalRevenue)}</td>
                      <td className="px-4 py-2 text-right text-gray-500">{fmtCur(p.totalCost)}</td>
                      <td className="px-4 py-2 text-right font-medium text-purple-700">{fmtCur(p.totalRevenue - p.totalCost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {data.cashiers?.length > 0 && (
            <div className="bg-white rounded-xl border overflow-hidden">
              <h3 className="px-5 py-3 font-semibold border-b text-sm">أداء الكاشير</h3>
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-right text-xs text-gray-500">الكاشير</th>
                    <th className="px-4 py-2 text-center text-xs text-gray-500">العمليات</th>
                    <th className="px-4 py-2 text-right text-xs text-gray-500">الإجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {data.cashiers.map((c, i) => (
                    <tr key={i} className="border-b">
                      <td className="px-4 py-2 font-medium">{c.name}</td>
                      <td className="px-4 py-2 text-center">{c.count}</td>
                      <td className="px-4 py-2 text-right font-semibold">{fmtCur(c.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── By Cashier Tab ─────────────────────────────────────────────────────────────
function ByCashierTab() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [range, setRange] = useState({ from: '', to: '' });

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = {};
      if (range.from) params.from = range.from;
      if (range.to) params.to = range.to;
      const res = await api.get('/reports/by-cashier', { params });
      setData(res.data.data || []);
    } catch (e) { setError(e.response?.data?.message || 'Failed'); }
    finally { setLoading(false); }
  }, [range]);

  useEffect(() => { load(); }, [load]);

  return (
    <div id="report-by-cashier">
      <DateRangePicker from={range.from} to={range.to} onChange={setRange} />
      {loading ? <Spinner /> : error ? <ErrorState message={error} /> : data.length === 0 ? <EmptyState /> : (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">#</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">الكاشير</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">العمليات</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">إجمالي المبيعات</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr key={row.cashierId} className="border-b hover:bg-gray-50/50">
                  <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                  <td className="px-4 py-3 font-medium">{row.cashierName}</td>
                  <td className="px-4 py-3 text-right">{row.count}</td>
                  <td className="px-4 py-3 text-right font-semibold">{fmtCur(row.totalSales)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── By Product Tab ─────────────────────────────────────────────────────────────
function ByProductTab() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [range, setRange] = useState({ from: '', to: '' });

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = { limit: 50 };
      if (range.from) params.from = range.from;
      if (range.to) params.to = range.to;
      const res = await api.get('/reports/by-product', { params });
      setData(res.data.data || []);
    } catch (e) { setError(e.response?.data?.message || 'Failed'); }
    finally { setLoading(false); }
  }, [range]);

  useEffect(() => { load(); }, [load]);

  return (
    <div id="report-by-product">
      <DateRangePicker from={range.from} to={range.to} onChange={setRange} />
      {loading ? <Spinner /> : error ? <ErrorState message={error} /> : data.length === 0 ? <EmptyState /> : (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">#</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">المنتج</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">الكمية المباعة</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">الإيراد</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr key={row.productId} className="border-b hover:bg-gray-50/50">
                  <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                  <td className="px-4 py-3"><p className="font-medium">{row.nameAr}</p>{row.nameEn && <p className="text-xs text-gray-400">{row.nameEn}</p>}</td>
                  <td className="px-4 py-3 text-right">{Number(row.totalQty || 0).toFixed(0)}</td>
                  <td className="px-4 py-3 text-right font-semibold">{fmtCur(row.totalRevenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Payment Methods Tab ────────────────────────────────────────────────────────
function PaymentMethodsTab() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [range, setRange] = useState({ from: '', to: '' });

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = {};
      if (range.from) params.from = range.from;
      if (range.to) params.to = range.to;
      const res = await api.get('/reports/by-payment', { params });
      setData(res.data.data || []);
    } catch (e) { setError(e.response?.data?.message || 'Failed'); }
    finally { setLoading(false); }
  }, [range]);

  useEffect(() => { load(); }, [load]);

  const total = data.reduce((sum, p) => sum + Number(p.total || 0), 0);

  return (
    <div id="report-payments">
      <DateRangePicker from={range.from} to={range.to} onChange={setRange} />
      {loading ? <Spinner /> : error ? <ErrorState message={error} /> : data.length === 0 ? <EmptyState /> : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {data.map(p => {
            const pct = total > 0 ? (Number(p.total || 0) / total * 100) : 0;
            const methodColors = { CASH: 'bg-emerald-100 text-emerald-700', CARD: 'bg-blue-100 text-blue-700', TRANSFER: 'bg-purple-100 text-purple-700' };
            const methodLabels = { CASH: 'نقد / Cash', CARD: 'بطاقة / Card', TRANSFER: 'تحويل / Transfer' };
            return (
              <div key={p.method} className="bg-white rounded-xl border shadow-sm p-5">
                <span className={`text-xs px-2 py-1 rounded-full font-semibold ${methodColors[p.method] || 'bg-gray-100 text-gray-700'}`}>
                  {methodLabels[p.method] || p.method}
                </span>
                <p className="text-2xl font-bold text-gray-800 mt-3">{fmtCur(p.total)}</p>
                <p className="text-sm text-gray-500 mt-1">{p.count} عملية · {pct.toFixed(1)}%</p>
                <div className="mt-3 bg-gray-100 rounded-full h-2">
                  <div className="bg-brand-500 h-2 rounded-full" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Tax/VAT Summary Tab ────────────────────────────────────────────────────────
function TaxSummaryTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [range, setRange] = useState({ from: '', to: '' });

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = {};
      if (range.from) params.from = range.from;
      if (range.to) params.to = range.to;
      const res = await api.get('/reports/tax-summary', { params });
      setData(res.data.data);
    } catch (e) { setError(e.response?.data?.message || 'Failed'); }
    finally { setLoading(false); }
  }, [range]);

  useEffect(() => { load(); }, [load]);

  return (
    <div id="report-tax">
      <DateRangePicker from={range.from} to={range.to} onChange={setRange} />
      {loading ? <Spinner /> : error ? <ErrorState message={error} /> : !data ? <EmptyState /> : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'المجموع قبل الضريبة', value: data.subtotalSum, color: 'bg-blue-50 text-blue-700' },
            { label: 'إجمالي الضريبة 15%', value: data.taxSum, color: 'bg-orange-50 text-orange-700' },
            { label: 'إجمالي الخصومات', value: data.discountSum, color: 'bg-red-50 text-red-700' },
            { label: 'الإجمالي النهائي', value: data.grandSum, color: 'bg-emerald-50 text-emerald-700' },
          ].map(({ label, value, color }) => (
            <div key={label} className={`rounded-xl border p-5 ${color}`}>
              <p className="text-2xl font-bold">{fmtCur(value)}</p>
              <p className="text-sm mt-1 opacity-80">{label}</p>
              {label.includes('نهائي') && <p className="text-xs mt-2 opacity-70">{data.count} عملية</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Low Stock Tab ──────────────────────────────────────────────────────────────
function LowStockTab() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/reports/low-stock').then(r => setData(r.data.data || [])).catch(e => setError(e.response?.data?.message || 'Failed')).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;
  if (error) return <ErrorState message={error} />;
  if (data.length === 0) return <div className="text-center py-12 text-emerald-600 font-medium">✅ جميع المنتجات بمخزون جيد</div>;

  return (
    <div id="report-lowstock" className="bg-white rounded-xl border shadow-sm overflow-hidden">
      <div className="px-4 py-3 bg-amber-50 border-b border-amber-100 flex items-center gap-2">
        <AlertTriangle size={16} className="text-amber-600" />
        <span className="text-sm font-medium text-amber-700">{data.length} منتج تحت الحد الأدنى</span>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">المنتج</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">المخزون الحالي</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">الحد الأدنى</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">الحالة</th>
          </tr>
        </thead>
        <tbody>
          {data.map(item => (
            <tr key={item.id} className="border-b hover:bg-amber-50/30">
              <td className="px-4 py-3"><p className="font-medium">{item.product?.nameAr || '—'}</p></td>
              <td className="px-4 py-3 text-right font-bold text-red-600">{Number(item.currentStock || 0).toFixed(0)}</td>
              <td className="px-4 py-3 text-right text-gray-500">{Number(item.minStock || 0).toFixed(0)}</td>
              <td className="px-4 py-3">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${Number(item.currentStock) === 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                  {Number(item.currentStock) === 0 ? 'نفد المخزون' : 'منخفض'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Shifts Tab ─────────────────────────────────────────────────────────────────
function ShiftsTab() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/reports/shifts').then(r => setData(r.data.data || [])).catch(e => setError(e.response?.data?.message || 'Failed')).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;
  if (error) return <ErrorState message={error} />;
  if (data.length === 0) return <EmptyState />;

  return (
    <div id="report-shifts" className="bg-white rounded-xl border shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">الكاشير</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">الحالة</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">فتح</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">إغلاق</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">العمليات</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">نقد</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">بطاقة</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">الإجمالي</th>
          </tr>
        </thead>
        <tbody>
          {data.map(shift => (
            <tr key={shift.id} className="border-b hover:bg-gray-50/50">
              <td className="px-4 py-3 font-medium">{shift.user?.fullName || '—'}</td>
              <td className="px-4 py-3">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${shift.status === 'OPEN' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>{shift.status === 'OPEN' ? 'مفتوح' : 'مغلق'}</span>
              </td>
              <td className="px-4 py-3 text-xs text-gray-500">{new Date(shift.openedAt).toLocaleString('ar-SA')}</td>
              <td className="px-4 py-3 text-xs text-gray-500">{shift.closedAt ? new Date(shift.closedAt).toLocaleString('ar-SA') : '—'}</td>
              <td className="px-4 py-3 text-right">{shift.saleCount}</td>
              <td className="px-4 py-3 text-right text-emerald-700 font-medium">{fmtCur(shift.cashSales || 0)}</td>
              <td className="px-4 py-3 text-right text-blue-700 font-medium">{fmtCur(shift.cardSales || 0)}</td>
              <td className="px-4 py-3 text-right font-semibold">{fmtCur(shift.totalSales)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Admin Purge Tab ────────────────────────────────────────────────────────────
function AdminPurgeTab() {
  const { can } = useAuthStore();
  const isAdmin = can('users.delete');
  const [beforeDate, setBeforeDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmStep, setConfirmStep] = useState(0);
  const [result, setResult] = useState(null);

  if (!isAdmin) return <div className="text-center py-12 text-red-500">⛔ هذه الصفحة للمدير فقط</div>;

  const handlePurge = async () => {
    setLoading(true); setResult(null);
    try {
      const params = { confirm: 'CONFIRM_PURGE' };
      if (beforeDate) params.before = beforeDate;
      const res = await api.delete('/sales/purge', { params });
      setResult(res.data);
      toast.success(res.data.message || 'تم الحذف');
      setConfirmStep(0);
    } catch (err) {
      toast.error(err.response?.data?.message || 'فشل الحذف');
    } finally { setLoading(false); }
  };

  return (
    <div className="max-w-xl mx-auto">
      <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <ShieldAlert size={24} className="text-red-600" />
          <div>
            <h3 className="text-lg font-bold text-red-800">تنظيف سجلات المبيعات</h3>
            <p className="text-sm text-red-600">هذا الإجراء غير قابل للتراجع — للمدير فقط</p>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 mb-4 space-y-3">
          <div>
            <label className="block text-sm text-gray-600 mb-1">حذف السجلات قبل تاريخ (اختياري)</label>
            <input type="date" value={beforeDate} onChange={e => setBeforeDate(e.target.value)}
              className="px-3 py-2 border rounded-lg bg-gray-50 text-sm w-full" />
            <p className="text-xs text-gray-400 mt-1">اتركه فارغاً لحذف جميع السجلات</p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
            <p className="font-bold mb-1">⚠️ تحذير:</p>
            <ul className="list-disc pr-4 space-y-1">
              <li>سيتم حذف سجلات المبيعات والفواتير المرتبطة نهائياً</li>
              <li>المخزون لن يتغير</li>
              <li>التقارير لن تعرض البيانات المحذوفة</li>
              <li>هذا الإجراء لا يمكن التراجع عنه</li>
            </ul>
          </div>
        </div>
        {confirmStep === 0 && (
          <button onClick={() => setConfirmStep(1)} className="w-full py-3 bg-red-500 text-white rounded-xl hover:bg-red-600 font-bold">🗑️ بدء تنظيف السجلات</button>
        )}
        {confirmStep === 1 && (
          <div className="space-y-3">
            <p className="text-center text-red-700 font-bold">هل أنت متأكد؟ {beforeDate ? `حذف السجلات قبل ${beforeDate}` : 'حذف جميع سجلات المبيعات'}</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmStep(2)} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold">نعم، أكّد الحذف</button>
              <button onClick={() => setConfirmStep(0)} className="flex-1 py-3 bg-gray-100 rounded-xl font-medium">إلغاء</button>
            </div>
          </div>
        )}
        {confirmStep === 2 && (
          <div className="space-y-3">
            <p className="text-center text-red-800 font-bold text-lg">⚠️ التأكيد النهائي — لا يمكن التراجع!</p>
            <button onClick={handlePurge} disabled={loading} className="w-full py-4 bg-red-700 text-white rounded-xl font-bold text-lg disabled:opacity-50">
              {loading ? 'جاري الحذف...' : '🗑️ حذف نهائي — تأكيد'}
            </button>
            <button onClick={() => setConfirmStep(0)} className="w-full py-3 bg-gray-100 rounded-xl font-medium">إلغاء</button>
          </div>
        )}
        {result && (
          <div className="mt-4 bg-white rounded-xl p-4 text-center">
            <p className="text-lg font-bold text-green-700">{result.message}</p>
            <p className="text-sm text-gray-500 mt-1">تم حذف {result.deleted} سجل</p>
          </div>
        )}
      </div>
    </div>
  );
}

const TABS = [
  { key: 'overview', label: 'نظرة عامة', icon: BarChart2 },
  { key: 'sales', label: 'المبيعات', icon: TrendingUp },
  { key: 'dayclose', label: 'إغلاق اليوم', icon: CalendarCheck },
  { key: 'cashier', label: 'الكاشير', icon: Users },
  { key: 'product', label: 'المنتجات', icon: Package },
  { key: 'payment', label: 'طرق الدفع', icon: DollarSign },
  { key: 'tax', label: 'الضريبة', icon: Receipt },
  { key: 'lowstock', label: 'مخزون منخفض', icon: AlertTriangle },
  { key: 'shifts', label: 'الورديات', icon: Clock },
  { key: 'purge', label: 'تنظيف السجلات', icon: ShieldAlert },
];

export default function Reports() {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div>
      <Toaster />
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <BarChart2 className="text-brand-500" size={24} />
          <h2 className="text-2xl font-bold">التقارير / Reports</h2>
        </div>
        <button onClick={() => window.print()}
          className="no-print flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-lg text-sm font-medium text-gray-700">
          <Printer size={16} /> طباعة التقرير
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-6 border-b pb-2 no-print">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === key ? 'bg-brand-500 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      <div id="report-print-area">
        {activeTab === 'overview' && <OverviewTab />}
        {activeTab === 'sales' && <SalesTab />}
        {activeTab === 'dayclose' && <DayCloseTab />}
        {activeTab === 'cashier' && <ByCashierTab />}
        {activeTab === 'product' && <ByProductTab />}
        {activeTab === 'payment' && <PaymentMethodsTab />}
        {activeTab === 'tax' && <TaxSummaryTab />}
        {activeTab === 'lowstock' && <LowStockTab />}
        {activeTab === 'shifts' && <ShiftsTab />}
        {activeTab === 'purge' && <AdminPurgeTab />}
      </div>
    </div>
  );
}
