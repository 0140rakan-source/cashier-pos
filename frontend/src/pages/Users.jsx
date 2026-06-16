import React, { useState, useEffect } from 'react';
import api from '../api/client';
import toast, { Toaster } from 'react-hot-toast';
import { Plus, UserMinus, Key, CheckCircle, XCircle, Edit2, Lock, Trash2 } from 'lucide-react';
import { useAuthStore } from '../store';

export default function Users() {
  const { user: currentUser } = useAuthStore();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ fullName: '', username: '', password: '', roleId: '', pin: '' });

  // Delete confirm modal (replaces window.confirm - blocked in Electron)
  const [deleteTarget, setDeleteTarget] = useState(null); // user object to delete

  // PIN modal
  const [showPinModal, setShowPinModal] = useState(null);
  const [pinValue, setPinValue] = useState('');

  // Edit modal
  const [editUser, setEditUser] = useState(null);
  const [editForm, setEditForm] = useState({ fullName: '', username: '', roleId: '', pin: '' });

  // Admin change password for another user
  const [showPwdModal, setShowPwdModal] = useState(null); // userId
  const [pwdForm, setPwdForm] = useState({ newPassword: '', confirmPassword: '' });

  // Self change password
  const [showSelfPwd, setShowSelfPwd] = useState(false);
  const [selfPwdForm, setSelfPwdForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });

  const loadData = async () => {
    try {
      const [usersRes, rolesRes] = await Promise.all([
        api.get('/users'),
        api.get('/roles'),
      ]);
      setUsers(usersRes.data.data || []);
      setRoles(rolesRes.data.data || []);
    } catch {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // ── Create User ─────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/users', form);
      toast.success('✅ User created');
      setShowCreate(false);
      setForm({ fullName: '', username: '', password: '', roleId: '', pin: '' });
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create user');
    }
  };

  // ── Toggle Active ────────────────────────────────────────────────────────────
  const toggleActive = async (id, isActive) => {
    try {
      await api.put(`/users/${id}`, { isActive: !isActive });
      loadData();
      toast.success(isActive ? 'User deactivated' : 'User activated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  // ── Reset PIN ────────────────────────────────────────────────────────────────
  const resetPin = async (userId) => {
    if (!pinValue.match(/^\d{4}$/)) {
      toast.error('PIN must be 4 digits');
      return;
    }
    try {
      await api.post(`/users/${userId}/reset-pin`, { pin: pinValue });
      toast.success(`✅ PIN reset to ${pinValue}`);
      setShowPinModal(null);
      setPinValue('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  // ── Edit User ────────────────────────────────────────────────────────────────
  const openEdit = (u) => {
    setEditUser(u);
    setEditForm({ fullName: u.fullName, username: u.username, roleId: u.role?.id || '', pin: u.pin || '' });
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/users/${editUser.id}`, editForm);
      toast.success('✅ User updated');
      setEditUser(null);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update user');
    }
  };

  // ── Admin: Change Another User's Password ───────────────────────────────────
  const handleAdminPwdChange = async (e) => {
    e.preventDefault();
    if (pwdForm.newPassword !== pwdForm.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (pwdForm.newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    try {
      await api.post(`/users/${showPwdModal}/change-password`, { newPassword: pwdForm.newPassword });
      toast.success('✅ Password changed');
      setShowPwdModal(null);
      setPwdForm({ newPassword: '', confirmPassword: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password');
    }
  };

  // ── Self: Change Own Password ────────────────────────────────────────────────
  // ── Delete User ─────────────────────────────────────────────────────────────
  const handleDeleteClick = (u) => {
    // Guard: cannot delete self
    if (u.id === currentUser?.id) { toast.error('لا يمكنك حذف حسابك الحالي'); return; }
    // Guard: cannot delete last admin
    const admins = users.filter(x => x.role?.name === 'ADMIN' && x.isActive);
    if (u.role?.name === 'ADMIN' && admins.length <= 1) { toast.error('لا يمكن حذف آخر حساب مدير'); return; }
    setDeleteTarget(u);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await api.delete(`/users/${deleteTarget.id}`);
      if (res.data.deactivated) {
        toast(res.data.message || 'تم تعطيل المستخدم', { icon: 'ℹ️', duration: 5000 });
      } else {
        toast.success(res.data.message || 'تم حذف المستخدم نهائياً');
      }
      setDeleteTarget(null);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'فشل حذف المستخدم');
      setDeleteTarget(null);
    }
  };

  const handleSelfPwdChange = async (e) => {
    e.preventDefault();
    if (selfPwdForm.newPassword !== selfPwdForm.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (selfPwdForm.newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    try {
      await api.post('/users/me/change-password', {
        currentPassword: selfPwdForm.currentPassword,
        newPassword: selfPwdForm.newPassword,
      });
      toast.success('✅ Password changed');
      setShowSelfPwd(false);
      setSelfPwdForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password');
    }
  };

  const roleColor = (roleName) => {
    switch (roleName) {
      case 'ADMIN': return 'bg-red-100 text-red-700';
      case 'MANAGER': return 'bg-blue-100 text-blue-700';
      case 'CASHIER': return 'bg-green-100 text-green-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-400">Loading users...</div>;

  return (
    <div>
      <Toaster />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Users</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setShowSelfPwd(!showSelfPwd)}
            className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 flex items-center gap-2 text-sm"
          >
            <Lock size={16} /> Change My Password
          </button>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 flex items-center gap-2"
          >
            <Plus size={16} /> Add User
          </button>
        </div>
      </div>

      {/* Self Change Password Section */}
      {showSelfPwd && (
        <form onSubmit={handleSelfPwdChange} className="bg-amber-50 border border-amber-200 rounded-xl p-6 mb-6">
          <h3 className="text-sm font-semibold text-amber-800 mb-4 flex items-center gap-2">
            <Lock size={16} /> Change My Password
          </h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Current Password</label>
              <input
                type="password"
                value={selfPwdForm.currentPassword}
                onChange={e => setSelfPwdForm({ ...selfPwdForm, currentPassword: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg bg-white text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">New Password</label>
              <input
                type="password"
                value={selfPwdForm.newPassword}
                onChange={e => setSelfPwdForm({ ...selfPwdForm, newPassword: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg bg-white text-sm"
                required minLength={8}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Confirm Password</label>
              <input
                type="password"
                value={selfPwdForm.confirmPassword}
                onChange={e => setSelfPwdForm({ ...selfPwdForm, confirmPassword: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg bg-white text-sm"
                required
              />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button type="submit" className="px-5 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm">
              Save Password
            </button>
            <button type="button" onClick={() => setShowSelfPwd(false)} className="px-5 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Create User Form */}
      {showCreate && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border p-6 mb-6 grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-500 mb-1">Full Name</label>
            <input value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg bg-gray-50" required />
          </div>
          <div>
            <label className="block text-sm text-gray-500 mb-1">Username</label>
            <input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg bg-gray-50" required />
          </div>
          <div>
            <label className="block text-sm text-gray-500 mb-1">Password</label>
            <input value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg bg-gray-50" type="password" required />
          </div>
          <div>
            <label className="block text-sm text-gray-500 mb-1">Role</label>
            <select value={form.roleId} onChange={e => setForm({ ...form, roleId: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg bg-gray-50" required>
              <option value="">Select role</option>
              {roles.filter(r => r.isSystem || ['ADMIN','MANAGER','CASHIER'].includes(r.name)).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-500 mb-1">PIN (4 digits, optional)</label>
            <input value={form.pin} onChange={e => setForm({ ...form, pin: e.target.value.replace(/\D/g, '').slice(0, 4) })}
              className="w-full px-4 py-2 border rounded-lg bg-gray-50" maxLength={4} placeholder="0000" />
          </div>
          <div className="flex gap-3 items-end">
            <button type="submit" className="px-6 py-2.5 bg-brand-500 text-white rounded-lg hover:bg-brand-600">
              Create
            </button>
            <button type="button" onClick={() => setShowCreate(false)} className="px-6 py-2.5 bg-gray-100 rounded-lg hover:bg-gray-200">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Users Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase">Username</th>
              <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase">Role</th>
              <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-400">No users</td></tr>
            ) : users.map(u => (
              <tr key={u.id} className="border-b hover:bg-gray-50/50">
                <td className="px-6 py-4 text-sm font-medium">{u.fullName}</td>
                <td className="px-6 py-4 text-sm font-mono text-gray-600">{u.username}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${roleColor(u.role?.name)}`}>
                    {u.role?.name || u.roleName}
                  </span>
                </td>
                <td className="px-6 py-4">
                  {u.isActive
                    ? <span className="flex items-center gap-1 text-emerald-600 text-sm"><CheckCircle size={14} /> Active</span>
                    : <span className="flex items-center gap-1 text-red-500 text-sm"><XCircle size={14} /> Inactive</span>
                  }
                </td>
                <td className="px-6 py-4 flex gap-2">
                  <button
                    onClick={() => openEdit(u)}
                    className="text-gray-400 hover:text-brand-500"
                    title="Edit user"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => toggleActive(u.id, u.isActive)}
                    className="text-gray-400 hover:text-orange-500"
                    title={u.isActive ? 'Deactivate' : 'Activate'}
                  >
                    <UserMinus size={16} />
                  </button>
                  <button
                    onClick={() => { setShowPinModal(u.id); setPinValue(u.pin || ''); }}
                    className="text-gray-400 hover:text-blue-500"
                    title="Reset PIN"
                  >
                    <Key size={16} />
                  </button>
                  <button
                    onClick={() => { setShowPwdModal(u.id); setPwdForm({ newPassword: '', confirmPassword: '' }); }}
                    className="text-gray-400 hover:text-purple-500"
                    title="Change password"
                  >
                    <Lock size={16} />
                  </button>
                  <button
                    onClick={() => handleDeleteClick(u)}
                    className={`text-gray-400 hover:text-red-600 ${
                      u.id === currentUser?.id || (u.role?.name === 'ADMIN' && users.filter(x => x.role?.name === 'ADMIN' && x.isActive).length <= 1)
                        ? 'opacity-30 cursor-not-allowed'
                        : ''
                    }`}
                    title="Delete user"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit User Modal */}
      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setEditUser(null)}>
          <div className="bg-white rounded-xl p-8 w-[480px] shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-5">Edit User: {editUser.fullName}</h3>
            <form onSubmit={handleEdit} className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-500 mb-1">Full Name</label>
                <input value={editForm.fullName} onChange={e => setEditForm({ ...editForm, fullName: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg bg-gray-50 text-sm" required />
              </div>
              <div>
                <label className="block text-sm text-gray-500 mb-1">Username</label>
                <input value={editForm.username} onChange={e => setEditForm({ ...editForm, username: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg bg-gray-50 text-sm" required />
              </div>
              <div>
                <label className="block text-sm text-gray-500 mb-1">Role</label>
                <select value={editForm.roleId} onChange={e => setEditForm({ ...editForm, roleId: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg bg-gray-50 text-sm" required>
                  <option value="">Select role</option>
                  {roles.filter(r => r.isSystem || ['ADMIN','MANAGER','CASHIER'].includes(r.name)).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-500 mb-1">PIN (4 digits)</label>
                <input value={editForm.pin} onChange={e => setEditForm({ ...editForm, pin: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                  className="w-full px-3 py-2 border rounded-lg bg-gray-50 text-sm" maxLength={4} placeholder="0000" />
              </div>
              <div className="col-span-2 flex gap-3 mt-2">
                <button type="submit" className="flex-1 py-2.5 bg-brand-500 text-white rounded-xl hover:bg-brand-600 font-medium">
                  Save Changes
                </button>
                <button type="button" onClick={() => setEditUser(null)} className="flex-1 py-2.5 bg-gray-100 rounded-xl hover:bg-gray-200">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin: Change Another User's Password Modal */}
      {showPwdModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setShowPwdModal(null)}>
          <div className="bg-white rounded-xl p-8 w-96 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-5 flex items-center gap-2">
              <Lock size={18} className="text-purple-600" /> Change User Password
            </h3>
            <form onSubmit={handleAdminPwdChange} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-500 mb-1">New Password</label>
                <input
                  type="password"
                  value={pwdForm.newPassword}
                  onChange={e => setPwdForm({ ...pwdForm, newPassword: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg bg-gray-50 text-sm"
                  required minLength={8}
                  placeholder="Minimum 8 characters"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-500 mb-1">Confirm Password</label>
                <input
                  type="password"
                  value={pwdForm.confirmPassword}
                  onChange={e => setPwdForm({ ...pwdForm, confirmPassword: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg bg-gray-50 text-sm"
                  required
                  placeholder="Repeat new password"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="flex-1 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 font-bold">
                  Change Password
                </button>
                <button type="button" onClick={() => setShowPwdModal(null)} className="flex-1 py-3 bg-gray-100 rounded-xl hover:bg-gray-200">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PIN Modal */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setShowPinModal(null)}>
          <div className="bg-white rounded-xl p-8 w-80 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">Reset Cashier PIN</h3>
            <input
              value={pinValue}
              onChange={e => setPinValue(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="0000"
              maxLength={4}
              className="w-full text-center text-3xl font-bold tracking-widest border rounded-xl p-4 mb-4 bg-gray-50 outline-none"
              autoFocus
            />
            <div className="flex gap-3">
              <button onClick={() => resetPin(showPinModal)}
                className="flex-1 py-3 bg-brand-500 text-white rounded-xl hover:bg-brand-600 font-bold">
                Save PIN
              </button>
              <button onClick={() => { setShowPinModal(null); setPinValue(''); }}
                className="flex-1 py-3 bg-gray-100 rounded-xl hover:bg-gray-200">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal - React-based, works in Electron (no window.confirm) */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setDeleteTarget(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <div className="text-center mb-5">
              <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Trash2 size={24} className="text-red-500" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Delete User</h3>
              <p className="text-sm text-gray-500 mt-1">
                Are you sure you want to delete
                <span className="font-semibold text-gray-800"> {deleteTarget.fullName}</span>
                <span className="text-gray-400"> ({deleteTarget.username})</span>?
              </p>
              <p className="text-xs text-red-500 mt-2 font-medium">This action cannot be undone.</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={confirmDelete}
                className="flex-1 py-3 bg-red-500 text-white rounded-xl hover:bg-red-600 font-bold transition"
              >
                Delete
              </button>
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-3 bg-gray-100 rounded-xl hover:bg-gray-200 font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
