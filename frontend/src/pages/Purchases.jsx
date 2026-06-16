import React, { useState, useEffect } from 'react';
import api from '../api/client';
import toast, { Toaster } from 'react-hot-toast';
import { Plus, Trash2, Minus, ShoppingCart, X } from 'lucide-react';

export default function Purchases() {
  const [list, setList] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    supplierId: '',
    paymentMethod: 'CASH',
    paymentStatus: 'PAID',
    notes: '',
    items: [{ productId: '', quantity: 1, unitPrice: 0 }],
  });

  useEffect(() => {
    Promise.all([
      api.get('/purchases').then(r => setList(r.data.data || [])).catch(() => setList([])),
      api.get('/suppliers').then(r => setSuppliers(r.data.data || [])).catch(() => setSuppliers([])),
      api.get('/products').then(r => setProducts(r.data.data || [])).catch(() => setProducts([])),
    ]).finally(() => setLoading(false));
  }, []);

  const addItem = () => {
    setForm(f => ({ ...f, items: [...f.items, { productId: '', quantity: 1, unitPrice: 0 }] }));
  };

  const removeItem = i => {
    setForm(f => ({ ...f, items: f.items.filter((_, j) => j !== i) }));
  };

  const updateItem = (i, field, val) => {
    setForm(f => {
      const items = [...f.items];
      items[i] = { ...items[i], [field]: val };
      return { ...f, items };
    });
  };

  const totals = () => {
    return form.items.reduce((sum, item) => {
      return sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
    }, 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.supplierId) return toast.error('Select a supplier');
    if (form.items.some(i => !i.productId)) return toast.error('All items need a product');

    const subtotal = totals();
    const tax = subtotal * 0.15;
    const grandTotal = subtotal + tax;

    try {
      await api.post('/purchases', {
        supplierId: form.supplierId,
        paymentMethod: form.paymentMethod,
        paymentStatus: form.paymentStatus,
        notes: form.notes,
        totalAmount: subtotal,
        taxAmount: tax,
        grandTotal,
        items: form.items.map(i => ({
          productId: i.productId,
          quantity: Number(i.quantity),
          unitPrice: Number(i.unitPrice),
          total: Number(i.quantity) * Number(i.unitPrice),
        })),
      });
      toast.success('✅ Purchase recorded — stock updated');
      setShowForm(false);
      setForm({ supplierId: '', paymentMethod: 'CASH', paymentStatus: 'PAID', notes: '', items: [{ productId: '', quantity: 1, unitPrice: 0 }] });
      const res = await api.get('/purchases');
      setList(res.data.data || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save purchase');
    }
  };

  const paymentStatusColor = (s) => {
    if (s === 'PAID') return 'bg-green-100 text-green-700';
    if (s === 'PARTIAL') return 'bg-amber-100 text-amber-700';
    return 'bg-red-100 text-red-700';
  };

  if (loading) return <div className="p-8 text-center text-gray-400">Loading purchases...</div>;

  return (
    <div>
      <Toaster />
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Purchases</h2>
        <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 flex items-center gap-2">
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? 'Cancel' : 'New Purchase'}
        </button>
      </div>

      {/* Purchase Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6 space-y-6">
          <div className="flex items-center gap-2">
            <ShoppingCart size={20} />
            <h3 className="font-bold text-lg">New Purchase Order</h3>
          </div>

          {/* Header */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-500 mb-1">Supplier</label>
              <select value={form.supplierId} onChange={e => setForm({...form, supplierId: e.target.value})}
                className="w-full border rounded-lg px-3 py-2 bg-gray-50" required>
                <option value="">Select supplier</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-500 mb-1">Payment Method</label>
              <select value={form.paymentMethod} onChange={e => setForm({...form, paymentMethod: e.target.value})}
                className="w-full border rounded-lg px-3 py-2 bg-gray-50">
                <option value="CASH">Cash</option>
                <option value="CARD">Card</option>
                <option value="TRANSFER">Bank Transfer</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-500 mb-1">Payment Status</label>
              <select value={form.paymentStatus} onChange={e => setForm({...form, paymentStatus: e.target.value})}
                className="w-full border rounded-lg px-3 py-2 bg-gray-50">
                <option value="PAID">Paid</option>
                <option value="PARTIAL">Partial</option>
                <option value="UNPAID">Unpaid</option>
              </select>
            </div>
          </div>

          {/* Line Items */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Items</label>
              <button type="button" onClick={addItem} className="text-sm text-brand-500 hover:text-brand-600">+ Add product</button>
            </div>
            <div className="grid grid-cols-12 gap-2 text-xs text-gray-400 px-2 pb-1">
              <div className="col-span-5">Product</div>
              <div className="col-span-2 text-center">Qty</div>
              <div className="col-span-2 text-center">Unit Price</div>
              <div className="col-span-2 text-end">Total</div>
              <div className="col-span-1" />
            </div>
            {form.items.map((item, i) => {
              const product = products.find(p => p.id === item.productId);
              return (
                <div key={i} className="grid grid-cols-12 gap-2 items-center bg-gray-50 rounded-lg p-2">
                  <div className="col-span-5">
                    <select value={item.productId} onChange={e => updateItem(i, 'productId', e.target.value)}
                      className="w-full border rounded px-2 py-1.5 text-sm" required>
                      <option value="">Select product</option>
                      {products.map(p => <option key={p.id} value={p.id}>{p.nameAr} / {p.nameEn}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <input type="number" min="1" value={item.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)}
                      className="w-full border rounded px-2 py-1.5 text-sm text-center" required />
                  </div>
                  <div className="col-span-2">
                    <input type="number" min="0" step="0.01" value={item.unitPrice} onChange={e => updateItem(i, 'unitPrice', e.target.value)}
                      className="w-full border rounded px-2 py-1.5 text-sm text-center" required />
                  </div>
                  <div className="col-span-2 text-end font-bold text-sm">
                    {((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0)).toFixed(2)}
                  </div>
                  <div className="col-span-1 text-end">
                    {form.items.length > 1 && (
                      <button type="button" onClick={() => removeItem(i)} className="text-gray-400 hover:text-red-500">
                        <Minus size={14} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Totals */}
          <div className="border-t pt-4 space-y-2 text-sm">
            <div className="flex justify-between text-gray-500">
              <span>Subtotal</span>
              <span>{totals().toFixed(2)} SAR</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>VAT (15%)</span>
              <span>{(totals() * 0.15).toFixed(2)} SAR</span>
            </div>
            <div className="flex justify-between font-bold text-lg border-t pt-2">
              <span>Grand Total</span>
              <span className="text-brand-600">{(totals() * 1.15).toFixed(2)} SAR</span>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm text-gray-500 mb-1">Notes (optional)</label>
            <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})}
              rows={2} className="w-full border rounded-lg px-3 py-2 bg-gray-50 resize-none" />
          </div>

          <div className="flex gap-3">
            <button type="submit" className="px-6 py-2.5 bg-brand-500 text-white rounded-lg hover:bg-brand-600 font-medium">
              Save Purchase & Add Stock
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-6 py-2.5 bg-gray-100 rounded-lg hover:bg-gray-200">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Purchase List */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        {list.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-400">
            <ShoppingCart size={48} className="mx-auto mb-4 opacity-30" />
            <p>No purchases recorded</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase">Ref</th>
                <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase">Supplier</th>
                <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase">Items</th>
                <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase">Total</th>
                <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase">Payment</th>
                <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase">Date</th>
              </tr>
            </thead>
            <tbody>
              {list.map(p => (
                <tr key={p.id} className="border-b hover:bg-gray-50/50">
                  <td className="px-6 py-4 text-sm font-mono">{p.reference || '—'}</td>
                  <td className="px-6 py-4 text-sm">{p.supplier?.name || '—'}</td>
                  <td className="px-6 py-4 text-sm">{p.items?.length || 0} items</td>
                  <td className="px-6 py-4 text-sm font-bold">{Number(p.grandTotal || 0).toFixed(2)} SAR</td>
                  <td className="px-6 py-4 text-sm">{p.paymentMethod}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${paymentStatusColor(p.paymentStatus)}`}>
                      {p.paymentStatus}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {p.createdAt ? new Date(p.createdAt).toLocaleDateString('ar-SA') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
