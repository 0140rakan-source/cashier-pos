import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../api/client';
import toast, { Toaster } from 'react-hot-toast';
import { Plus, Pencil, Trash2, X, Archive, RotateCcw, Search, Barcode, Settings2 } from 'lucide-react';

const EMPTY_FORM = {
  nameAr: '', nameEn: '', barcode: '', sku: '', categoryId: '',
  salePrice: '', costPrice: '', taxRate: 15, trackStock: true, openingStock: '',
};

const EMPTY_MODIFIER = { nameAr: '', nameEn: '', price: '0', isDefault: false };

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

  // Modifiers state
  const [showModifiers, setShowModifiers] = useState(false);
  const [modifierProduct, setModifierProduct] = useState(null);
  const [modifiers, setModifiers] = useState([]);
  const [modifierForm, setModifierForm] = useState({ ...EMPTY_MODIFIER });
  const [editingModifierId, setEditingModifierId] = useState(null);

  const loadProducts = useCallback(() => {
    setLoading(true);
    api.get('/products', { params: { active: viewMode === 'active' ? 'true' : viewMode === 'archived' ? 'false' : 'all' } })
      .then(r => setProducts(r.data.data || []))
      .catch(() => toast.error('فشل تحميل المنتجات'))
      .finally(() => setLoading(false));
  }, [viewMode]);

  useEffect(() => { loadProducts(); }, [loadProducts]);
  useEffect(() => { api.get('/categories').then(r => setCategories(r.data.data || [])).catch(e => console.error(e)); }, []);

  const openAddModal = () => { setEditingId(null); setForm({ ...EMPTY_FORM }); setShowModal(true); };

  const openEditModal = (p) => {
    setEditingId(p.id);
    setForm({
      nameAr: p.nameAr || '', nameEn: p.nameEn || '', barcode: p.barcode || '', sku: p.sku || '',
      categoryId: p.categoryId || '',
      salePrice: p.salePrice != null ? String(Number(p.salePrice)) : '',
      costPrice: p.costPrice != null ? String(Number(p.costPrice)) : '',
      taxRate: p.taxRate != null ? String(Number(p.taxRate) * 100) : '15',
      trackStock: p.trackStock ?? true, openingStock: '',
    });
    setShowModal(true);
  };

  const openModifiers = async (p) => {
    setModifierProduct(p);
    setModifierForm({ ...EMPTY_MODIFIER });
    setEditingModifierId(null);
    try {
      const res = await api.get(`/modifiers/${p.id}`);
      setModifiers(res.data.data || []);
    } catch { setModifiers([]); }
    setShowModifiers(true);
  };

  const loadModifiers = async (productId) => {
    const res = await api.get(`/modifiers/${productId}`);
    setModifiers(res.data.data || []);
  };

  const handleModifierSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingModifierId) {
        await api.put(`/modifiers/item/${editingModifierId}`, modifierForm);
        toast.success('تم تعديل الإضافة');
      } else {
        await api.post(`/modifiers/${modifierProduct.id}`, modifierForm);
        toast.success('تم إضافة الإضافة');
      }
      setModifierForm({ ...EMPTY_MODIFIER });
      setEditingModifierId(null);
      await loadModifiers(modifierProduct.id);
    } catch { toast.error('فشلت العملية'); }
  };

  const handleDeleteModifier = async (id) => {
    try {
      await api.delete(`/modifiers/item/${id}`);
      toast.success('تم حذف الإضافة');
      await loadModifiers(modifierProduct.id);
    } catch { toast.error('فشل الحذف'); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        nameAr: form.nameAr, nameEn: form.nameEn, barcode: form.barcode || null, sku: form.sku || null,
        salePrice: Number(form.salePrice), costPrice: Number(form.costPrice) || 0,
        taxRate: Number(form.taxRate) / 100, trackStock: form.trackStock,
        categoryId: form.categoryId || undefined,
      };
      if (editingId) {
        await api.put(`/products/${editingId}`, payload);
        toast.success('✅ تم تعديل المنتج');
      } else {
        payload.openingStock = Number(form.openingStock) || 0;
        await api.post('/products', payload);
        toast.success('✅ تم إضافة المنتج');
      }
      setShowModal(false); setEditingId(null); setForm({ ...EMPTY_FORM }); loadProducts();
    } catch (err) { toast.error(err.response?.data?.message || 'فشلت العملية'); }
  };

  const handleArchive = async () => {
    if (!actionModal) return;
    try {
      await api.post(`/products/${actionModal.product.id}/archive`);
      toast.success('📦 تم أرشفة المنتج');
      setActionModal(null); loadProducts();
    } catch (err) { toast.error(err.response?.data?.message || 'فشلت الأرشفة'); setActionModal(null); }
  };

  const handleHardDelete = async () => {
    if (!actionModal) return;
    try {
      const res = await api.delete(`/products/${actionModal.product.id}`);
      toast.success('🗑️ ' + (res.data.message || 'تم الحذف'));
      setActionModal(null); loadProducts();
    } catch (err) { toast.error(err.response?.data?.message || 'فشل الحذف'); setActionModal(null); }
  };

  const handleReactivate = async (p) => {
    try {
      await api.put(`/products/${p.id}`, { isActive: true });
      toast.success('✅ تم إعادة تفعيل المنتج');
      loadProducts();
    } catch (err) { toast.error(err.response?.data?.message || 'فشل'); }
  };

  const filtered = products.filter(p => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (p.nameAr || '').includes(q) || (p.nameEn || '').toLowerCase().includes(q) ||
      (p.barcode || '').includes(q) || (p.sku || '').includes(q);
  });

  const field = (label, name, opts = {}) => (
    <div key={name}>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <input value={form[name] ?? ''} onChange={e => setForm(prev => ({ ...prev, [name]: e.target.value }))}
        type={opts.type || 'text'} step={opts.step} min={opts.min} dir={opts.dir}
        required={opts.required} placeholder={opts.placeholder}
        className="w-full px-3 py-2.5 border rounded-lg bg-gray-50" />
    </div>
  );

  return (
    <div className="space-y-6">
      <Toaster position="top-center" />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-bold">{t('nav.products')}</h2>
        <button onClick={openAddModal} className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 flex items-center gap-2">
          <Plus size={18} /> إضافة منتج
        </button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[250px]">
          <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ابحث بالاسم أو الباركود..."
            className="w-full ps-10 pe-4 py-2 border rounded-lg bg-gray-50 text-sm" />
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {[{ key: 'active', label: 'نشط' }, { key: 'archived', label: 'مؤرشف' }, { key: 'all', label: 'الكل' }].map(m => (
            <button key={m.key} onClick={() => setViewMode(m.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${viewMode === m.key ? 'bg-white shadow text-brand-600' : 'text-gray-500 hover:text-gray-700'}`}>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? <p className="text-gray-400">{t('common.loading')}</p> : (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-5 py-3 text-right text-xs font-medium text-gray-500">المنتج</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-gray-500">الباركود</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-gray-500">التكلفة</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-gray-500">سعر البيع</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-gray-500">المخزون</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-gray-500">الحالة</th>
                <th className="px-5 py-3 text-center text-xs font-medium text-gray-500">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-gray-400">
                  {search ? 'لا توجد نتائج' : viewMode === 'archived' ? 'لا توجد منتجات مؤرشفة' : 'لا توجد منتجات — أضف منتجك الأول!'}
                </td></tr>
              ) : filtered.map(p => {
                const stock = p.inventory ? Number(p.inventory.currentStock) : null;
                return (
                  <tr key={p.id} className={`border-b hover:bg-gray-50/50 ${!p.isActive ? 'opacity-50 bg-gray-50' : ''}`}>
                    <td className="px-5 py-3">
                      <p className="text-sm font-medium">{p.nameAr}</p>
                      <p className="text-xs text-gray-400">{p.nameEn}</p>
                    </td>
                    <td className="px-5 py-3">
                      {p.barcode ? <span className="inline-flex items-center gap-1 text-sm font-mono bg-gray-100 px-2 py-0.5 rounded"><Barcode size={12} /> {p.barcode}</span> : <span className="text-xs text-gray-300">—</span>}
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-500 font-mono">{Number(p.costPrice || 0).toFixed(2)}</td>
                    <td className="px-5 py-3 text-sm font-medium text-brand-600 font-mono">{Number(p.salePrice).toFixed(2)}</td>
                    <td className="px-5 py-3 text-sm">
                      {stock !== null ? <span className={`font-medium ${stock <= 0 ? 'text-red-600' : stock <= 5 ? 'text-amber-600' : ''}`}>{stock.toFixed(0)}</span> : '—'}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                        {p.isActive ? 'نشط' : 'مؤرشف'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {p.isActive ? (<>
                          <button onClick={() => openEditModal(p)} className="text-blue-500 hover:text-blue-700 p-1.5 rounded hover:bg-blue-50" title="تعديل"><Pencil size={15} /></button>
                          <button onClick={() => openModifiers(p)} className="text-purple-500 hover:text-purple-700 p-1.5 rounded hover:bg-purple-50" title="الإضافات"><Settings2 size={15} /></button>
                          <button onClick={() => setActionModal({ product: p, action: 'choose' })} className="text-red-400 hover:text-red-600 p-1.5 rounded hover:bg-red-50" title="حذف / أرشفة"><Trash2 size={15} /></button>
                        </>) : (
                          <button onClick={() => handleReactivate(p)} className="text-emerald-500 hover:text-emerald-700 p-1.5 rounded hover:bg-emerald-50 flex items-center gap-1 text-xs"><RotateCcw size={14} /> تفعيل</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="px-5 py-2 bg-gray-50 text-xs text-gray-400 text-right">{filtered.length} منتج</div>
        </div>
      )}

      {/* Modifiers Modal */}
      {showModifiers && modifierProduct && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowModifiers(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold">إضافات المنتج</h3>
                <p className="text-sm text-gray-500">{modifierProduct.nameAr}</p>
              </div>
              <button onClick={() => setShowModifiers(false)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
            </div>

            {/* Add/Edit Modifier Form */}
            <form onSubmit={handleModifierSubmit} className="bg-gray-50 rounded-xl p-4 mb-4 space-y-3">
              <p className="text-sm font-medium text-gray-700">{editingModifierId ? 'تعديل الإضافة' : 'إضافة جديدة'}</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">الاسم بالعربي *</label>
                  <input value={modifierForm.nameAr} onChange={e => setModifierForm(p => ({ ...p, nameAr: e.target.value }))}
                    required className="w-full px-3 py-2 border rounded-lg bg-white text-sm" placeholder="مثال: شطة" dir="rtl" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">الاسم بالإنجليزي</label>
                  <input value={modifierForm.nameEn} onChange={e => setModifierForm(p => ({ ...p, nameEn: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg bg-white text-sm" placeholder="Spicy" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">السعر الإضافي (ر.س)</label>
                  <input value={modifierForm.price} onChange={e => setModifierForm(p => ({ ...p, price: e.target.value }))}
                    type="number" step="0.01" min="0" className="w-full px-3 py-2 border rounded-lg bg-white text-sm" placeholder="0.00" />
                </div>
                <div className="flex items-center gap-2 pt-5">
                  <input type="checkbox" id="isDefault" checked={modifierForm.isDefault}
                    onChange={e => setModifierForm(p => ({ ...p, isDefault: e.target.checked }))} className="rounded" />
                  <label htmlFor="isDefault" className="text-sm text-gray-600">محدد افتراضياً</label>
                </div>
              </div>
              <div className="flex gap-2">
                <button type="submit" className="flex-1 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 text-sm font-medium">
                  {editingModifierId ? 'حفظ التعديل' : '+ إضافة'}
                </button>
                {editingModifierId && (
                  <button type="button" onClick={() => { setEditingModifierId(null); setModifierForm({ ...EMPTY_MODIFIER }); }}
                    className="px-4 py-2 bg-gray-100 rounded-lg text-sm">إلغاء</button>
                )}
              </div>
            </form>

            {/* Modifiers List */}
            {modifiers.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-4">لا توجد إضافات بعد</p>
            ) : (
              <div className="space-y-2">
                {modifiers.map(m => (
                  <div key={m.id} className="flex items-center justify-between p-3 border rounded-xl bg-white">
                    <div>
                      <p className="text-sm font-medium">{m.nameAr} {m.nameEn ? `/ ${m.nameEn}` : ''}</p>
                      <p className="text-xs text-gray-500">
                        {Number(m.price) > 0 ? `+${Number(m.price).toFixed(2)} ر.س` : 'مجاني'}
                        {m.isDefault ? ' · افتراضي' : ''}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => { setEditingModifierId(m.id); setModifierForm({ nameAr: m.nameAr, nameEn: m.nameEn || '', price: String(m.price), isDefault: m.isDefault }); }}
                        className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg"><Pencil size={14} /></button>
                      <button onClick={() => handleDeleteModifier(m.id)}
                        className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold">{editingId ? '✏️ تعديل المنتج' : '➕ إضافة منتج جديد'}</h3>
              <button onClick={() => setShowModal(false)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {field('الاسم بالعربي *', 'nameAr', { required: true, dir: 'rtl', placeholder: 'مثال: قهوة عربية' })}
                {field('الاسم بالإنجليزي *', 'nameEn', { required: true, placeholder: 'e.g. Arabic Coffee' })}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {field('الباركود / Barcode', 'barcode', { placeholder: 'امسح أو أدخل الباركود', dir: 'ltr' })}
                {field('رقم SKU (اختياري)', 'sku', { placeholder: 'PRD-001', dir: 'ltr' })}
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">الفئة / Category</label>
                <select value={form.categoryId} onChange={e => setForm(prev => ({ ...prev, categoryId: e.target.value }))} className="w-full px-3 py-2.5 border rounded-lg bg-gray-50">
                  <option value="">— عام / General —</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.nameAr} / {c.nameEn}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {field('سعر البيع (ر.س) *', 'salePrice', { type: 'number', step: '0.01', min: '0', required: true, placeholder: '0.00' })}
                {field('سعر الشراء (ر.س)', 'costPrice', { type: 'number', step: '0.01', min: '0', placeholder: '0.00' })}
              </div>
              {!editingId && (
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                  <label className="block text-sm font-medium text-blue-800 mb-2">📦 المخزون الافتتاحي</label>
                  <input value={form.openingStock} onChange={e => setForm(prev => ({ ...prev, openingStock: e.target.value }))}
                    type="number" min="0" className="w-full px-3 py-2.5 border border-blue-200 rounded-lg bg-white" placeholder="0" />
                  <p className="text-xs text-blue-600 mt-1">أدخل الكمية المتوفرة حالياً</p>
                </div>
              )}
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={form.trackStock} onChange={e => setForm(prev => ({ ...prev, trackStock: e.target.checked }))} className="rounded" />
                تتبع المخزون
              </label>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="flex-1 py-3 bg-brand-500 text-white rounded-xl hover:bg-brand-600 font-bold">
                  {editingId ? 'حفظ التعديلات' : '✅ إضافة المنتج'}
                </button>
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3 bg-gray-100 rounded-xl hover:bg-gray-200 font-medium">إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Action Modal */}
      {actionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setActionModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="text-center mb-5">
              <h3 className="text-lg font-bold mb-1">إدارة المنتج</h3>
              <p className="text-gray-600 font-medium">{actionModal.product.nameAr}</p>
            </div>
            <div className="space-y-3">
              <button onClick={handleArchive}
                className="w-full flex items-center gap-3 p-4 border-2 border-amber-200 rounded-xl hover:bg-amber-50 transition text-right">
                <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center shrink-0"><Archive size={20} className="text-amber-600" /></div>
                <div>
                  <p className="font-bold text-amber-800">📦 أرشفة المنتج</p>
                  <p className="text-xs text-gray-500">إخفاء من نقطة البيع مع الحفاظ على السجلات</p>
                </div>
              </button>
              <button onClick={handleHardDelete}
                className="w-full flex items-center gap-3 p-4 border-2 border-red-200 rounded-xl hover:bg-red-50 transition text-right">
                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center shrink-0"><Trash2 size={20} className="text-red-600" /></div>
                <div>
                  <p className="font-bold text-red-800">🗑️ حذف نهائي</p>
                  <p className="text-xs text-gray-500">حذف المنتج بالكامل نهائياً</p>
                </div>
              </button>
              <button onClick={() => setActionModal(null)}
                className="w-full py-3 bg-gray-100 rounded-xl hover:bg-gray-200 font-medium text-gray-600">إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
