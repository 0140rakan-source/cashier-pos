import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../api/client';
import toast, { Toaster } from 'react-hot-toast';
import { AlertTriangle, Plus, TrendingDown, TrendingUp, Loader2 } from 'lucide-react';

export default function Inventory() {
  const { t } = useTranslation();
  const [inventory, setInventory] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loadingInventory, setLoadingInventory] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [adjustForm, setAdjustForm] = useState({ productId: '', quantity: 0, changeType: 'IN', note: '' });

  useEffect(() => {
    loadInventory();
    loadLowStock();
    loadLogs();
  }, []);

  const loadInventory = async () => {
    setLoadingInventory(true);
    try {
      const [invRes, lowRes] = await Promise.all([
        api.get('/inventory'),
        api.get('/inventory/low-stock'),
      ]);
      setInventory(invRes.data.data || []);
      setLowStock(lowRes.data.data || []);
    } catch {
      toast.error('Failed to load inventory');
    } finally {
      setLoadingInventory(false);
    }
  };

  const loadLowStock = async () => {
    try {
      const res = await api.get('/inventory/low-stock');
      setLowStock(res.data.data || []);
    } catch {}
  };

  const loadLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await api.get('/inventory/logs');
      setLogs(res.data.data || []);
    } catch (e) { toast.error(e.response?.data?.message || e.message || "حدث خطأ"); } finally {
      setLoadingLogs(false);
    }
  };

  const handleAdjust = async (e) => {
    e.preventDefault();
    try {
      await api.post('/inventory/adjust', adjustForm);
      toast.success(t('common.success'));
      setAdjustForm({ productId: '', quantity: 0, changeType: 'IN', note: '' });
      setShowForm(false);
      loadInventory();
      loadLowStock();
      loadLogs();
    } catch (e) { toast.error(e.response?.data?.message || t('common.error')); }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'IN': case 'PURCHASE': return <TrendingUp size={14} className="text-green-600" />;
      case 'OUT': case 'SALE': return <TrendingDown size={14} className="text-red-600" />;
      case 'ADJUST': return <Plus size={14} className="text-blue-600" />;
      default: return '';
    }
  };

  return (
    <div className="space-y-6">
      <Toaster position="top-center" />
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{t('nav.inventory')}</h2>
        <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 flex items-center gap-2">
          <Plus size={18} /> {t('inventory.adjust_stock')}
        </button>
      </div>

      {/* Low Stock Alert */}
      {lowStock.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="text-amber-500" size={20} />
          <span className="text-amber-800 font-medium">
            ⚠️ {t('inventory.low_stock_alert')}: {lowStock.map(i => i.product?.nameAr || '—').join(', ')}
          </span>
        </div>
      )}

      {/* Adjust Form */}
      {showForm && (
        <form onSubmit={handleAdjust} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 grid grid-cols-2 gap-3">
          <select value={adjustForm.productId} onChange={e => setAdjustForm({ ...adjustForm, productId: e.target.value })} className="px-3 py-2 border rounded-lg bg-gray-50" required>
            <option value="">اختر المنتج</option>
            {inventory.map(i => <option key={i.id} value={i.productId}>{i.product?.nameAr} (المخزون: {Number(i.currentStock).toFixed(0)})</option>)}
          </select>
          <input type="number" value={adjustForm.quantity} onChange={e => setAdjustForm({ ...adjustForm, quantity: e.target.value })} placeholder="الكمية" className="px-3 py-2 border rounded-lg bg-gray-50" required />
          <select value={adjustForm.changeType} onChange={e => setAdjustForm({ ...adjustForm, changeType: e.target.value })} className="px-3 py-2 border rounded-lg bg-gray-50" required>
            <option value="IN">إدخال / IN</option>
            <option value="OUT">إخراج / OUT</option>
            <option value="ADJUST">تعديل / ADJUST</option>
          </select>
          <input value={adjustForm.note} onChange={e => setAdjustForm({ ...adjustForm, note: e.target.value })} placeholder="ملاحظة" className="px-3 py-2 border rounded-lg bg-gray-50" />
          <div className="col-span-2 flex gap-3">
            <button type="submit" className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600">{t('common.save')}</button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200">{t('common.cancel')}</button>
          </div>
        </form>
      )}

      {/* Stock Table — with Purchase Price */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('common.name')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">سعر الشراء / Cost</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">سعر البيع / Sale</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('inventory.current')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('inventory.min')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('inventory.unit')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">الحالة</th>
            </tr>
          </thead>
          <tbody>
            {inventory.length === 0 ? (
              <tr><td colSpan={7} className="px-6 py-8 text-center text-gray-400">{t('common.no_data')}</td></tr>
            ) : inventory.map(item => {
              const stock = Number(item.currentStock);
              const min = Number(item.minStock);
              const isLow = stock <= min;
              const isOut = stock === 0;
              return (
                <tr key={item.id} className="border-b hover:bg-gray-50/50">
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium">{item.product?.nameAr}</p>
                    {item.product?.nameEn && <p className="text-xs text-gray-400">{item.product.nameEn}</p>}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 font-mono">
                    {Number(item.product?.costPrice || 0).toFixed(2)} <span className="text-xs text-gray-400">ر.س</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-brand-600 font-mono font-medium">
                    {Number(item.product?.salePrice || 0).toFixed(2)} <span className="text-xs text-gray-400">ر.س</span>
                  </td>
                  <td className={`px-6 py-4 text-sm font-bold ${isOut ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-gray-800'}`}>
                    {stock.toFixed(0)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{min.toFixed(0)}</td>
                  <td className="px-6 py-4 text-sm">{item.unit || '—'}</td>
                  <td className="px-6 py-4">
                    {isOut ? (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-700">نفد</span>
                    ) : isLow ? (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700">منخفض</span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-700">جيد</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Recent Logs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <h3 className="px-6 py-3 text-sm font-semibold">{t('inventory.recent_activity')}</h3>
        {logs.length === 0 ? <p className="px-6 pb-6 text-sm text-gray-400">{t('common.no_data')}</p> : (
          <table className="w-full">
            <tbody>
              {logs.slice(0, 15).map(l => (
                <tr key={l.id} className="border-b hover:bg-gray-50/50">
                  <td className="px-6 py-3 text-sm flex items-center gap-2">
                    {getTypeIcon(l.changeType)}
                    <span className="font-medium">{l.changeType}</span>
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-500 font-mono" title={l.productId}>{l.productId ? l.productId.slice(0, 8) + '…' : '—'}</td>
                  <td className="px-6 py-3 text-sm">
                    <span className={Number(l.quantity) > 0 ? 'text-emerald-600 font-medium' : 'text-red-500 font-medium'}>
                      {Number(l.quantity) > 0 ? '+' : ''}{Number(l.quantity).toFixed(0)}
                    </span>
                    <span className="text-xs text-gray-400 ml-1">({Number(l.previousQty).toFixed(0)} → {Number(l.newQty).toFixed(0)})</span>
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-500">{l.note || '—'}</td>
                  <td className="px-6 py-3 text-sm text-gray-400">{new Date(l.createdAt).toLocaleString('ar-SA')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
