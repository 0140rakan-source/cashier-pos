import React, { useState, useEffect, useCallback } from 'react';
import api from '../api/client';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store';
import toast, { Toaster } from 'react-hot-toast';
import { ArrowLeft, Clock, DollarSign, Calculator, Play, Square, TrendingUp, TrendingDown } from 'lucide-react';

export default function Shifts() {
  const navigate = useNavigate();
  const { user: currentUser } = useAuthStore();

  const [shifts, setShifts] = useState([]);
  const [currentShift, setCurrentShift] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showOpenForm, setShowOpenForm] = useState(false);
  const [openCash, setOpenCash] = useState(1000);

  const [showCloseForm, setShowCloseForm] = useState(false);
  const [closeCash, setCloseCash] = useState(0);
  const [expectedCash, setExpectedCash] = useState(0);
  const [variance, setVariance] = useState(0);
  const [shiftBreakdown, setShiftBreakdown] = useState({ cash: 0, card: 0, total: 0, count: 0 });

  const loadShifts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/shifts');
      const allShifts = res.data.data || [];
      setShifts(allShifts);
      const open = allShifts.find(s => s.status === 'OPEN' && s.userId === currentUser?.id)
        || allShifts.find(s => s.status === 'OPEN');
      setCurrentShift(open || null);
      setShowOpenForm(!open);
    } catch (e) {
      const msg = e.response?.data?.message || e.message || 'فشل تحميل الورديات';
      setError(msg);
      toast.error(msg);
      setShowOpenForm(true);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    loadShifts();
    return () => {}; // cleanup
  }, [loadShifts]);

  const handleOpenShift = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/shifts', { startingCash: Number(openCash) });
      setCurrentShift(res.data.data);
      setShowOpenForm(false);
      toast.success('✅ تم فتح الوردية');
      loadShifts();
    } catch (err) {
      toast.error(err.response?.data?.message || 'فشل فتح الوردية');
    }
  };

  const startClose = async () => {
    if (!currentShift) return;
    try {
      const salesRes = await api.get('/sales');
      const allSales = salesRes.data.data || [];
      const shiftSales = allSales.filter(s => {
        if (s.shiftId) return s.shiftId === currentShift.id;
        if (!currentShift.openedAt) return false;
        return new Date(s.createdAt) >= new Date(currentShift.openedAt);
      });

      let cashSales = 0, cardSales = 0;
      for (const sale of shiftSales) {
        for (const p of (sale.payments || [])) {
          const amt = Number(p.amount || 0);
          if (p.method === 'CASH') cashSales += amt;
          else cardSales += amt;
        }
        if (!sale.payments?.length) cashSales += Number(sale.grandTotal || 0);
      }

      const breakdown = { cash: cashSales, card: cardSales, total: cashSales + cardSales, count: shiftSales.length };
      setShiftBreakdown(breakdown);

      const expected = Number(currentShift.startingCash || 0) + cashSales;
      setExpectedCash(expected);
      setCloseCash(expected);
      setVariance(0);
      setShowCloseForm(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'فشل تحميل بيانات الوردية');
    }
  };

  const closeShift = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/shifts/${currentShift.id}`, {
        endingCash: Number(closeCash),
        variance: Number(variance),
      });
      toast.success('✅ تم إغلاق الوردية');
      setShowCloseForm(false);
      setCurrentShift(null);
      loadShifts();
    } catch (err) {
      toast.error(err.response?.data?.message || 'فشل إغلاق الوردية');
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-gray-400 text-lg animate-pulse">⏳ جاري التحميل...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <Toaster position="top-center" />

      <div className="bg-white shadow px-6 py-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">الورديات / Shifts</h1>
        <button onClick={() => navigate('/dashboard')} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50 flex items-center gap-2">
          <ArrowLeft size={16} /> Dashboard
        </button>
      </div>

      <div className="max-w-3xl mx-auto p-6 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 flex items-center gap-2">
            ⚠️ {error}
            <button onClick={loadShifts} className="mr-auto text-sm underline">إعادة المحاولة</button>
          </div>
        )}

        {/* Active shift */}
        {currentShift && !showCloseForm && (
          <div className="bg-white rounded-2xl shadow p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center animate-pulse">
                <Clock size={24} className="text-emerald-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold">وردية مفتوحة / Shift Active</h2>
                <p className="text-sm text-gray-500">
                  {new Date(currentShift.openedAt || currentShift.createdAt).toLocaleString('ar-SA')}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-sm text-gray-500 mb-1">رصيد البداية</p>
                <p className="text-2xl font-bold">{Number(currentShift.startingCash || 0).toFixed(2)}</p>
                <p className="text-xs text-gray-400">ر.س</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-sm text-gray-500 mb-1">الحالة</p>
                <p className="text-xl font-bold text-emerald-600">مفتوحة</p>
              </div>
            </div>
            <button onClick={startClose} className="w-full mt-6 py-3.5 bg-red-500 text-white rounded-xl hover:bg-red-600 font-bold text-lg flex items-center justify-center gap-2">
              <Square size={20} /> إغلاق الوردية / Close Shift
            </button>
          </div>
        )}

        {/* Open shift form */}
        {showOpenForm && !currentShift && (
          <div className="bg-white rounded-2xl shadow p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-brand-100 flex items-center justify-center">
                <Play size={24} className="text-brand-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold">فتح وردية جديدة</h2>
                <p className="text-sm text-gray-500">Start a new cashier shift</p>
              </div>
            </div>
            <form onSubmit={handleOpenShift} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-500 mb-2">رصيد البداية (ر.س)</label>
                <div className="relative">
                  <DollarSign size={20} className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="number" value={openCash} onChange={e => setOpenCash(Number(e.target.value))}
                    className="w-full ps-10 pe-4 py-4 text-2xl font-bold border rounded-xl bg-gray-50 outline-none focus:ring-2 focus:ring-blue-400"
                    placeholder="0.00" step="0.01" min="0" required
                  />
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[500, 1000, 2000, 5000].map(v => (
                  <button key={v} type="button" onClick={() => setOpenCash(v)} className="py-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm font-medium">{v}</button>
                ))}
              </div>
              <button type="submit" className="w-full py-4 bg-green-500 text-white rounded-xl hover:bg-green-600 font-bold text-lg">
                فتح الوردية / Open Shift
              </button>
            </form>
          </div>
        )}

        {/* Close shift form */}
        {showCloseForm && currentShift && (
          <div className="bg-white rounded-2xl shadow p-6">
            <div className="flex items-center gap-3 mb-6">
              <Calculator size={24} className="text-red-500" />
              <div>
                <h2 className="text-lg font-bold">إغلاق الوردية / Close Shift</h2>
                <p className="text-sm text-gray-500">أدخل النقد الفعلي في الدرج</p>
              </div>
            </div>

            <form onSubmit={closeShift} className="space-y-6">
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-2 text-sm">
                <p className="font-semibold text-blue-800 mb-2">ملخص مبيعات الوردية</p>
                <div className="flex justify-between"><span className="text-gray-600">عدد العمليات</span><span className="font-medium">{shiftBreakdown.count}</span></div>
                <div className="flex justify-between text-green-700"><span>إجمالي النقد</span><span className="font-bold">{shiftBreakdown.cash.toFixed(2)} ر.س</span></div>
                <div className="flex justify-between text-blue-700"><span>إجمالي البطاقة</span><span className="font-bold">{shiftBreakdown.card.toFixed(2)} ر.س</span></div>
                <div className="border-t border-blue-200 pt-2 flex justify-between font-bold"><span>إجمالي المبيعات</span><span>{shiftBreakdown.total.toFixed(2)} ر.س</span></div>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm"><span className="text-gray-500">نقد البداية</span><span>{Number(currentShift.startingCash || 0).toFixed(2)} ر.س</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-500">مبيعات نقدية</span><span className="text-green-700 font-medium">+{shiftBreakdown.cash.toFixed(2)} ر.س</span></div>
                <div className="border-t pt-2 flex justify-between font-bold text-lg"><span>النقد المتوقع في الدرج</span><span>{expectedCash.toFixed(2)} ر.س</span></div>
              </div>

              <div>
                <label className="block text-sm text-gray-500 mb-2">النقد الفعلي في الدرج (ر.س)</label>
                <input
                  type="number"
                  value={closeCash}
                  onChange={e => {
                    const val = Number(e.target.value);
                    setCloseCash(val);
                    setVariance(val - expectedCash);
                  }}
                  className="w-full px-4 py-4 text-2xl font-bold border rounded-xl bg-gray-50 outline-none focus:ring-2 focus:ring-blue-400"
                  step="0.01" min="0" required
                />
              </div>

              {variance !== 0 && (
                <div className={`rounded-xl p-4 flex items-center gap-2 ${variance >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {variance >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                  <span className="font-bold">الفرق: {variance >= 0 ? '+' : ''}{variance.toFixed(2)} ر.س</span>
                </div>
              )}

              <div className="flex gap-3">
                <button type="button" onClick={() => setShowCloseForm(false)} className="flex-1 py-3 border rounded-xl hover:bg-gray-50">إلغاء</button>
                <button type="submit" className="flex-1 py-3 bg-red-500 text-white rounded-xl hover:bg-red-600 font-bold">تأكيد الإغلاق</button>
              </div>
            </form>
          </div>
        )}

        {/* Shifts history */}
        {shifts.filter(s => s.status === 'CLOSED').length > 0 && (
          <div className="bg-white rounded-2xl shadow p-6">
            <h2 className="text-lg font-bold mb-4">الورديات السابقة</h2>
            <div className="space-y-3">
              {shifts.filter(s => s.status === 'CLOSED').slice(0, 10).map(shift => (
                <div key={shift.id} className="border rounded-xl p-4 flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium">{new Date(shift.openedAt || shift.createdAt).toLocaleDateString('ar-SA')}</p>
                    <p className="text-xs text-gray-500">{shift.user?.fullName || 'غير محدد'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">{Number(shift.endingCash || 0).toFixed(2)} ر.س</p>
                    <p className="text-xs text-gray-500">النقد الختامي</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
