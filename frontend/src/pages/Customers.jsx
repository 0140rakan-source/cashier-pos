import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../api/client';
import toast, { Toaster } from 'react-hot-toast';
import { Plus, Trash2, UserRound } from 'lucide-react';

export default function Customers() {
  const { t, i18n } = useTranslation();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '', vatNumber: '', notes: '' });
  const [error, setError] = useState(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/customers');
      const data = res.data.data || [];
      setList(data);
    } catch (err) {
      console.error('Failed to load customers:', err);
      setError(err.response?.data?.message || 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/customers', form);
      toast.success(t('common.success'));
      setShowForm(false);
      setForm({ name: '', phone: '', email: '', vatNumber: '', notes: '' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || t('common.error'));
    }
  };

  const handleDelete = async (id) => {
    if (!confirm(t('common.confirm_delete'))) return;
    try {
      await api.delete(`/customers/${id}`);
      toast.success(t('common.success'));
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || t('common.error'));
    }
  };

  // ─── Loading ────────────────────────────────────────────────
  if (loading) {
    return <div className="h-full flex items-center justify-center text-gray-400">{t('common.loading')}</div>;
  }

  // ─── Error ────────────────────────────────────────────────
  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <UserRound size={48} className="mx-auto mb-4 text-gray-300" />
          <p className="text-red-500 font-medium">{error}</p>
          <button onClick={load} className="mt-4 px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600">{t('common.add')}</button>
        </div>
      </div>
    );
  }

  // ─── Main ────────────────────────────────────────────────
  return (
    <div>
      <Toaster position="top-center" />
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">{t('customers.title')}</h2>
        <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 flex items-center gap-2">
          <Plus size={18} /> {t('common.add')}
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6 grid grid-cols-2 gap-4">
          <input placeholder={t('customers.name')} value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="border rounded-lg px-4 py-2 bg-gray-50" required dir={i18n.language === 'ar' ? 'rtl' : 'ltr'} />
          <input placeholder={t('common.phone')} value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="border rounded-lg px-4 py-2 bg-gray-50" />
          <input placeholder={t('common.email')} value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="border rounded-lg px-4 py-2 bg-gray-50" />
          <input placeholder={t('customers.vat_number')} value={form.vatNumber} onChange={e => setForm({...form, vatNumber: e.target.value})} className="border rounded-lg px-4 py-2 bg-gray-50" />
          <div className="col-span-2">
            <input placeholder={t('common.notes')} value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="border rounded-lg px-4 py-2 bg-gray-50 w-full" dir={i18n.language === 'ar' ? 'rtl' : 'ltr'} />
          </div>
          <div className="col-span-2 flex gap-3">
            <button type="submit" className="px-6 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600">{t('common.save')}</button>
            <button type="button" onClick={() => setShowForm(false)} className="px-6 py-2 bg-gray-100 rounded-lg hover:bg-gray-200">{t('common.cancel')}</button>
          </div>
        </form>
      )}

      {/* List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        {list.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <UserRound size={48} className="mx-auto mb-4 opacity-30" />
            <p>{t('common.no_data')}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {list.map(c => {
              // Safe number conversion (Prisma Decimal → string → number)
              const totalPurchases = Number(c.totalPurchases || 0);
              return (
                <div key={c.id} className="flex items-center gap-4 p-4 hover:bg-gray-50 transition">
                  <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center shrink-0">
                    <UserRound size={18} className="text-brand-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{c.name}</p>
                    <p className="text-sm text-gray-400">{c.phone || c.email || '—'}</p>
                    {c.vatNumber && <p className="text-xs text-gray-400">VAT: {c.vatNumber}</p>}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm text-gray-500">{totalPurchases.toFixed(2)} SAR</span>
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="text-gray-400 hover:text-red-500 transition p-1"
                      title={t('common.delete')}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
