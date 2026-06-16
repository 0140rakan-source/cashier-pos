import React, { useState, useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';

function BarcodeImage({ value, height = 40, fontSize = 10 }) {
  const [dataUrl, setDataUrl] = useState('');
  const [errored, setErrored] = useState(false);
  useEffect(() => {
    if (!value) return;
    try {
      const canvas = document.createElement('canvas');
      JsBarcode(canvas, String(value), { format: 'CODE128', height, fontSize, margin: 2, displayValue: true, fontOptions: 'bold', textMargin: 2, background: '#ffffff', lineColor: '#000000' });
      setDataUrl(canvas.toDataURL('image/png'));
      setErrored(false);
    } catch (e) { setErrored(true); }
  }, [value, height, fontSize]);
  if (!value) return null;
  if (errored || !dataUrl) return <span className="block text-[10px] font-mono text-gray-700" dir="ltr">{value}</span>;
  return <img src={dataUrl} alt={`barcode ${value}`} className="block mx-auto" style={{ maxHeight: height + 20, imageRendering: 'pixelated' }} />;
}

function QRImage({ value, size = 100 }) {
  const [dataUrl, setDataUrl] = useState('');
  useEffect(() => {
    if (!value) return;
    QRCode.toDataURL(String(value), { width: size, margin: 1, color: { dark: '#000000', light: '#ffffff' } }).then(url => setDataUrl(url)).catch(() => {});
  }, [value, size]);
  if (!dataUrl) return null;
  return <img src={dataUrl} alt="QR" className="block mx-auto" style={{ width: size, height: size }} />;
}

import api from '../api/client';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store';
import toast, { Toaster } from 'react-hot-toast';
import { Search, Plus, Minus, Trash2, X, Banknote, CreditCard, Receipt, ArrowLeft, CheckCircle, ShoppingBag, ChefHat } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function POS() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAdmin = user?.roleName === 'ADMIN' || user?.roleName === 'MANAGER';

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [cart, setCart] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);
  const [search, setSearch] = useState('');
  const [showCheckout, setShowCheckout] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [storeSettings, setStoreSettings] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [discountAmt, setDiscountAmt] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [cashReceived, setCashReceived] = useState(0);
  const [orderChannel, setOrderChannel] = useState('DIRECT');
  const [orderChannels, setOrderChannels] = useState([]);
  const [activeShift, setActiveShift] = useState(null);
  const [shiftChecked, setShiftChecked] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const barcodeRef = useRef(null);

  // Modifiers state
  const [modifierModal, setModifierModal] = useState(null); // { product }
  const [modGroups, setModGroups] = useState([]);            // groups with options
  const [selectedOptions, setSelectedOptions] = useState({}); // { [groupId]: [optionId] }

  useEffect(() => {
    loadProducts();
    loadCategories();
    api.get('/settings').then(r => setStoreSettings(r.data.data)).catch(e => console.error(e));
    api.get('/customers').then(r => setCustomers(r.data.data || [])).catch(e => console.error(e));
    api.get('/settings/channels').then(r => {
      const ch = r.data.data || [];
      setOrderChannels(ch);
      if (ch.length > 0 && !ch.find(c => c.key === orderChannel)) setOrderChannel(ch[0].key);
    }).catch(e => console.error(e));
    api.get('/shifts').then(r => {
      const shifts = r.data.data || [];
      const mine = shifts.find(s => s.status === 'OPEN' && s.userId === user?.id);
      setActiveShift(mine || null);
      setShiftChecked(true);
    }).catch(() => setShiftChecked(true));
  }, []);

  const loadProducts = async () => {
    try { const res = await api.get('/products'); setProducts(res.data.data || []); }
    catch (e) { console.error(e); }
  };

  const loadCategories = async () => {
    try { const res = await api.get('/categories'); setCategories(res.data.data || []); }
    catch (e) { console.error(e); }
  };

  useEffect(() => {
    if (barcodeRef.current && !showCheckout && !receipt && !modifierModal) barcodeRef.current.focus();
  }, [showCheckout, receipt, modifierModal]);

  const visible = products.filter(p => {
    if (p.isActive === false) return false;
    const matchCat = activeCategory ? p.categoryId === activeCategory : true;
    const matchSearch = search
      ? (p.nameAr || '').includes(search) || (p.nameEn || '').toLowerCase().includes(search.toLowerCase()) ||
        (p.barcode || '').includes(search) || (p.sku || '').includes(search)
      : true;
    return matchCat && matchSearch;
  });

  // فتح نافذة الإضافات عند الضغط على منتج
  const handleProductClick = async (product) => {
    try {
      const res = await api.get(`/modifier-groups/${product.id}`);
      const grps = (res.data.data || []).filter(g => (g.options || []).some(o => o.isAvailable !== false));
      if (grps.length === 0) {
        addToCartDirect(product, []);
      } else {
        setModGroups(grps);
        setSelectedOptions({});
        setModifierModal({ product });
      }
    } catch {
      addToCartDirect(product, []);
    }
  };

  // modifiers = flat array of chosen options: { optionId, groupName, nameAr, price }
  const addToCartDirect = (product, modifiers = []) => {
    const cartKey = `${product.id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const modifierPrice = modifiers.reduce((sum, m) => sum + Number(m.price || 0), 0);
    setCart(prev => [...prev, {
      cartKey,
      productId: product.id,
      nameAr: product.nameAr,
      nameEn: product.nameEn,
      barcode: product.barcode || null,
      price: Number(product.salePrice) + modifierPrice,
      basePrice: Number(product.salePrice),
      taxRate: Number(product.taxRate) || 0.15,
      quantity: 1,
      modifiers,
    }]);
  };

  // radio for maxSelect=1, checkbox otherwise (respecting maxSelect)
  const toggleOption = (group, optionId) => {
    setSelectedOptions(prev => {
      const cur = prev[group.id] || [];
      const single = Number(group.maxSelect) === 1;
      if (single) {
        return { ...prev, [group.id]: (cur.includes(optionId) && !group.required) ? [] : [optionId] };
      }
      if (cur.includes(optionId)) return { ...prev, [group.id]: cur.filter(x => x !== optionId) };
      if (cur.length >= Number(group.maxSelect)) {
        toast.error(`الحد الأقصى ${group.maxSelect} في "${group.nameAr}"`);
        return prev;
      }
      return { ...prev, [group.id]: [...cur, optionId] };
    });
  };

  const modifiersValid = () => {
    for (const g of modGroups) {
      const sel = selectedOptions[g.id] || [];
      if (g.required && sel.length < Math.max(1, Number(g.minSelect))) return false;
      if (sel.length < Number(g.minSelect)) return false;
      if (sel.length > Number(g.maxSelect)) return false;
    }
    return true;
  };

  const modifiersExtraPrice = () => {
    let sum = 0;
    for (const g of modGroups) {
      for (const oid of (selectedOptions[g.id] || [])) {
        const o = (g.options || []).find(x => x.id === oid);
        if (o) sum += Number(o.priceDelta || 0);
      }
    }
    return sum;
  };

  const confirmModifiers = () => {
    if (!modifierModal) return;
    if (!modifiersValid()) { toast.error('أكمل الخيارات الإجبارية'); return; }
    const chosen = [];
    for (const g of modGroups) {
      for (const oid of (selectedOptions[g.id] || [])) {
        const o = (g.options || []).find(x => x.id === oid);
        if (o) chosen.push({ optionId: o.id, groupName: g.nameAr, nameAr: o.nameAr, price: Number(o.priceDelta || 0) });
      }
    }
    addToCartDirect(modifierModal.product, chosen);
    setModifierModal(null);
    setSelectedOptions({});
    setModGroups([]);
  };

  const handleBarcodeScan = (e) => {
    if (e.key === 'Enter') {
      const code = e.target.value.trim();
      if (!code) return;
      const found = products.find(p => p.barcode === code || p.sku === code);
      if (found) { handleProductClick(found); toast.success(`📦 ${found.nameAr}`); }
      else toast.error(`⚠️ الباركود غير موجود: ${code}`);
      e.target.value = '';
      setSearch('');
    }
  };

  const updateQty = (cartKey, delta) => {
    setCart(prev => prev.map(i => i.cartKey === cartKey ? { ...i, quantity: Math.max(1, i.quantity + delta) } : i));
  };

  const removeItem = (cartKey) => {
    setCart(prev => prev.filter(i => i.cartKey !== cartKey));
  };

  const clearCart = () => {
    setCart([]);
    setReceipt(null);
    setDiscountAmt(0);
    setSelectedCustomer(null);
    setOrderChannel(orderChannels[0]?.key || 'DIRECT');
  };

  const subtotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const taxTotal = subtotal * 0.15;
  const grandTotal = Math.max(0, subtotal + taxTotal - (Number(discountAmt) || 0));
  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0);
  const changeDue = paymentMethod === 'CASH' ? Math.max(0, cashReceived - grandTotal) : 0;
  const canComplete = paymentMethod !== 'CASH' || cashReceived >= grandTotal;

  // طباعة فاتورة المطبخ — باستخدام iframe مخفي (window.open محظور في Electron)
  const printKitchenReceipt = (items, saleId, timestamp) => {
    try {
      const html = `<html dir="rtl"><head><title>مطبخ</title><style>
        body { font-family: 'Courier New', monospace; padding: 10px; font-size: 14px; }
        h2 { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 5px; }
        .item { border-bottom: 1px dashed #ccc; padding: 8px 0; }
        .name { font-weight: bold; font-size: 16px; }
        .qty { font-size: 20px; font-weight: bold; color: #000; }
        .mod { font-size: 12px; color: #333; padding-right: 10px; }
        .footer { text-align: center; margin-top: 10px; font-size: 12px; }
      </style></head><body>
        <h2>🍽️ طلب مطبخ</h2>
        <p style="text-align:center; font-size:12px;">${new Date(timestamp).toLocaleString('ar-SA')}</p>
        <p style="text-align:center; font-size:11px; color:#666;">رقم: #${saleId.slice(-6).toUpperCase()}</p>
        ${items.map(item => `
          <div class="item">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span class="name">${item.nameAr}</span>
              <span class="qty">× ${item.quantity}</span>
            </div>
            ${item.modifiers && item.modifiers.length > 0 ? item.modifiers.map(m =>
              `<div class="mod">✓ ${m.nameAr}</div>`
            ).join('') : ''}
            ${item.notes ? `<div class="mod">📝 ${item.notes}</div>` : ''}
          </div>
        `).join('')}
        <div class="footer">--- نهاية الطلب ---</div>
      </body></html>`;

      let iframe = document.getElementById('kitchen-print-frame');
      if (!iframe) {
        iframe = document.createElement('iframe');
        iframe.id = 'kitchen-print-frame';
        iframe.style.position = 'fixed';
        iframe.style.right = '-9999px';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);
      }
      const doc = iframe.contentWindow.document;
      doc.open();
      doc.write(html);
      doc.close();
      setTimeout(() => {
        try { iframe.contentWindow.focus(); iframe.contentWindow.print(); } catch (e) { console.error('print error', e); }
      }, 300);
    } catch (e) {
      console.error('Kitchen receipt build error:', e);
    }
  };

  const completeSale = async () => {
    if (cart.length === 0) return toast.error('السلة فارغة');
    if (!activeShift) { toast.error('⚠️ لا توجد وردية مفتوحة.'); return; }
    if (!canComplete) return toast.error('المبلغ المدفوع غير كافٍ');

    setProcessing(true);
    try {
      const saleData = {
        items: cart.map(i => ({
          productId: i.productId,
          quantity: i.quantity,
          unitPrice: Number(i.basePrice || i.price),
          taxRate: 0.15,
          discount: 0,
          modifiers: (i.modifiers || []).map(m => ({ optionId: m.optionId })),
        })),
        payments: [{ method: paymentMethod, amount: paymentMethod === 'CASH' ? cashReceived : grandTotal }],
        discount: Number(discountAmt) || 0,
        customerId: selectedCustomer || null,
        orderType: orderChannel === 'DIRECT' ? 'DINE_IN' : 'DELIVERY',
        orderChannel: orderChannel || 'DIRECT',
        notes: orderChannel !== 'DIRECT' ? `قناة: ${orderChannels.find(c => c.key === orderChannel)?.label || orderChannel}` : undefined,
      };

      const res = await api.post('/sales', saleData);
      const sale = res.data.data;

      // طباعة فاتورة المطبخ تلقائياً (لا يوقف البيع لو فشلت الطباعة)
      try {
        printKitchenReceipt(cart, sale.id, sale.createdAt);
      } catch (printErr) {
        console.error('Kitchen receipt print failed:', printErr);
      }

      setReceipt({
        sale, change: changeDue, method: paymentMethod,
        cashReceived: paymentMethod === 'CASH' ? cashReceived : grandTotal,
        items: [...cart], subtotal, taxTotal,
        discount: Number(discountAmt) || 0, grandTotal,
        timestamp: sale.createdAt,
      });

      setShowCheckout(false);
      setCart([]);
      setCashReceived(0);
      setDiscountAmt(0);
      setSelectedCustomer(null);
      loadProducts();
      toast.success('✅ تم البيع بنجاح');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Sale failed');
    } finally { setProcessing(false); }
  };

  // ─── Receipt View ───────────────────────────────────────
  if (receipt) {
    const logoSrc = storeSettings?.logo
      ? (storeSettings.logo.startsWith('http') ? storeSettings.logo : `${API_BASE}${storeSettings.logo}`)
      : null;
    const qrValue = [
      `رقم الفاتورة: ${receipt.sale.id.slice(-8).toUpperCase()}`,
      `التاريخ: ${new Date(receipt.timestamp).toLocaleDateString('ar-SA')}`,
      `الإجمالي: ${receipt.grandTotal.toFixed(2)} ر.س`,
      storeSettings?.vatNumber ? `الرقم الضريبي: ${storeSettings.vatNumber}` : '',
    ].filter(Boolean).join('\n');

    return (
      <div className="min-h-screen bg-gray-100 p-4">
        <Toaster position="top-center" />
        <div className="max-w-xs mx-auto">
          <div className="no-print mb-4 bg-emerald-500 text-white rounded-2xl p-4 flex items-center gap-3">
            <CheckCircle size={28} className="shrink-0" />
            <div>
              <p className="text-lg font-bold">تم البيع بنجاح ✔️</p>
              <p className="text-sm opacity-90">الإجمالي: {receipt.grandTotal.toFixed(2)} ر.س &bull; {receipt.method === 'CASH' ? 'نقدي' : 'بطاقة'}</p>
            </div>
          </div>
          <div id="receipt-print-area" className="bg-white rounded-2xl shadow-xl p-6 mb-4 font-mono text-sm" dir="rtl">
            <div className="text-center mb-4">
              {logoSrc && <img src={logoSrc} alt="Logo" style={{ maxHeight: '70px', maxWidth: '200px', objectFit: 'contain' }} className="mx-auto mb-2" />}
              <h2 className="text-lg font-bold">{storeSettings?.nameAr || 'المتجر'}</h2>
              {storeSettings?.addressAr && <p className="text-xs text-gray-500">{storeSettings.addressAr}</p>}
              {storeSettings?.vatNumber && <p className="text-xs text-gray-500">الرقم الضريبي: {storeSettings.vatNumber}</p>}
            </div>
            <hr className="my-3" />
            <div className="space-y-1 text-xs mb-3">
              <div className="flex justify-between"><span className="text-gray-500">رقم الفاتورة</span><span className="font-mono">#{receipt.sale.id.slice(-8).toUpperCase()}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">التاريخ</span><span>{new Date(receipt.timestamp).toLocaleString('ar-SA')}</span></div>
              {user?.fullName && <div className="flex justify-between"><span className="text-gray-500">الكاشير</span><span>{user.fullName}</span></div>}
            </div>
            <hr className="my-3" />
            <table className="w-full text-xs mb-3">
              <thead>
                <tr className="border-b text-gray-400">
                  <th className="text-right pb-1">المنتج</th>
                  <th className="text-center pb-1">الكمية</th>
                  <th className="text-left pb-1">السعر</th>
                  <th className="text-left pb-1">الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {receipt.items.map((item, i) => (
                  <tr key={i} className="border-b border-dashed border-gray-100">
                    <td className="py-1 text-right">
                      <span>{item.nameAr}</span>
                      {item.modifiers && item.modifiers.length > 0 && (
                        <div className="mt-0.5 space-y-0.5">
                          {item.modifiers.map((m, mi) => (
                            <span key={mi} className="block text-[10px] text-gray-500">✓ {m.nameAr}{Number(m.price) > 0 ? ` (+${Number(m.price).toFixed(2)})` : ''}</span>
                          ))}
                        </div>
                      )}
                      {item.barcode && <BarcodeImage value={item.barcode} height={30} fontSize={8} />}
                    </td>
                    <td className="py-1 text-center">{item.quantity}</td>
                    <td className="py-1 text-left">{Number(item.price).toFixed(2)}</td>
                    <td className="py-1 text-left font-medium">{(item.price * item.quantity).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between"><span className="text-gray-500">المجموع قبل الضريبة</span><span>{receipt.subtotal.toFixed(2)} ر.س</span></div>
              {(receipt.discount || 0) > 0 && <div className="flex justify-between text-red-600"><span>الخصم</span><span>-{receipt.discount.toFixed(2)} ر.س</span></div>}
              <div className="flex justify-between"><span className="text-gray-500">ضريبة القيمة المضافة 15%</span><span>{receipt.taxTotal.toFixed(2)} ر.س</span></div>
            </div>
            <div className="flex justify-between font-bold text-base border-t mt-2 pt-2">
              <span>الإجمالي النهائي</span><span>{receipt.grandTotal.toFixed(2)} ر.س</span>
            </div>
            {receipt.method === 'CASH' && (
              <div className="border-t mt-2 pt-2 space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-gray-500">المبلغ المدفوع</span><span>{receipt.cashReceived.toFixed(2)} ر.س</span></div>
                <div className="flex justify-between font-bold text-green-600"><span>الباقي</span><span>{receipt.change.toFixed(2)} ر.س</span></div>
              </div>
            )}
            <hr className="my-3" />
            <div className="text-center mt-3 space-y-1">
              {storeSettings?.receiptFooterAr && <p className="text-xs text-gray-500">{storeSettings.receiptFooterAr}</p>}
              <p className="text-xs text-gray-400">شكراً لزيارتكم</p>
              <div className="mt-4 pt-3 border-t border-dashed flex flex-col items-center">
                <QRImage value={qrValue} size={100} />
                <p className="text-[10px] text-gray-400 mt-1 font-mono">#{receipt.sale.id.slice(-8).toUpperCase()}</p>
              </div>
            </div>
            <div className="mt-4 space-y-2 no-print">
              <div className="flex gap-3">
                <button className="no-print flex-1 py-2.5 bg-gray-100 rounded-xl hover:bg-gray-200 font-medium flex items-center justify-center gap-2 text-sm"
                  onClick={() => window.print()}>
                  <Receipt size={16} /> طباعة الفاتورة
                </button>
                <button className="no-print flex-1 py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700 font-medium flex items-center justify-center gap-2 text-sm"
                  onClick={() => printKitchenReceipt(receipt.items, receipt.sale.id, receipt.timestamp)}>
                  <ChefHat size={16} /> فاتورة المطبخ
                </button>
              </div>
              <button className="no-print flex-1 w-full py-2.5 bg-brand-500 text-white rounded-xl hover:bg-brand-600 font-bold text-sm"
                onClick={clearCart}>
                <ShoppingBag size={16} className="inline mr-1" /> بيع جديد
              </button>
              <button className="no-print w-full py-2.5 border border-gray-300 rounded-xl hover:bg-gray-50 text-gray-600 font-medium text-sm flex items-center justify-center gap-2"
                onClick={() => { setReceipt(null); setShowCheckout(false); }}>
                <ArrowLeft size={16} /> العودة إلى نقطة البيع
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Checkout Modal ─────────────────────────────────────
  if (showCheckout) {
    const discounted = Number(discountAmt) || 0;
    const displayTotal = Math.max(0, subtotal + taxTotal - discounted);
    return (
      <div className="min-h-screen bg-black/50 flex items-center justify-center p-4">
        <Toaster position="top-center" />
        <div className="bg-white rounded-2xl w-full max-w-md p-6">
          <div className="flex items-center justify-between mb-6">
            <button onClick={() => setShowCheckout(false)} className="p-2 hover:bg-gray-100 rounded-xl"><X size={20} /></button>
            <h2 className="text-xl font-bold">إتمام البيع</h2>
            <div />
          </div>
          {!activeShift && <div className="mb-4 bg-red-50 border border-red-300 rounded-xl p-3 text-sm text-red-800 font-medium text-center">⚠️ لا توجد وردية مفتوحة</div>}
          {orderChannels.length > 1 && (
            <div className="mb-4">
              <label className="block text-sm text-gray-500 mb-2">قناة الطلب</label>
              <div className="flex flex-wrap gap-2">
                {orderChannels.map(ch => (
                  <button key={ch.key} type="button" onClick={() => { setOrderChannel(ch.key); if (ch.defaultPayment) setPaymentMethod(ch.defaultPayment); }}
                    className={`py-2 px-4 rounded-lg border-2 text-sm font-medium transition ${orderChannel === ch.key ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 hover:border-gray-300'}`}>
                    {ch.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="mb-4">
            <label className="block text-sm text-gray-500 mb-1">العميل (اختياري)</label>
            <select value={selectedCustomer || ''} onChange={e => setSelectedCustomer(e.target.value || null)} className="w-full border rounded-xl px-4 py-2 bg-gray-50 text-sm">
              <option value="">بدون عميل</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}{c.phone ? ` — ${c.phone}` : ''}</option>)}
            </select>
          </div>
          {isAdmin ? (
            <div className="mb-4">
              <label className="block text-sm text-gray-500 mb-1">الخصم (ر.س) — مدير فقط</label>
              <input type="number" min="0" max={subtotal + taxTotal} step="0.01" value={discountAmt}
                onChange={e => setDiscountAmt(Math.min(Number(e.target.value), subtotal + taxTotal))}
                className="w-full border rounded-xl px-4 py-2 bg-gray-50" placeholder="0.00" />
            </div>
          ) : <div className="mb-4 text-xs text-gray-400 text-center">الخصم متاح للمدير فقط</div>}
          <div className="text-center py-6 bg-gray-50 rounded-xl mb-6">
            <p className="text-5xl font-black text-brand-600">{displayTotal.toFixed(2)}</p>
            <p className="text-sm text-gray-500 mt-1">{cartCount} items</p>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-6">
            <button onClick={() => setPaymentMethod('CASH')} className={`flex flex-col items-center p-4 rounded-xl border-2 transition ${paymentMethod === 'CASH' ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200'}`}>
              <Banknote size={24} className="mb-2" /><span className="font-medium text-sm">نقدي</span>
            </button>
            <button onClick={() => setPaymentMethod('CARD')} className={`flex flex-col items-center p-4 rounded-xl border-2 transition ${paymentMethod === 'CARD' ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200'}`}>
              <CreditCard size={24} className="mb-2" /><span className="font-medium text-sm">بطاقة</span>
            </button>
          </div>
          {paymentMethod === 'CASH' && (
            <div className="mb-6">
              <label className="block text-sm text-gray-500 mb-2">المبلغ المدفوع</label>
              <input type="number" value={cashReceived} onChange={e => setCashReceived(Number(e.target.value))}
                className="w-full text-center text-3xl font-bold border rounded-xl p-4 bg-gray-50" placeholder="0.00" step="0.01" />
              <div className="grid grid-cols-5 gap-2 mt-3">
                {[10, 20, 50, 100, 200].map(v => <button key={v} onClick={() => setCashReceived(v)} className="py-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm font-medium">{v}</button>)}
              </div>
              {cashReceived > 0 && (
                <div className={`mt-3 p-3 rounded-xl text-center font-bold ${cashReceived >= displayTotal ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                  {cashReceived >= displayTotal ? `الباقي: ${(cashReceived - displayTotal).toFixed(2)} ر.س` : `الناقص: ${(displayTotal - cashReceived).toFixed(2)} ر.س`}
                </div>
              )}
            </div>
          )}
          <button onClick={completeSale} disabled={processing || !canComplete}
            className="w-full py-4 bg-brand-500 text-white rounded-xl hover:bg-brand-600 disabled:opacity-50 font-bold text-xl transition">
            {processing ? 'جاري المعالجة...' : `إتمام • ${displayTotal.toFixed(2)} ر.س`}
          </button>
        </div>
      </div>
    );
  }

  // ─── Modifier Modal ("تخصيص المنتج") ────────────────────
  if (modifierModal) {
    const base = Number(modifierModal.product.salePrice);
    const extra = modifiersExtraPrice();
    const valid = modifiersValid();
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" dir="rtl">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[92vh] flex flex-col overflow-hidden">
          <div className="flex items-center gap-3 p-5 border-b border-line">
            <div className="w-14 h-14 rounded-2xl bg-brand-50 flex items-center justify-center text-2xl shrink-0">🍔</div>
            <div className="flex-1">
              <h3 className="font-bold text-lg text-ink">{modifierModal.product.nameAr}</h3>
              <p className="text-sm text-muted">السعر الأساسي: {base.toFixed(2)} ر.س</p>
            </div>
            <button onClick={() => { setModifierModal(null); setSelectedOptions({}); setModGroups([]); }}
              className="p-2 hover:bg-canvas rounded-xl text-muted"><X size={18} /></button>
          </div>

          <div className="flex-1 overflow-auto p-5 space-y-5">
            {modGroups.map(g => {
              const sel = selectedOptions[g.id] || [];
              const single = Number(g.maxSelect) === 1;
              const incomplete = (g.required && sel.length < Math.max(1, Number(g.minSelect))) || sel.length < Number(g.minSelect);
              return (
                <div key={g.id}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-semibold text-sm text-ink flex items-center gap-2">
                      {g.nameAr}
                      {g.required && <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-50 text-red-600 font-medium">مطلوب</span>}
                    </p>
                    <span className="text-[11px] text-muted">{single ? 'اختر واحداً' : `اختر حتى ${g.maxSelect}`}</span>
                  </div>
                  <div className="space-y-2">
                    {(g.options || []).filter(o => o.isAvailable !== false).map(o => {
                      const checked = sel.includes(o.id);
                      return (
                        <button key={o.id} onClick={() => toggleOption(g, o.id)}
                          className={`w-full flex items-center justify-between p-3 rounded-xl border-2 transition ${checked ? 'border-brand-500 bg-brand-50' : 'border-line hover:border-gray-300'}`}>
                          <div className="flex items-center gap-2.5">
                            <div className={`w-5 h-5 ${single ? 'rounded-full' : 'rounded-md'} border-2 flex items-center justify-center ${checked ? 'bg-brand-600 border-brand-600' : 'border-gray-300'}`}>
                              {checked && <span className="text-white text-xs leading-none">{single ? '●' : '✓'}</span>}
                            </div>
                            <span className="font-medium text-sm text-ink">{o.nameAr}</span>
                          </div>
                          <span className="text-sm text-muted">{Number(o.priceDelta) > 0 ? `+${Number(o.priceDelta).toFixed(2)} ر.س` : 'مجاني'}</span>
                        </button>
                      );
                    })}
                  </div>
                  {incomplete && <p className="text-[11px] text-red-500 mt-1.5">{g.required && sel.length === 0 ? 'هذا الاختيار إجباري' : `اختر ${g.minSelect} على الأقل`}</p>}
                </div>
              );
            })}
          </div>

          <div className="p-5 border-t border-line bg-canvas">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted">السعر النهائي</span>
              <span className="text-2xl font-black text-brand-600">{(base + extra).toFixed(2)} <span className="text-sm font-medium">ر.س</span></span>
            </div>
            <button onClick={confirmModifiers} disabled={!valid}
              className="w-full py-3.5 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 disabled:opacity-50 transition">
              إضافة للسلة
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Main POS Screen ────────────────────────────────────
  return (
    <div className="h-screen flex bg-gray-100" dir="rtl">
      <Toaster position="top-center" />
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="px-4 py-3 bg-white border-b flex items-center gap-3 flex-wrap">
          <button onClick={() => navigate('/dashboard')} className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft size={20} className="text-gray-500" />
          </button>
          <div className="relative flex-1 min-w-[200px]">
            <Search size={18} className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input ref={barcodeRef} onKeyDown={handleBarcodeScan} onChange={e => setSearch(e.target.value)}
              placeholder="ابحث أو امسح الباركود..."
              className="w-full ps-10 pr-4 py-2.5 bg-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-brand-400 text-lg" />
          </div>
        </div>
        <div className="px-4 py-2 bg-white border-b flex gap-2 overflow-x-auto">
          <button onClick={() => setActiveCategory(null)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap ${!activeCategory ? 'bg-brand-500 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}>الكل</button>
          {categories.map(cat => (
            <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap ${activeCategory === cat.id ? 'bg-brand-500 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}>
              {cat.nameAr || cat.nameEn}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-auto p-4">
          {visible.length === 0 ? (
            <div className="h-full flex items-center justify-center text-gray-400 text-lg">لا توجد منتجات</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {visible.map(product => (
                <button key={product.id} onClick={() => handleProductClick(product)}
                  className="bg-white rounded-xl p-4 border border-gray-100 hover:border-brand-400 hover:shadow-md transition text-start">
                  <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center text-xl mb-3">📦</div>
                  <p className="text-sm font-semibold line-clamp-1">{product.nameAr}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{product.nameEn}</p>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="font-bold text-brand-600">{Number(product.salePrice).toFixed(2)}</span>
                    <span className="text-xs text-gray-500">ر.س</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="w-96 bg-white flex flex-col shadow-xl border-r" dir="ltr">
        <div className="px-6 py-4 border-b bg-gray-50">
          <h2 className="font-bold text-lg flex items-center gap-2">🛒 Cart <span className="text-sm font-normal text-gray-400">({cartCount})</span></h2>
        </div>
        {cart.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-gray-300 text-sm">Cart is empty</div>
        ) : (
          <div className="flex-1 overflow-auto divide-y">
            {cart.map(item => (
              <div key={item.cartKey} className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.nameAr}</p>
                    {item.modifiers && item.modifiers.length > 0 && (
                      <div className="mt-0.5">
                        {item.modifiers.map((m, i) => <span key={i} className="text-[10px] text-gray-400 block">• {m.nameAr}{Number(m.price) > 0 ? ` +${Number(m.price).toFixed(2)}` : ''}</span>)}
                      </div>
                    )}
                    <p className="text-xs text-gray-400">{(item.price * item.quantity).toFixed(2)} ر.س</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => updateQty(item.cartKey, -1)} className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center"><Minus size={14} /></button>
                    <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                    <button onClick={() => updateQty(item.cartKey, 1)} className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center"><Plus size={14} /></button>
                  </div>
                  <button onClick={() => removeItem(item.cartKey)} className="text-red-400 hover:text-red-600"><Trash2 size={16} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="border-t p-4 space-y-2 bg-gray-50">
          <div className="flex justify-between text-sm"><span className="text-gray-500">Subtotal</span><span>{subtotal.toFixed(2)} ر.س</span></div>
          <div className="flex justify-between text-sm"><span className="text-gray-500">VAT 15%</span><span>{taxTotal.toFixed(2)} ر.س</span></div>
          <div className="flex justify-between font-bold text-lg pt-2 border-t"><span>Grand Total</span><span>{grandTotal.toFixed(2)} ر.س</span></div>
          {shiftChecked && !activeShift && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2 text-center font-medium">⚠️ لا توجد وردية مفتوحة</div>
          )}
          <div className="flex gap-2 mt-2">
            <button onClick={() => setShowCheckout(true)} disabled={cart.length === 0}
              className="flex-1 py-3 bg-brand-500 text-white rounded-xl hover:bg-brand-600 disabled:opacity-50 font-bold text-lg">ادفع • Pay</button>
            {cart.length > 0 && (
              <button onClick={() => setCancelConfirm(true)} className="py-3 px-4 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 font-medium text-sm border border-red-200"><X size={18} /></button>
            )}
          </div>
        </div>
      </div>

      {cancelConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setCancelConfirm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <div className="text-center mb-5">
              <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3"><X size={24} className="text-red-500" /></div>
              <h3 className="text-lg font-bold">إلغاء العملية</h3>
              <p className="text-xs text-red-500 mt-1 font-medium">{cart.length} منتج في السلة</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => { clearCart(); setCancelConfirm(false); toast('تم إلغاء العملية', { icon: '🗑️' }); }} className="flex-1 py-3 bg-red-500 text-white rounded-xl hover:bg-red-600 font-bold">إلغاء</button>
              <button onClick={() => setCancelConfirm(false)} className="flex-1 py-3 bg-gray-100 rounded-xl hover:bg-gray-200 font-medium">تراجع</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
