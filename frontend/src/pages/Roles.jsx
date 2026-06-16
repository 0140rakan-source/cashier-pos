import React, { useState, useEffect } from 'react';
import api from '../api/client';
import toast, { Toaster } from 'react-hot-toast';
import { Plus, Trash2, ChevronDown, ChevronRight, Shield } from 'lucide-react';

const ALL_PERMISSIONS = [
  { group: 'Sales', perms: ['sales.create', 'sales.view'] },
  { group: 'Products', perms: ['products.view', 'products.create', 'products.edit', 'products.delete'] },
  { group: 'Categories', perms: ['categories.view', 'categories.create', 'categories.edit', 'categories.delete'] },
  { group: 'Customers', perms: ['customers.view', 'customers.create', 'customers.edit', 'customers.delete'] },
  { group: 'Suppliers', perms: ['suppliers.view', 'suppliers.create'] },
  { group: 'Inventory', perms: ['inventory.view', 'inventory.adjust'] },
  { group: 'Purchases', perms: ['purchases.view', 'purchases.create'] },
  { group: 'Expenses', perms: ['expenses.view', 'expenses.create', 'expenses.delete'] },
  { group: 'Reports', perms: ['reports.view'] },
  { group: 'Users', perms: ['users.view', 'users.create', 'users.edit', 'users.delete'] },
  { group: 'Roles', perms: ['roles.view', 'roles.create', 'roles.edit', 'roles.delete'] },
  { group: 'Shifts', perms: ['shifts.view', 'shifts.manage'] },
  { group: 'Settings', perms: ['settings.view', 'settings.edit'] },
];

