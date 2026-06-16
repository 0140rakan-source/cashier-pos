import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../api/client';
import toast, { Toaster } from 'react-hot-toast';
import { Plus, Trash2, Pencil } from 'lucide-react';

export default function Categories() {
  const { t } = useTranslation();
  const [categories, setCategories] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ nameAr: '', nameEn: '', sortOrder: 0 });

  useEffect(() => { load(); }, []);
  const load = async () => {
    try { const r = await api.get('/categories'); setCategories(r.data.data || []); } catch (e) { toast.error(e.response?.data?.message || e.message || "حدث خطأ"); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/categories', { ...form, sortOrder: Number(form.sortOrder) });
      toast.success(t('common.success'));
      setShowForm(false);
      setForm({ nameAr: '', nameEn: '', sortOrder: 0 });
      load();
    } catch { toast.error(t('common.error')); }
  };

  const handleDelete = async (id) => {
    if (!confirm(t('common.confirm_delete'))) return;
    try { await api.delete(`/categories/${id}`); toast.success(t('common.success')); load(); }
    catch { toast.error(t('common.error')); }
  };

  return (
    <div>
      <Toaster position="top-center" />
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">{t('categories.title')}</h2>
        <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 flex items-center gap-2">
          <Plus size={18} /> {t('common.add')}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6 flex gap-3 items-end flex-wrap">
          <div><label className="text-xs text-gray-500">{t('categories.name_ar')}</label>
            <input value={form.nameAr} onChange={e => setForm({...form, nameAr: e.target.value})} className="border rounded-lg px-3 py-2 bg-gray-50 w-40" required dir="rtl" />
          </div>
          <div><label className="text-xs text-gray-500">{t('categories.name_en')}</label>
            <input value={form.nameEn} onChange={e => setForm({...form, nameEn: e.target.value})} className="border rounded-lg px-3 py-2 bg-gray-50 w-40" required />
          </div>
          <div><label className="text-xs text-gray-500">{t('categories.sort_order')}</label>
            <input type="number" value={form.sortOrder} onChange={e => setForm({...form, sortOrder: e.target.value})} className="border rounded-lg px-3 py-2 bg-gray-50 w-20" />
          </div>
          <button type="submit" className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 h-10">
            {t('common.save')}
          </button>
          <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 h-10">
            {t('common.cancel')}
          </button>
        </form>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-3 text-sm font-medium text-gray-500 text-start">{t('categories.name_ar')}</th>
              <th className="px-6 py-3 text-sm font-medium text-gray-500 text-start">{t('categories.name_en')}</th>
              <th className="px-6 py-3 text-sm font-medium text-gray-500 text-start">{t('categories.sort_order')}</th>
              <th className="px-6 py-3 text-sm font-medium text-gray-500 text-start">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {categories.map(c => (
              <tr key={c.id} className="border-b hover:bg-gray-50">
                <td className="px-6 py-4 text-sm font-medium">{c.nameAr}</td>
                <td className="px-6 py-4 text-sm">{c.nameEn}</td>
                <td className="px-6 py-4 text-sm">{c.sortOrder}</td>
                <td className="px-6 py-4 flex gap-2">
                  <button className="text-gray-400 hover:text-blue-500"><Pencil size={16} /></button>
                  <button className="text-gray-400 hover:text-red-500" onClick={() => handleDelete(c.id)}><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {categories.length === 0 && <div className="p-8 text-center text-gray-400">{t('common.no_data')}</div>}
      </div>
    </div>
  );
}
