import React, { useState, useEffect, useCallback } from 'react';
import api from '../api/client';
import toast, { Toaster } from 'react-hot-toast';
import { CalendarCheck, Printer, RefreshCw, CheckCircle, Clock, DollarSign, Banknote, CreditCard } from 'lucide-react';

const fmtCur = (val) => `${Number(val || 0).toFixed(2)} ر.س`;
const fmtDate = (d) => d ? new Date(d).toLocaleString('ar-SA') : '—';

const Spinner = () => (
  <div className="flex items-center justify-center py-12">
    <div className="animate-spin w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full" />
  </div>
);

export default function DayClose() {
  const [current, setCurrent] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [selectedClose, setSelectedClose] = useState(null);

  const loadCurrent = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/day-close/current');
      setCurrent(res.data.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const res = await api.get('/day-close');
      setHistory(res.data.data || []);
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    loadCurrent();
    loadHistory();
  }, []);

  const handleClose = async () => {
    setClosing(true);
    try {
      const res = await api.post('/day-close');
      toast.success('تم إغلاق اليوم بنجاح ✅');
      setShowConfirm(false);
      setSelectedClose(res.data.data);
      loadCurrent();
      loadHistory();
    } catch (e) {
      toast.error(e.response?.data?.message || 'فشل إغلاق اليوم');
    } finally { setClosing(false); }
  };

  const loadCloseDetail = async (id) => {
    try {
      const res = await api.get(`/day-close/${id}`);
      setSelectedClose(res.data.data);
    } catch (e) { toast.error('فشل تحميل التقرير'); }
  };

  const ReportView = ({ data, title }) => (
    <div id="dayclose-print" className="bg-white rounded-2xl border shadow-sm p-6 space-y-5">
      <div className="flex items-center justify-between no-print">
        <h3 className="text-lg font-bold">{title}</h3>
        <button onClick={() => window.print()}
          className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm">
          <Printer size={14} /> طباعة
        </button>
      </div>

      {data.lastCloseAt && (
        <p className="text-xs text-gray-500">من: {fmtDate(data.periodStart)} — إلى: {fmtDate(data.periodEnd)}</p>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500">عدد العمليات</p>
          <p className="text-2xl font-bold">{data.saleCount}</p>
        </div>
        <div className="bg-emerald-50 rounded-xl border border-emerald-100 p-4">
          <div className="flex items-center gap-1 text-emerald-700 mb-1"><Banknote size={14} /><p className="text-xs">إجمالي النقد</p></div>
          <p className="text-xl font-bold text-emerald-800">{fmtCur(data.cashSales)}</p>
        </div>
        <div className="bg-blue-50 rounded-xl border border-blue-100 p-4">
          <div className="flex items-center gap-1 text-blue-700 mb-1"><CreditCard size={14} /><p className="text-xs">إجمالي الشبكة</p></div>
          <p className="text-xl font-bold text-blue-800">{fmtCur(data.cardSales)}</p>
        </div>
        <div className="bg-gray-50 rounded-xl border p-4">
          <div className="flex items-center gap-1 text-gray-700 mb-1"><DollarSign size={14} /><p className="text-xs">إجمالي المبيعات</p></div>
          <p className="text-xl font-bold">{fmtCur(data.grandTotal)}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border p-5 space-y-2 text-sm">
        <h3 className="font-semibold border-b pb-2 mb-3">ملخص مالي</h3>
        <div className="flex justify-between"><span className="text-gray-500">المجموع قبل الضريبة</span><span>{fmtCur(data.subtotal)}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">ضريبة القيمة المضافة 15%</span><span className="text-orange-600">{fmtCur(data.tax)}</span></div>
        {Number(data.discount) > 0 && <div className="flex justify-between"><span className="text-gray-500">الخصومات</span><span className="text-red-600">-{fmtCur(data.discount)}</span></div>}
        <div className="flex justify-between font-bold border-t pt-2"><span>الإجمالي النهائي</span><span>{fmtCur(data.grandTotal)}</span></div>
        <div className="flex justify-between text-gray-500"><span>تكلفة البضاعة</span><span>{fmtCur(data.totalCost)}</span></div>
        <div className="flex justify-between font-bold text-purple-700"><span>إجمالي الربح</span><span>{fmtCur(data.grossProfit)}</span></div>
      </div>

      {data.products?.length > 0 && (
        <div className="bg-white rounded-xl border overflow-hidden">
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
              {data.products.map((p, i) => (
                <tr key={i} className="border-b hover:bg-gray-50/50">
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
  );

  return (
    <div className="space-y-6" dir="rtl">
      <Toaster />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CalendarCheck className="text-brand-500" size={24} />
          <h2 className="text-2xl font-bold">إغلاق اليوم</h2>
        </div>
        <button onClick={() => { loadCurrent(); loadHistory(); }}
          className="no-print flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm">
          <RefreshCw size={14} /> تحديث
        </button>
      </div>

      {/* Current Period */}
      {loading ? <Spinner /> : current && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h3 className="font-bold text-amber-800 text-lg">الفترة الحالية</h3>
                <p className="text-xs text-amber-600 mt-1">
                  {current.lastCloseAt
                    ? `منذ آخر إغلاق: ${fmtDate(current.lastCloseAt)}`
                    : 'منذ بداية التشغيل'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-center">
                  <p className="text-2xl font-black text-amber-700">{fmtCur(current.grandTotal)}</p>
                  <p className="text-xs text-amber-600">{current.saleCount} عملية</p>
                </div>
                <button onClick={() => setShowConfirm(true)}
                  className="flex items-center gap-2 px-5 py-3 bg-red-500 text-white rounded-xl hover:bg-red-600 font-bold text-sm">
                  <CalendarCheck size={16} /> إغلاق اليوم
                </button>
              </div>
            </div>
          </div>

          <ReportView data={current} title="تقرير الفترة الحالية" />
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowConfirm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <div className="text-center mb-5">
              <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <CalendarCheck size={24} className="text-red-500" />
              </div>
              <h3 className="text-lg font-bold">تأكيد إغلاق اليوم</h3>
              <p className="text-sm text-gray-500 mt-2">سيتم حفظ تقرير الفترة الحالية وسيبدأ العد من الصفر</p>
              <p className="text-xs text-red-500 mt-1 font-medium">إجمالي: {fmtCur(current?.grandTotal)} — {current?.saleCount} عملية</p>
            </div>
            <div className="flex gap-3">
              <button onClick={handleClose} disabled={closing}
                className="flex-1 py-3 bg-red-500 text-white rounded-xl hover:bg-red-600 font-bold disabled:opacity-50">
                {closing ? 'جاري الإغلاق...' : 'تأكيد الإغلاق'}
              </button>
              <button onClick={() => setShowConfirm(false)}
                className="flex-1 py-3 bg-gray-100 rounded-xl hover:bg-gray-200 font-medium">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {/* Selected Historical Report */}
      {selectedClose && (
        <div className="space-y-2">
          <h3 className="font-bold text-gray-700 flex items-center gap-2">
            <CheckCircle size={18} className="text-emerald-500" />
            تقرير الإغلاق — {fmtDate(selectedClose.closedAt)}
          </h3>
          <ReportView data={selectedClose} title={`تقرير إغلاق — ${fmtDate(selectedClose.closedAt)}`} />
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
          <h3 className="px-5 py-3 font-semibold border-b text-sm flex items-center gap-2">
            <Clock size={16} className="text-gray-400" /> سجل الإغلاقات السابقة
          </h3>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-right text-xs text-gray-500">وقت الإغلاق</th>
                <th className="px-4 py-3 text-center text-xs text-gray-500">العمليات</th>
                <th className="px-4 py-3 text-right text-xs text-gray-500">نقد</th>
                <th className="px-4 py-3 text-right text-xs text-gray-500">شبكة</th>
                <th className="px-4 py-3 text-right text-xs text-gray-500">الإجمالي</th>
                <th className="px-4 py-3 text-right text-xs text-gray-500">الربح</th>
                <th className="px-4 py-3 text-center text-xs text-gray-500 no-print">عرض</th>
              </tr>
            </thead>
            <tbody>
              {history.map(h => (
                <tr key={h.id} className="border-b hover:bg-gray-50/50">
                  <td className="px-4 py-3 text-xs text-gray-600">{fmtDate(h.closedAt)}</td>
                  <td className="px-4 py-3 text-center">{h.saleCount}</td>
                  <td className="px-4 py-3 text-right text-emerald-700">{fmtCur(h.cashSales)}</td>
                  <td className="px-4 py-3 text-right text-blue-700">{fmtCur(h.cardSales)}</td>
                  <td className="px-4 py-3 text-right font-semibold">{fmtCur(h.grandTotal)}</td>
                  <td className="px-4 py-3 text-right text-purple-700 font-medium">{fmtCur(h.grossProfit)}</td>
                  <td className="px-4 py-3 text-center no-print">
                    <button onClick={() => loadCloseDetail(h.id)}
                      className="px-3 py-1 bg-gray-100 rounded-lg hover:bg-gray-200 text-xs">عرض</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
