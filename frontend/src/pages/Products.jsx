import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../api/client';
import toast, { Toaster } from 'react-hot-toast';
import {
  Plus, Pencil, Trash2, X, Archive, RotateCcw, Search, Barcode, Settings2,
  Info, Layers3, Tag, Warehouse, Image as ImageIcon, GripVertical, Camera
} from 'lucide-react';

const EMPTY_FORM = {
  nameAr: '', nameEn: '', barcode: '', sku: '', categoryId: '',
  salePrice: '', costPrice: '', taxRate: 15, trackStock: true, openingStock: '', isActive: true,
};

const newOption = () => ({ _key: Math.random().toString(36).slice(2), id: null, nameAr: '', nameEn: '', priceDelta: '0', isAvailable: true });
const newGroup = () => ({ _key: Math.random().toString(36).slice(2), id: null, nameAr: '', nameEn: '', required: false, minSelect: 0, maxSelect: 1, options: [newOption()] });

const TABS = [
  { key: 'basic',     label: 'معلومات أساسية', icon: Info },
  { key: 'addons',    label: 'الخيارات / الإضافات', icon: Layers3 },
  { key: 'prices',    label: 'الأسعار', icon: Tag },
  { key: 'inventory', label: 'المخزون', icon: Warehouse },
  { key: 'images',    label: 'الصور', icon: ImageIcon },
];

