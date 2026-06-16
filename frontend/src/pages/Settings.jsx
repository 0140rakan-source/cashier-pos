import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../api/client';
import toast, { Toaster } from 'react-hot-toast';
import { Plus, Trash2, GripVertical } from 'lucide-react';

export default function Settings() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [logoPreview, setLogoPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();

  // Store/POS settings form
  const [form, setForm] = useState({
    nameAr: '', nameEn: '', addressAr: '', addressEn: '', phone: '', email: '', vatNumber: '', crNumber: '', logo: '',
    taxRate: 15, receiptHeaderAr: '', receiptFooterAr: '', receiptFooterEn: '', lowStockThreshold: 5,
    telegramBotToken: '', telegramChatId: '', telegramEnabled: false,
    defaultPaymentMethod: 'CASH', autoPrintReceipt: true,
  });

  // Order channels
  const [channels, setChannels] = useState([]);
  const [channelsDirty, setChannelsDirty] = useState(false);
  const [newChannel, setNewChannel] = useState({ key: '', label: '', defaultPayment: 'CASH' });

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [settingsRes, channelsRes] = await Promise.all([
        api.get('/settings'),
        api.get('/settings/channels').catch(() => ({ data: { data: [] } })),
      ]);
      const d = settingsRes.data.data || {};
      setForm({
        nameAr: d.nameAr || '', nameEn: d.nameEn || '', addressAr: d.addressAr || '', addressEn: d.addressEn || '',
        phone: d.phone || '', email: d.email || '', vatNumber: d.vatNumber || '', crNumber: d.crNumber || '', logo: d.logo || '',
        taxRate: d.taxRate ? Number(d.taxRate) * 100 : 15,
        receiptHeaderAr: d.receiptHeaderAr || '', receiptFooterAr: d.receiptFooterAr || '', receiptFooterEn: d.receiptFooterEn || '',
        lowStockThreshold: d.lowStockThreshold || 5, telegramBotToken: d.telegramBotToken || '', telegramChatId: d.telegramChatId || '',
        telegramEnabled: d.telegramEnabled || false, defaultPaymentMethod: d.defaultPaymentMethod || 'CASH', autoPrintReceipt: d.autoPrintReceipt ?? true,
      });
      if (d.logo) setLogoPreview(d.logo);

      // Load ALL channels (including disabled) from settings directly
      const allChannels = d.orderChannels || channelsRes.data.data || [
        { key: 'DIRECT', label: 'مباشر', enabled: true, defaultPayment: 'CASH' },
      ];
      setChannels(allChannels);
    } catch { toast.error('فشل تحميل الإعدادات'); }
    setLoading(false);
  };

  const handleLogoChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('logo', file);
      const res = await api.post('/settings/logo', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      const url = res.data.data?.logoUrl;
      setLogoPreview(url);
      setForm(prev => ({ ...prev, logo: url }));
      toast.success('✅ تم رفع الشعار');
    } catch { toast.error('فشل رفع الشعار'); }
    setUploading(false);
  };

  const handleSave = async () => {
    try {
      const payload = { ...form, taxRate: Number(form.taxRate) / 100, lowStockThreshold: Number(form.lowStockThreshold) };
      await api.put('/settings', payload);
      toast.success(t('common.success'));
      setEditing(false);
      loadAll();
    } catch { toast.error(t('common.error')); }
  };

  // ── Channel management ──
  const addChannel = () => {
    if (!newChannel.key.trim() || !newChannel.label.trim()) { toast.error('أدخل المعرف والاسم'); return; }
    if (channels.some(c => c.key === newChannel.key.trim().toUpperCase())) { toast.error('هذا المعرف موجود بالفعل'); return; }
    setChannels(prev => [...prev, { key: newChannel.key.trim().toUpperCase(), label: newChannel.label.trim(), enabled: true, defaultPayment: newChannel.defaultPayment || 'CASH' }]);
    setNewChannel({ key: '', label: '', defaultPayment: 'CASH' });
    setChannelsDirty(true);
  };

  const toggleChannel = (key) => {
    setChannels(prev => prev.map(c => c.key === key ? { ...c, enabled: !c.enabled } : c));
    setChannelsDirty(true);
  };

  const removeChannel = (key) => {
    setChannels(prev => prev.filter(c => c.key !== key));
    setChannelsDirty(true);
  };

  const updateChannelLabel = (key, label) => {
    setChannels(prev => prev.map(c => c.key === key ? { ...c, label } : c));
    setChannelsDirty(true);
  };

  const updateChannelPayment = (key, defaultPayment) => {
    setChannels(prev => prev.map(c => c.key === key ? { ...c, defaultPayment } : c));
    setChannelsDirty(true);
  };

  const saveChannels = async () => {
    try {
      await api.put('/settings/channels', { channels });
      toast.success('✅ تم حفظ قنوات الطلب');
      setChannelsDirty(false);
    } catch (err) { toast.error(err.response?.data?.message || 'فشل الحفظ'); }
  };

  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  if (loading) return <div className="p-8 text-center text-gray-400">{t('common.loading')}</div>;

  // Plain function (not a component) to avoid remounting inputs on re-render
  const field = (label, name, type = 'text', dir) => (
    <div key={name}>
      <label className="block text-sm text-gray-500 mb-1">{label}</label>
      <input type={type} value={form[name] ?? ''} onChange={e => setForm(prev => ({ ...prev, [name]: e.target.value }))}
        disabled={!editing} className="w-full border rounded-lg px-4 py-2 bg-gray-50 disabled:opacity-70" dir={dir} />
    </div>
  );

  return (
    <div className="space-y-6">
      <Toaster position="top-center" />
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{t('settings.title')}</h2>
        <button onClick={() => editing ? setEditing(false) : setEditing(true)}
          className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600">
          {editing ? t('common.cancel') : t('common.edit')}
        </button>
      </div>

      {/* Business Info */}
      <div className="bg-white rounded-xl shadow-sm border p-6 space-y-4">
        <h3 className="font-semibold text-lg border-b pb-2">معلومات المتجر / Business Info</h3>
        <div>
          <label className="block text-sm text-gray-500 mb-2">شعار المتجر / Logo</label>
          {logoPreview && (
            <img src={logoPreview.startsWith('/uploads') ? `${API_BASE}${logoPreview}` : logoPreview}
              alt="Store Logo" className="h-16 mb-3 rounded-lg border p-1 bg-gray-50" />
          )}
          {editing && (
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm font-medium disabled:opacity-50">
                {uploading ? 'جاري الرفع...' : 'اختر صورة'}
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
              <span className="text-xs text-gray-400">PNG/JPG بحد أقصى 5MB</span>
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {field("اسم المتجر (عربي)", "nameAr", "text", "rtl")}
          {field("اسم المتجر (إنجليزي)", "nameEn")}
          {field("العنوان (عربي)", "addressAr", "text", "rtl")}
          {field("العنوان (إنجليزي)", "addressEn")}
          {field("الهاتف", "phone")}
          {field("البريد الإلكتروني", "email")}
          {field("الرقم الضريبي", "vatNumber")}
          {field("السجل التجاري", "crNumber")}
        </div>
      </div>

      {/* POS Settings */}
      <div className="bg-white rounded-xl shadow-sm border p-6 space-y-4">
        <h3 className="font-semibold text-lg border-b pb-2">إعدادات نقطة البيع / POS Settings</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {field("نسبة الضريبة %", "taxRate", "number")}
          {field("حد التنبيه للمخزون", "lowStockThreshold", "number")}
          {field("رأس الفاتورة (عربي)", "receiptHeaderAr", "text", "rtl")}
          {field("ذيل الفاتورة (عربي)", "receiptFooterAr", "text", "rtl")}
        </div>
        <div className="flex items-center gap-3">
          <input type="checkbox" id="autoPrint" checked={form.autoPrintReceipt}
            onChange={e => setForm(prev => ({ ...prev, autoPrintReceipt: e.target.checked }))} disabled={!editing} className="rounded" />
          <label htmlFor="autoPrint" className="text-sm text-gray-700">طباعة تلقائية</label>
        </div>
      </div>

      {/* ── Order Channels Management ── */}
      <div className="bg-white rounded-xl shadow-sm border p-6 space-y-4">
        <h3 className="font-semibold text-lg border-b pb-2">📋 قنوات الطلب / Order Channels</h3>
        <p className="text-xs text-gray-500">هذه القنوات تظهر في شاشة الدفع بنقطة البيع. يمكنك إضافة/تعديل/تعطيل القنوات حسب حاجتك.</p>

        {/* Existing channels */}
        <div className="space-y-2">
          {channels.map(ch => (
            <div key={ch.key} className={`flex items-center gap-3 p-3 rounded-lg border ${ch.enabled ? 'bg-white' : 'bg-gray-50 opacity-60'}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded">{ch.key}</span>
                  <input value={ch.label} onChange={e => updateChannelLabel(ch.key, e.target.value)}
                    className="border-0 border-b border-transparent hover:border-gray-300 focus:border-brand-500 bg-transparent font-medium text-sm outline-none px-1 py-0.5"
                    dir="rtl" />
                </div>
              </div>
              <select value={ch.defaultPayment || 'CASH'} onChange={e => updateChannelPayment(ch.key, e.target.value)}
                className="text-xs border rounded px-2 py-1 bg-gray-50">
                <option value="CASH">نقد</option>
                <option value="CARD">بطاقة</option>
              </select>
              <button onClick={() => toggleChannel(ch.key)}
                className={`text-xs px-3 py-1 rounded-full font-medium ${ch.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
                {ch.enabled ? 'مفعّل' : 'معطّل'}
              </button>
              <button onClick={() => removeChannel(ch.key)} className="text-red-400 hover:text-red-600 p-1">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>

        {/* Add new channel */}
        <div className="flex items-end gap-2 pt-2 border-t">
          <div className="flex-1">
            <label className="block text-xs text-gray-400 mb-1">المعرف (إنجليزي)</label>
            <input value={newChannel.key} onChange={e => setNewChannel(prev => ({ ...prev, key: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '') }))}
              placeholder="WHATSAPP" className="w-full px-3 py-2 border rounded-lg bg-gray-50 text-sm font-mono" dir="ltr" />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-gray-400 mb-1">الاسم (عربي)</label>
            <input value={newChannel.label} onChange={e => setNewChannel(prev => ({ ...prev, label: e.target.value }))}
              placeholder="واتساب" className="w-full px-3 py-2 border rounded-lg bg-gray-50 text-sm" dir="rtl" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">الدفع</label>
            <select value={newChannel.defaultPayment} onChange={e => setNewChannel(prev => ({ ...prev, defaultPayment: e.target.value }))}
              className="px-3 py-2 border rounded-lg bg-gray-50 text-sm">
              <option value="CASH">نقد</option>
              <option value="CARD">بطاقة</option>
            </select>
          </div>
          <button onClick={addChannel} className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 flex items-center gap-1 text-sm">
            <Plus size={16} /> إضافة
          </button>
        </div>

        {channelsDirty && (
          <button onClick={saveChannels} className="w-full py-2.5 bg-brand-500 text-white rounded-lg hover:bg-brand-600 font-bold">
            💾 حفظ قنوات الطلب
          </button>
        )}
      </div>

      {/* Telegram */}
      <div className="bg-white rounded-xl shadow-sm border p-6 space-y-4">
        <h3 className="font-semibold text-lg border-b pb-2">Telegram</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {field("Bot Token", "telegramBotToken")}
          {field("Chat ID", "telegramChatId")}
        </div>
        <div className="flex items-center gap-3">
          <input type="checkbox" id="tgEnabled" checked={form.telegramEnabled}
            onChange={e => setForm(prev => ({ ...prev, telegramEnabled: e.target.checked }))} disabled={!editing} className="rounded" />
          <label htmlFor="tgEnabled" className="text-sm text-gray-700">Enabled</label>
        </div>
      </div>

      {editing && (
        <button onClick={handleSave} className="w-full py-3 bg-brand-500 text-white rounded-xl hover:bg-brand-600 font-bold text-lg">
          {t('common.save')}
        </button>
      )}
    </div>
  );
}
