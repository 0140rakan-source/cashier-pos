import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../api/client';
import toast, { Toaster } from 'react-hot-toast';
import { Plus, Trash2 } from 'lucide-react';

export default function Expenses() {
  const { t } = useTranslation();
  const [list, setList] = useState([]);
  const [categories, setCategories] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ amount: 0, description: '', method: 'CASH', categoryId: '', notes: '' });

  useEffect(() => { load(); }, []);
  const load = async () => {
    try {
      const [e, c] = await Promise.all([api.get('/expenses'), api.get('/expenses/categories')]);
      setList(e.data.data || []);
      setCategories(c.data.data || []);
    } catch (e) { toast.error(e.response?.data?.message || e.message || "حدث خطأ"); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/expenses', { ...form, amount: Number(form.amount), categoryId: form.categoryId || null });
      toast.success(t('common.success'));
      setShowForm(false);
      setForm({ amount: 0, description: '', method: 'CASH', categoryId: '', notes: '' });
      load();
    } catch { toast.error(t('common.error')); }
  };

  const handleDelete = async (id) => {
    if (!confirm(t('common.confirm_delete'))) return;
    try { await api.delete(`/expenses/${id}`); toast.success(t('common.success')); load(); }
    catch { toast.error(t('common.error')); }
  };

  return (
    <div>
      <Toaster position="top-center" />
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">المصروفات</h2>
        <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 flex items-center gap-2">
          <Plus size={18} /> {t('common.add')}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6 grid grid-cols-2 gap-4">
          <input type="number" step="0.01" placeholder="المبلغ" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} className="border rounded-lg px-4 py-2 bg-gray-50" required />
          <input placeholder="الوصف" value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="border rounded-lg px-4 py-2 bg-gray-50" required dir="rtl" />
          <select value={form.method} onChange={e => setForm({...form, method: e.target.value})} className="border rounded-lg px-4 py-2 bg-gray-50">
            <option value="CASH">نقدي</option>
            <option value="CARD">بطاقة</option>
            <option value="TRANSFER">تحويل</option>
          </select>
          <select value={form.categoryId} onChange={e => setForm({...form, categoryId: e.target.value})} className="border rounded-lg px-4 py-2 bg-gray-50">
            <option value="">بدون تصنيف</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.nameAr}</option>)}
          </select>
          <input placeholder="ملاحظات" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="border rounded-lg px-4 py-2 bg-gray-50" dir="rtl" />
          <button type="submit" className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600">{t('common.save')}</button>
          <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200">{t('common.cancel')}</button>
        </form>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {list.length === 0 && <div className="p-8 text-center text-gray-400">{t('common.no_data')}</div>}
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-3 text-sm font-medium text-gray-500 text-start">الوصف</th>
              <th className="px-6 py-3 text-sm font-medium text-gray-500 text-start">المبلغ</th>
              <th className="px-6 py-3 text-sm font-medium text-gray-500 text-start">الطريقة</th>
              <th className="px-6 py-3 text-sm font-medium text-gray-500 text-start">أضاف</th>
              <th className="px-6 py-3 text-sm font-medium text-gray-500 text-start">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {list.map(exp => (
              <tr key={exp.id} className="border-b hover:bg-gray-50">
                <td className="px-6 py-4 text-sm font-medium">{exp.description}</td>
                <td className="px-6 py-4 text-sm font-bold text-red-600">{Number(exp.amount).toFixed(2)} SAR</td>
                <td className="px-6 py-4 text-sm">{exp.method === 'CASH' ? 'نقدي' : exp.method === 'CARD' ? 'بطاقة' : 'تحويل'}</td>
                <td className="px-6 py-4 text-sm text-gray-500">{exp.user.fullName}</td>
                <td className="px-6 py-4"><button className="text-gray-400 hover:text-red-500" onClick={() => handleDelete(exp.id)}><Trash2 size={16} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