export default function Products() {
  const { t } = useTranslation();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState('active');
  const [actionModal, setActionModal] = useState(null);
  const [activeTab, setActiveTab] = useState('basic');

  // Modifier groups (loaded when editing; saved after product save)
  const [groups, setGroups] = useState([]);
  const [savingGroups, setSavingGroups] = useState(false);

  const loadProducts = useCallback(() => {
    setLoading(true);
    api.get('/products', { params: { active: viewMode === 'active' ? 'true' : viewMode === 'archived' ? 'false' : 'all' } })
      .then(r => setProducts(r.data.data || []))
      .catch(() => toast.error('تعذّر تحميل المنتجات'))
      .finally(() => setLoading(false));
  }, [viewMode]);

  useEffect(() => { loadProducts(); }, [loadProducts]);
  useEffect(() => { api.get('/categories').then(r => setCategories(r.data.data || [])).catch(e => console.error(e)); }, []);

  const openAddModal = () => {
    setEditingId(null); setForm({ ...EMPTY_FORM }); setGroups([]); setActiveTab('basic'); setShowModal(true);
  };

  const openEditModal = async (p) => {
    setEditingId(p.id);
    setForm({
      nameAr: p.nameAr || '', nameEn: p.nameEn || '', barcode: p.barcode || '', sku: p.sku || '',
      categoryId: p.categoryId || '',
      salePrice: p.salePrice != null ? String(Number(p.salePrice)) : '',
      costPrice: p.costPrice != null ? String(Number(p.costPrice)) : '',
      taxRate: p.taxRate != null ? String(Number(p.taxRate) * 100) : '15',
      trackStock: p.trackStock ?? true, openingStock: '', isActive: p.isActive ?? true,
    });
    setActiveTab('basic');
    setShowModal(true);
    // load groups
    try {
      const res = await api.get(`/modifier-groups/${p.id}`);
      setGroups((res.data.data || []).map(g => ({
        _key: g.id, id: g.id, nameAr: g.nameAr, nameEn: g.nameEn || '',
        required: !!g.required, minSelect: Number(g.minSelect), maxSelect: Number(g.maxSelect),
        options: (g.options || []).map(o => ({
          _key: o.id, id: o.id, nameAr: o.nameAr, nameEn: o.nameEn || '',
          priceDelta: String(Number(o.priceDelta)), isAvailable: o.isAvailable !== false,
        })),
      })));
    } catch { setGroups([]); }
  };

  // ─── group editor helpers ───
  const addGroup = () => setGroups(prev => [...prev, newGroup()]);
  const removeGroup = (k) => setGroups(prev => prev.filter(g => g._key !== k));
  const updateGroup = (k, patch) => setGroups(prev => prev.map(g => g._key === k ? { ...g, ...patch } : g));
  const addOption = (gk) => setGroups(prev => prev.map(g => g._key === gk ? { ...g, options: [...g.options, newOption()] } : g));
  const removeOption = (gk, ok) => setGroups(prev => prev.map(g => g._key === gk ? { ...g, options: g.options.filter(o => o._key !== ok) } : g));
  const updateOption = (gk, ok, patch) => setGroups(prev => prev.map(g => g._key === gk
    ? { ...g, options: g.options.map(o => o._key === ok ? { ...o, ...patch } : o) } : g));

  const buildGroupsPayload = () => groups
    .map((g, gi) => ({
      id: g.id, nameAr: g.nameAr.trim(), nameEn: (g.nameEn || '').trim() || null,
      required: !!g.required,
      minSelect: Math.max(0, Number(g.minSelect) || 0),
      maxSelect: Math.max(1, Number(g.maxSelect) || 1),
      sortOrder: gi,
      options: g.options.map((o, oi) => ({
        id: o.id, nameAr: o.nameAr.trim(), nameEn: (o.nameEn || '').trim() || null,
        priceDelta: Number(o.priceDelta) || 0, isAvailable: o.isAvailable !== false, sortOrder: oi,
      })).filter(o => o.nameAr),
    }))
    .filter(g => g.nameAr);

  const validateGroups = (payload) => {
    for (const g of payload) {
      if (g.maxSelect < g.minSelect) { toast.error(`في "${g.nameAr}": الحد الأعلى أصغر من الأدنى`); return false; }
      if (g.required && g.minSelect < 1) g.minSelect = 1;
      if (g.options.length === 0) { toast.error(`أضف خياراً واحداً على الأقل في "${g.nameAr}"`); return false; }
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    if (!form.nameAr || !form.salePrice) {
      setActiveTab('basic');
      return toast.error('الاسم بالعربية والسعر مطلوبان');
    }
    const groupsPayload = buildGroupsPayload();
    if (!validateGroups(groupsPayload)) { setActiveTab('addons'); return; }

    try {
      const payload = {
        nameAr: form.nameAr, nameEn: form.nameEn, barcode: form.barcode || null, sku: form.sku || null,
        salePrice: Number(form.salePrice), costPrice: Number(form.costPrice) || 0,
        taxRate: Number(form.taxRate) / 100, trackStock: form.trackStock,
        categoryId: form.categoryId || undefined, isActive: form.isActive,
      };
      let productId = editingId;
      if (editingId) {
        await api.put(`/products/${editingId}`, payload);
      } else {
        payload.openingStock = Number(form.openingStock) || 0;
        const res = await api.post('/products', payload);
        productId = res.data.data?.id;
      }
      // save modifier groups
      if (productId) {
        setSavingGroups(true);
        await api.put(`/modifier-groups/${productId}`, { groups: groupsPayload });
      }
      toast.success(editingId ? 'تم حفظ التعديلات' : 'تمت إضافة المنتج');
      setShowModal(false); setEditingId(null); setForm({ ...EMPTY_FORM }); setGroups([]); loadProducts();
    } catch (err) {
      toast.error(err.response?.data?.message || 'تعذّر الحفظ');
    } finally { setSavingGroups(false); }
  };

  const handleArchive = async () => {
    if (!actionModal) return;
    try {
      await api.post(`/products/${actionModal.product.id}/archive`);
      toast.success('تمت أرشفة المنتج'); setActionModal(null); loadProducts();
    } catch (err) { toast.error(err.response?.data?.message || 'تعذّرت الأرشفة'); setActionModal(null); }
  };
  const handleHardDelete = async () => {
    if (!actionModal) return;
    try {
      const res = await api.delete(`/products/${actionModal.product.id}`);
      toast.success(res.data.message || 'تم الحذف'); setActionModal(null); loadProducts();
    } catch (err) { toast.error(err.response?.data?.message || 'تعذّر الحذف'); setActionModal(null); }
  };
  const handleReactivate = async (p) => {
    try { await api.put(`/products/${p.id}`, { isActive: true }); toast.success('تم تفعيل المنتج'); loadProducts(); }
    catch (err) { toast.error(err.response?.data?.message || 'فشل'); }
  };

  const filtered = products.filter(p => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (p.nameAr || '').includes(q) || (p.nameEn || '').toLowerCase().includes(q) ||
      (p.barcode || '').includes(q) || (p.sku || '').includes(q);
  });

  // small input helper for the basic tab
  const Field = ({ label, name, type = 'text', step, min, dir, required, placeholder }) => (
    <div>
      <label className="block text-xs font-medium text-muted mb-1.5">{label}{required && <span className="text-red-500"> *</span>}</label>
      <input value={form[name] ?? ''} onChange={e => setForm(p => ({ ...p, [name]: e.target.value }))}
        type={type} step={step} min={min} dir={dir} placeholder={placeholder}
        className="w-full px-3.5 py-2.5 border border-line rounded-xl bg-white text-sm text-ink
          focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition" />
    </div>
  );

  return (
    <div className="space-y-6">
      <Toaster position="top-center" />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-bold text-ink">{t('nav.products')}</h2>
        <button onClick={openAddModal}
          className="px-4 py-2.5 bg-brand-600 text-white rounded-xl hover:bg-brand-700 shadow-sm flex items-center gap-2 text-sm font-medium transition">
          <Plus size={18} /> إضافة منتج
        </button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[250px]">
          <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-muted" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ابحث بالاسم أو الباركود…"
            className="w-full ps-10 pe-4 py-2.5 border border-line rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" />
        </div>
        <div className="flex gap-1 bg-white border border-line rounded-xl p-1">
          {[{ key: 'active', label: 'نشط' }, { key: 'archived', label: 'مؤرشف' }, { key: 'all', label: 'الكل' }].map(m => (
            <button key={m.key} onClick={() => setViewMode(m.key)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition ${viewMode === m.key ? 'bg-brand-50 text-brand-700' : 'text-muted hover:text-ink'}`}>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? <p className="text-muted">{t('common.loading')}</p> : (
        <div className="bg-white rounded-2xl border border-line shadow-card overflow-hidden">
          <table className="w-full">
            <thead className="bg-canvas">
              <tr>
                {['المنتج', 'الباركود', 'التكلفة', 'سعر البيع', 'المخزون', 'الحالة', 'إجراءات'].map((h, i) => (
                  <th key={h} className={`px-5 py-3 text-xs font-semibold text-muted ${i === 6 ? 'text-center' : 'text-right'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-10 text-center text-muted">
                  {search ? 'لا توجد نتائج' : viewMode === 'archived' ? 'لا توجد منتجات مؤرشفة' : 'لا توجد منتجات — أضف منتجك الأول'}
                </td></tr>
              ) : filtered.map(p => {
                const stock = p.inventory ? Number(p.inventory.currentStock) : null;
                return (
                  <tr key={p.id} className={`border-t border-line hover:bg-canvas/60 ${!p.isActive ? 'opacity-50' : ''}`}>
                    <td className="px-5 py-3">
                      <p className="text-sm font-medium text-ink">{p.nameAr}</p>
                      <p className="text-xs text-muted">{p.nameEn}</p>
                    </td>
                    <td className="px-5 py-3">
                      {p.barcode ? <span className="inline-flex items-center gap-1 text-sm font-mono bg-canvas px-2 py-0.5 rounded"><Barcode size={12} /> {p.barcode}</span> : <span className="text-xs text-gray-300">—</span>}
                    </td>
                    <td className="px-5 py-3 text-sm text-muted font-mono">{Number(p.costPrice || 0).toFixed(2)}</td>
                    <td className="px-5 py-3 text-sm font-medium text-brand-600 font-mono">{Number(p.salePrice).toFixed(2)}</td>
                    <td className="px-5 py-3 text-sm">
                      {stock !== null ? <span className={`font-medium ${stock <= 0 ? 'text-red-600' : stock <= 5 ? 'text-amber-600' : 'text-ink'}`}>{stock.toFixed(0)}</span> : '—'}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${p.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                        {p.isActive ? 'نشط' : 'مؤرشف'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {p.isActive ? (<>
                          <button onClick={() => openEditModal(p)} className="text-brand-600 hover:text-brand-700 p-1.5 rounded-lg hover:bg-brand-50" title="تعديل"><Pencil size={15} /></button>
                          <button onClick={() => setActionModal({ product: p })} className="text-red-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50" title="حذف / أرشفة"><Trash2 size={15} /></button>
                        </>) : (
                          <button onClick={() => handleReactivate(p)} className="text-emerald-600 hover:text-emerald-700 p-1.5 rounded-lg hover:bg-emerald-50 flex items-center gap-1 text-xs"><RotateCcw size={14} /> تفعيل</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="px-5 py-2.5 bg-canvas text-xs text-muted text-right">{filtered.length} منتج</div>
        </div>
      )}

      {/* ─── Add/Edit Product Modal (tabbed) ─── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-3xl shadow-cardHover w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()} dir="rtl">
            {/* header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-line">
              <h3 className="text-lg font-bold text-ink">{editingId ? 'تعديل منتج' : 'إضافة / تعديل منتج'}</h3>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-canvas rounded-xl text-muted"><X size={18} /></button>
            </div>

            {/* tabs */}
            <div className="px-6 border-b border-line flex gap-1 overflow-x-auto">
              {TABS.map(({ key, label, icon: Icon }) => (
                <button key={key} onClick={() => setActiveTab(key)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition
                    ${activeTab === key ? 'border-brand-600 text-brand-700' : 'border-transparent text-muted hover:text-ink'}`}>
                  <Icon size={16} /> {label}
                </button>
              ))}
            </div>

            {/* body */}
            <div className="flex-1 overflow-auto p-6">
              {/* BASIC */}
              {activeTab === 'basic' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div className="md:col-span-1">
                    <div className="aspect-square rounded-2xl border-2 border-dashed border-line bg-canvas flex flex-col items-center justify-center text-muted">
                      <ImageIcon size={36} className="mb-2 opacity-40" />
                      <button type="button" className="mt-2 inline-flex items-center gap-1.5 text-sm text-brand-600 font-medium">
                        <Camera size={15} /> تغيير الصورة
                      </button>
                    </div>
                  </div>
                  <div className="md:col-span-2 grid grid-cols-2 gap-4">
                    <div className="col-span-2"><Field label="اسم المنتج" name="nameAr" dir="rtl" required placeholder="مثال: برجر كلاسيك" /></div>
                    <div className="col-span-2"><Field label="الاسم بالإنجليزي" name="nameEn" placeholder="e.g. Classic Burger" /></div>
                    <Field label="الرمز / SKU" name="sku" dir="ltr" placeholder="BRG-001" />
                    <div>
                      <label className="block text-xs font-medium text-muted mb-1.5">التصنيف</label>
                      <select value={form.categoryId} onChange={e => setForm(p => ({ ...p, categoryId: e.target.value }))}
                        className="w-full px-3.5 py-2.5 border border-line rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500">
                        <option value="">— عام —</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.nameAr}</option>)}
                      </select>
                    </div>
                    <div className="col-span-2 flex items-center gap-3 pt-1">
                      <button type="button" onClick={() => setForm(p => ({ ...p, isActive: !p.isActive }))}
                        className={`relative w-12 h-6 rounded-full transition ${form.isActive ? 'bg-green-500' : 'bg-gray-300'}`}>
                        <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${form.isActive ? 'start-0.5' : 'start-6'}`} />
                      </button>
                      <span className="text-sm text-ink">{form.isActive ? 'نشط' : 'غير نشط'}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* ADDONS */}
              {activeTab === 'addons' && (
                <div>
                  <div className="mb-4">
                    <h4 className="font-bold text-ink">الإضافات / الخيارات</h4>
                    <p className="text-sm text-muted">أضف الإضافات والخيارات التي يمكن اختيارها مع هذا المنتج.</p>
                  </div>

                  <button type="button" onClick={addGroup}
                    className="w-full py-3 border-2 border-dashed border-brand-200 rounded-xl text-brand-600 hover:border-brand-400 hover:bg-brand-50 flex items-center justify-center gap-2 text-sm font-medium transition mb-4">
                    <Plus size={16} /> إضافة مجموعة خيارات
                  </button>

                  {groups.length === 0 && <p className="text-center text-muted text-sm py-4">لا توجد مجموعات بعد</p>}

                  <div className="space-y-4">
                    {groups.map(g => {
                      const single = Number(g.maxSelect) === 1;
                      return (
                        <div key={g._key} className="border border-line rounded-2xl p-4 bg-white shadow-card">
                          <div className="flex items-start gap-3 mb-3">
                            <GripVertical size={18} className="text-gray-300 mt-2.5 shrink-0" />
                            <div className="flex-1 grid grid-cols-2 gap-3">
                              <input value={g.nameAr} onChange={e => updateGroup(g._key, { nameAr: e.target.value })}
                                placeholder="اسم المجموعة (مثال: اختيار الشطة)"
                                className="col-span-2 sm:col-span-1 px-3 py-2 border border-line rounded-lg text-sm focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 outline-none" />
                              <input value={g.nameEn} onChange={e => updateGroup(g._key, { nameEn: e.target.value })}
                                placeholder="Group name" dir="ltr"
                                className="col-span-2 sm:col-span-1 px-3 py-2 border border-line rounded-lg text-sm focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 outline-none" />
                            </div>
                            {g.required
                              ? <span className="shrink-0 text-[11px] px-2 py-1 rounded-full bg-red-50 text-red-600 font-medium">مطلوب</span>
                              : <span className="shrink-0 text-[11px] px-2 py-1 rounded-full bg-canvas text-muted font-medium">اختياري</span>}
                            <button type="button" onClick={() => removeGroup(g._key)} className="shrink-0 p-1.5 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 size={15} /></button>
                          </div>

                          <div className="flex flex-wrap items-center gap-4 mb-3 ps-7">
                            <label className="flex items-center gap-2 text-sm">
                              <input type="checkbox" checked={g.required} onChange={e => updateGroup(g._key, { required: e.target.checked })} className="rounded text-brand-600" />
                              <span className="text-ink">إجباري</span>
                            </label>
                            <div className="flex items-center gap-2 text-sm">
                              <span className="text-muted text-xs">نوع الاختيار:</span>
                              <label className="flex items-center gap-1"><input type="radio" checked={single} onChange={() => updateGroup(g._key, { maxSelect: 1 })} /> <span>واحد فقط</span></label>
                              <label className="flex items-center gap-1"><input type="radio" checked={!single} onChange={() => updateGroup(g._key, { maxSelect: Math.max(2, Number(g.maxSelect) || 5) })} /> <span>متعدد</span></label>
                            </div>
                            <div className="flex items-center gap-1"><span className="text-xs text-muted">الأدنى</span>
                              <input type="number" min="0" value={g.minSelect} onChange={e => updateGroup(g._key, { minSelect: e.target.value })} className="w-14 px-2 py-1 border border-line rounded-lg text-center text-sm" /></div>
                            <div className="flex items-center gap-1"><span className="text-xs text-muted">الأعلى</span>
                              <input type="number" min="1" value={g.maxSelect} onChange={e => updateGroup(g._key, { maxSelect: e.target.value })} className="w-14 px-2 py-1 border border-line rounded-lg text-center text-sm" /></div>
                          </div>

                          <div className="ps-7 space-y-2">
                            <p className="text-xs font-medium text-muted">الخيارات</p>
                            {g.options.map(o => (
                              <div key={o._key} className="flex items-center gap-2 bg-canvas border border-line rounded-lg p-2">
                                <GripVertical size={14} className="text-gray-300 shrink-0" />
                                <input value={o.nameAr} onChange={e => updateOption(g._key, o._key, { nameAr: e.target.value })}
                                  placeholder="اسم الخيار" className="flex-1 min-w-0 px-2 py-1.5 border border-line rounded-md text-sm bg-white outline-none focus:border-brand-500" />
                                <div className="flex items-center gap-1 shrink-0">
                                  <input type="number" step="0.01" min="0" value={o.priceDelta} onChange={e => updateOption(g._key, o._key, { priceDelta: e.target.value })}
                                    className="w-20 px-2 py-1.5 border border-line rounded-md text-sm text-center bg-white" title="السعر الإضافي" />
                                  <span className="text-[11px] text-muted">ر.س</span>
                                </div>
                                <label className="flex items-center gap-1 text-[11px] text-muted shrink-0" title="متاح">
                                  <input type="checkbox" checked={o.isAvailable} onChange={e => updateOption(g._key, o._key, { isAvailable: e.target.checked })} className="rounded text-brand-600" /> متاح
                                </label>
                                <button type="button" onClick={() => removeOption(g._key, o._key)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-md shrink-0"><X size={14} /></button>
                              </div>
                            ))}
                            <button type="button" onClick={() => addOption(g._key)} className="text-sm text-brand-600 hover:text-brand-700 flex items-center gap-1 mt-1">
                              <Plus size={14} /> إضافة خيار
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* PRICES */}
              {activeTab === 'prices' && (
                <div className="grid grid-cols-2 gap-4 max-w-lg">
                  <Field label="سعر البيع (ر.س)" name="salePrice" type="number" step="0.01" min="0" required placeholder="0.00" />
                  <Field label="سعر الشراء (ر.س)" name="costPrice" type="number" step="0.01" min="0" placeholder="0.00" />
                  <Field label="الضريبة %" name="taxRate" type="number" step="0.1" min="0" placeholder="15" />
                </div>
              )}

              {/* INVENTORY */}
              {activeTab === 'inventory' && (
                <div className="max-w-lg space-y-4">
                  <label className="flex items-center gap-3 text-sm">
                    <input type="checkbox" checked={form.trackStock} onChange={e => setForm(p => ({ ...p, trackStock: e.target.checked }))} className="rounded text-brand-600" />
                    <span className="text-ink">تتبع المخزون لهذا المنتج</span>
                  </label>
                  {!editingId && form.trackStock && (
                    <div className="bg-brand-50 border border-brand-100 rounded-2xl p-4">
                      <label className="block text-sm font-medium text-brand-800 mb-2">المخزون الافتتاحي</label>
                      <input value={form.openingStock} onChange={e => setForm(p => ({ ...p, openingStock: e.target.value }))}
                        type="number" min="0" className="w-full px-3.5 py-2.5 border border-brand-200 rounded-xl bg-white" placeholder="0" />
                      <p className="text-xs text-brand-600 mt-1">الكمية المتوفرة حالياً عند الإضافة.</p>
                    </div>
                  )}
                  {editingId && <p className="text-sm text-muted">تُدار كميات المخزون من شاشة المخزون.</p>}
                </div>
              )}

              {/* IMAGES */}
              {activeTab === 'images' && (
                <div className="max-w-md">
                  <div className="aspect-video rounded-2xl border-2 border-dashed border-line bg-canvas flex flex-col items-center justify-center text-muted">
                    <ImageIcon size={40} className="mb-2 opacity-40" />
                    <p className="text-sm">اسحب الصور هنا أو</p>
                    <button type="button" className="mt-1 inline-flex items-center gap-1.5 text-sm text-brand-600 font-medium"><Camera size={15} /> اختر صورة</button>
                  </div>
                  <p className="text-xs text-muted mt-2">رفع الصور سيُفعّل لاحقاً — لا يؤثر على حفظ المنتج.</p>
                </div>
              )}
            </div>

            {/* footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-line bg-canvas">
              <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 border border-line rounded-xl text-sm font-medium hover:bg-white">إلغاء</button>
              <button type="button" onClick={handleSubmit} disabled={savingGroups}
                className="px-6 py-2.5 bg-brand-600 text-white rounded-xl text-sm font-bold hover:bg-brand-700 disabled:opacity-50 shadow-sm">
                {savingGroups ? 'جاري الحفظ…' : 'حفظ المنتج'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Action (archive/delete) Modal ─── */}
      {actionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setActionModal(null)}>
          <div className="bg-white rounded-2xl shadow-cardHover w-full max-w-md p-6" onClick={e => e.stopPropagation()} dir="rtl">
            <div className="text-center mb-5">
              <h3 className="text-lg font-bold text-ink mb-1">إدارة المنتج</h3>
              <p className="text-muted font-medium">{actionModal.product.nameAr}</p>
            </div>
            <div className="space-y-3">
              <button onClick={handleArchive} className="w-full flex items-center gap-3 p-4 border-2 border-amber-200 rounded-xl hover:bg-amber-50 transition text-right">
                <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center shrink-0"><Archive size={20} className="text-amber-600" /></div>
                <div><p className="font-bold text-amber-800">أرشفة المنتج</p><p className="text-xs text-muted">إخفاء من نقطة البيع مع الحفاظ على السجلات</p></div>
              </button>
              <button onClick={handleHardDelete} className="w-full flex items-center gap-3 p-4 border-2 border-red-200 rounded-xl hover:bg-red-50 transition text-right">
                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center shrink-0"><Trash2 size={20} className="text-red-600" /></div>
                <div><p className="font-bold text-red-800">حذف نهائي</p><p className="text-xs text-muted">حذف المنتج بالكامل نهائياً</p></div>
              </button>
              <button onClick={() => setActionModal(null)} className="w-full py-3 bg-canvas rounded-xl hover:bg-gray-100 font-medium text-muted">إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
