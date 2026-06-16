import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../api/client';
import toast, { Toaster } from 'react-hot-toast';
import { Plus, Trash2 } from 'lucide-react';

export default function Suppliers() {
  const { t } = useTranslation();
  const [list, setList] = useState([]);
  const [form, setForm] = useState({ name: '', contact: '', phone: '', email: '', notes: '' });

  useEffect(() => { load(); }, []);
  const load = async () => {
    try { const r = await api.get('/suppliers'); setList(r.data.data || []); } catch (e) { toast.error(e.response?.data?.message || e.message || "حدث خطأ"); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try { await api.post('/suppliers', form); toast.success(t('common.success')); setForm({ name: '', contact: '', phone: '', email: '', notes: '' }); load(); }
    catch { toast.error(t('common.error')); }
  };

  const handleDelete = async (id) => {
    if (!confirm(t('common.confirm_delete'))) return;
    try { await api.delete(`/suppliers/${id}`); toast.success(t('common.success')); load(); }
    catch { toast.error(t('common.error')); }
  };

  return (
    <div>
      <Toaster position="top-center" />
      <h2 className="text-2xl font-bold mb-6">{t('suppliers.title')}</h2>
      <form onSubmit={handleSubmit} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6 flex gap-3 items-end flex-wrap">
        <input placeholder={t('suppliers.name')} value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="border rounded-lg px-4 py-2 bg-gray-50" required />
        <input placeholder={t('suppliers.phone')} value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="border rounded-lg px-4 py-2 bg-gray-50" />
        <button type="submit" className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 flex items-center gap-2 h-10">
          <Plus size={16} /> {t('common.add')}
        </button>
      </form>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-3 text-sm font-medium text-gray-500 text-start">{t('suppliers.name')}</th>
              <th className="px-6 py-3 text-sm font-medium text-gray-500 text-start">{t('suppliers.phone')}</th>
              <th className="px-6 py-3 text-sm font-medium text-gray-500 text-start">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {list.map(c => (
              <tr key={c.id} className="border-b hover:bg-gray-50">
                <td className="px-6 py-4 text-sm font-medium">{c.name}</td>
                <td className="px-6 py-4 text-sm">{c.phone || '—'}</td>
                <td className="px-6 py-4"><button className="text-gray-400 hover:text-red-500" onClick={() => handleDelete(c.id)}><Trash2 size={16} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 && <div className="p-8 text-center text-gray-400">{t('common.no_data')}</div>}
      </div>
    </div>
  );
}