export default function Roles() {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedRole, setExpandedRole] = useState(null);
  const [pendingPerms, setPendingPerms] = useState({}); // roleId -> Set of perms
  const [saving, setSaving] = useState(null); // roleId being saved

  // Create new role
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', description: '' });

  const loadRoles = async () => {
    try {
      const res = await api.get('/roles');
      const data = res.data.data || [];
      setRoles(data);
      // Initialize pending perms from current state
      const initial = {};
      for (const r of data) {
        initial[r.id] = new Set(r.permissions?.map(p => p.permission || p) || []);
      }
      setPendingPerms(initial);
    } catch (err) {
      toast.error('Failed to load roles');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadRoles(); }, []);

  const toggleExpand = (roleId) => {
    setExpandedRole(expandedRole === roleId ? null : roleId);
  };

  const togglePerm = (roleId, perm) => {
    setPendingPerms(prev => {
      const set = new Set(prev[roleId] || []);
      if (set.has(perm)) set.delete(perm);
      else set.add(perm);
      return { ...prev, [roleId]: set };
    });
  };

  const toggleGroupPerms = (roleId, groupPerms) => {
    setPendingPerms(prev => {
      const set = new Set(prev[roleId] || []);
      const allSelected = groupPerms.every(p => set.has(p));
      if (allSelected) groupPerms.forEach(p => set.delete(p));
      else groupPerms.forEach(p => set.add(p));
      return { ...prev, [roleId]: set };
    });
  };

  const saveRolePermissions = async (roleId) => {
    const role = roles.find(r => r.id === roleId);
    if (!role) return;
    setSaving(roleId);
    try {
      const permissions = Array.from(pendingPerms[roleId] || []);
      await api.put(`/roles/${roleId}`, { name: role.name, description: role.description, permissions });
      toast.success('✅ Permissions saved');
      loadRoles();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save permissions');
    } finally {
      setSaving(null);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/roles', { ...createForm, permissions: [] });
      toast.success('✅ Role created');
      setShowCreate(false);
      setCreateForm({ name: '', description: '' });
      loadRoles();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create role');
    }
  };

  // Delete role state (no window.confirm - breaks in Electron)
  const [deleteTarget, setDeleteTarget] = useState(null);

  const handleDelete = async (roleId, roleName) => {
    setDeleteTarget({ id: roleId, name: roleName });
  };

  const confirmDeleteRole = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/roles/${deleteTarget.id}`);
      toast.success('Role deleted');
      if (expandedRole === deleteTarget.id) setExpandedRole(null);
      setDeleteTarget(null);
      loadRoles();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete role');
      setDeleteTarget(null);
    }
  };

  const getPermCount = (roleId) => (pendingPerms[roleId]?.size || 0);

  if (loading) return (
    <div className="p-8 text-center">
      <div className="animate-spin w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full mx-auto mb-3" />
      <p className="text-gray-400">Loading roles...</p>
    </div>
  );

  return (
    <div>
      <Toaster />
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Shield className="text-brand-500" size={24} />
          <h2 className="text-2xl font-bold">Roles & Permissions</h2>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 flex items-center gap-2"
        >
          <Plus size={16} /> New Role
        </button>
      </div>

      {/* Create Role Form */}
      {showCreate && (
        <form onSubmit={handleCreate} className="bg-white rounded-xl shadow-sm border p-6 mb-6 grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-500 mb-1">Role Name</label>
            <input
              value={createForm.name}
              onChange={e => setCreateForm({ ...createForm, name: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg bg-gray-50"
              placeholder="e.g., SUPERVISOR"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-gray-500 mb-1">Description</label>
            <input
              value={createForm.description}
              onChange={e => setCreateForm({ ...createForm, description: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg bg-gray-50"
              placeholder="Optional description"
            />
          </div>
          <div className="flex gap-3">
            <button type="submit" className="px-6 py-2.5 bg-brand-500 text-white rounded-lg hover:bg-brand-600">
              Create Role
            </button>
            <button type="button" onClick={() => setShowCreate(false)} className="px-6 py-2.5 bg-gray-100 rounded-lg hover:bg-gray-200">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Delete confirm modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setDeleteTarget(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <div className="text-center mb-5">
              <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Trash2 size={24} className="text-red-500" />
              </div>
              <h3 className="text-lg font-bold">حذف الدور</h3>
              <p className="text-sm text-gray-500 mt-1">هل تريد حذف الدور <span className="font-semibold">{deleteTarget.name}</span>؟</p>
            </div>
            <div className="flex gap-3">
              <button onClick={confirmDeleteRole} className="flex-1 py-3 bg-red-500 text-white rounded-xl hover:bg-red-600 font-bold">حذف</button>
              <button onClick={() => setDeleteTarget(null)} className="flex-1 py-3 bg-gray-100 rounded-xl hover:bg-gray-200">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {/* Roles List — filter to show only ADMIN, MANAGER, CASHIER as primary */}
      <div className="space-y-3">
        {roles.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center text-gray-400 border">
            No roles found
          </div>
        ) : roles.map(role => {
          const isExpanded = expandedRole === role.id;
          const permCount = getPermCount(role.id);
          const isSystem = ['ADMIN', 'MANAGER', 'CASHIER'].includes(role.name);

          return (
            <div key={role.id} className="bg-white rounded-xl shadow-sm border overflow-hidden">
              {/* Role Header */}
              <div
                className="flex items-center justify-between px-6 py-4 cursor-pointer hover:bg-gray-50"
                onClick={() => toggleExpand(role.id)}
              >
                <div className="flex items-center gap-4">
                  <div>
                    {isExpanded
                      ? <ChevronDown size={18} className="text-gray-400" />
                      : <ChevronRight size={18} className="text-gray-400" />
                    }
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-800">{role.name}</span>
                      {isSystem && (
                        <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">System</span>
                      )}
                    </div>
                    {role.description && (
                      <p className="text-xs text-gray-400 mt-0.5">{role.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-500">
                    <span className="font-semibold text-gray-700">{permCount}</span> permissions
                  </span>
                  {!isSystem && (
                    <button
                      onClick={e => { e.stopPropagation(); handleDelete(role.id, role.name); }}
                      className="p-1.5 text-gray-300 hover:text-red-500 rounded"
                      title="Delete role"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>

              {/* Permissions Panel */}
              {isExpanded && (
                <div className="border-t px-6 py-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {ALL_PERMISSIONS.map(({ group, perms }) => {
                      const allSelected = perms.every(p => pendingPerms[role.id]?.has(p));
                      const someSelected = perms.some(p => pendingPerms[role.id]?.has(p));

                      return (
                        <div key={group} className="border rounded-lg p-3">
                          {/* Group header with select-all */}
                          <div
                            className="flex items-center gap-2 mb-2 cursor-pointer"
                            onClick={() => toggleGroupPerms(role.id, perms)}
                          >
                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                              allSelected
                                ? 'bg-brand-500 border-brand-500'
                                : someSelected
                                  ? 'bg-brand-200 border-brand-400'
                                  : 'border-gray-300'
                            }`}>
                              {(allSelected || someSelected) && (
                                <div className={`w-2 h-2 rounded-sm ${allSelected ? 'bg-white' : 'bg-brand-600'}`} />
                              )}
                            </div>
                            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{group}</span>
                          </div>
                          {/* Individual permissions */}
                          <div className="space-y-1 pl-1">
                            {perms.map(perm => (
                              <label key={perm} className="flex items-center gap-2 cursor-pointer group">
                                <input
                                  type="checkbox"
                                  checked={pendingPerms[role.id]?.has(perm) || false}
                                  onChange={() => togglePerm(role.id, perm)}
                                  className="w-3.5 h-3.5 accent-brand-500"
                                />
                                <span className="text-xs text-gray-600 group-hover:text-gray-800">
                                  {perm.split('.')[1]}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-5 flex justify-end">
                    <button
                      onClick={() => saveRolePermissions(role.id)}
                      disabled={saving === role.id}
                      className="px-6 py-2.5 bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-50 font-medium"
                    >
                      {saving === role.id ? 'Saving...' : 'Save Permissions'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
