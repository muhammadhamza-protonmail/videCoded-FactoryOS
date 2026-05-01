'use client';
import { useEffect, useState } from 'react';
import {
    getUsers, getUserById,
    createUser, updateUserPermissions,
    deleteUser, resetUserPassword
} from '../../../lib/api';
import { useAuth } from '../../../context/AuthContext';
import {
    UserCog, Plus, Edit2, Trash2,
    Check, X, Shield, Eye, Key
} from 'lucide-react';
import toast from 'react-hot-toast';

const MODULES = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'customers', label: 'Customers' },
    { key: 'products', label: 'Products' },
    { key: 'vendors', label: 'Vendors' },
    { key: 'rawmaterials', label: 'Raw Materials' },
    { key: 'production', label: 'Production' },
    { key: 'invoices', label: 'Invoices' },
    { key: 'payments', label: 'Payments' },
    { key: 'inventory', label: 'Inventory' },
];

const ACTIONS = ['view', 'add', 'edit', 'delete'];

const emptyPermissions = () => {
    const perms = {};
    MODULES.forEach(m => {
        perms[m.key] = { view: false, add: false, edit: false, delete: false };
    });
    return perms;
};

// ── Modal ──────────────────────────────────────────────────────
function Modal({ title, onClose, children, wide }) {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
            <div className={`bg-white rounded-2xl shadow-2xl w-full ${wide ? 'max-w-3xl' : 'max-w-md'} max-h-[90vh] overflow-y-auto`}>
                <div className="flex items-center justify-between p-6 border-b border-gray-100 sticky top-0 bg-white z-10">
                    <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X size={20} />
                    </button>
                </div>
                <div className="p-6">{children}</div>
            </div>
        </div>
    );
}

// ── Permission Grid ────────────────────────────────────────────
function PermissionGrid({ permissions, onChange, disabled }) {
    const toggle = (module, action) => {
        if (disabled) return;
        const updated = {
            ...permissions,
            [module]: {
                ...permissions[module],
                [action]: !permissions[module]?.[action],
            }
        };
        // If adding/editing/deleting — auto enable view
        if (action !== 'view' && updated[module][action]) {
            updated[module].view = true;
        }
        onChange(updated);
    };

    const toggleAll = (module) => {
        if (disabled) return;
        const allOn = ACTIONS.every(a => permissions[module]?.[a]);
        const updated = { ...permissions };
        updated[module] = {
            view: !allOn, add: !allOn, edit: !allOn, delete: !allOn
        };
        onChange(updated);
    };

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="bg-gray-50">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Module</th>
                        {ACTIONS.map(a => (
                            <th key={a} className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{a}</th>
                        ))}
                        <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">All</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                    {MODULES.map(({ key, label }) => (
                        <tr key={key} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium text-gray-700">{label}</td>
                            {ACTIONS.map(action => (
                                <td key={action} className="px-4 py-3 text-center">
                                    <button
                                        onClick={() => toggle(key, action)}
                                        disabled={disabled}
                                        className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center mx-auto transition-all ${permissions[key]?.[action]
                                            ? action === 'delete'
                                                ? 'bg-red-500 border-red-500 text-white'
                                                : action === 'edit'
                                                    ? 'bg-blue-500 border-blue-500 text-white'
                                                    : action === 'add'
                                                        ? 'bg-green-500 border-green-500 text-white'
                                                        : 'bg-gray-700 border-gray-700 text-white'
                                            : 'border-gray-200 bg-white'
                                            } ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                                    >
                                        {permissions[key]?.[action] && <Check size={12} />}
                                    </button>
                                </td>
                            ))}
                            <td className="px-4 py-3 text-center">
                                <button
                                    onClick={() => toggleAll(key)}
                                    disabled={disabled}
                                    className={`text-xs px-2 py-1 rounded-lg font-medium transition-colors ${ACTIONS.every(a => permissions[key]?.[a])
                                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
                                >
                                    {ACTIONS.every(a => permissions[key]?.[a]) ? 'All ✓' : 'All'}
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// ── Main Page ──────────────────────────────────────────────────
export default function UsersPage() {
    const { user: currentUser } = useAuth();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [showEdit, setShowEdit] = useState(false);
    const [showDelete, setShowDelete] = useState(false);
    const [showView, setShowView] = useState(false);
    const [selected, setSelected] = useState(null);
    const [viewData, setViewData] = useState(null);
    const [showReset, setShowReset] = useState(false);
    const [newPassword, setNewPassword] = useState('');

    const emptyForm = { username: '', password: '', full_name: '', role: 'user' };
    const [form, setForm] = useState(emptyForm);
    const [permissions, setPermissions] = useState(emptyPermissions());

    // ── Fetch ────────────────────────────────────────────────────
    const fetchUsers = async () => {
        try {
            const res = await getUsers();
            setUsers(res.data);
        } catch (err) {
            toast.error('Failed to load users');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchUsers(); }, []);

    // ── Create ───────────────────────────────────────────────────
    const handleCreate = async () => {
        if (!form.username || !form.password)
            return toast.error('Username and password required');
        try {
            await createUser({ ...form, permissions });
            toast.success('✅ User created!');
            setShowAdd(false);
            setForm(emptyForm);
            setPermissions(emptyPermissions());
            fetchUsers();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to create user');
        }
    };

    // ── Edit ─────────────────────────────────────────────────────
    const openEdit = async (user) => {
        setSelected(user);
        try {
            const res = await getUserById(user.user_id);
            setForm({
                username: user.username,
                full_name: user.full_name || '',
                password: '',
                role: user.role,
                status: user.status || 'active',
            });
            setPermissions(res.data.permissions || emptyPermissions());
            setShowEdit(true);
        } catch (err) {
            toast.error('Failed to load user');
        }
    };

    const handleEdit = async () => {
        try {
            await updateUserPermissions(selected.user_id, {
                full_name: form.full_name,
                role: form.role,
                status: form.status,
                permissions,
            });
            toast.success('✅ User updated!');
            setShowEdit(false);
            fetchUsers();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to update user');
        }
    };

    // ── View ─────────────────────────────────────────────────────
    const openView = async (user) => {
        try {
            const res = await getUserById(user.user_id);
            setViewData(res.data);
            setShowView(true);
        } catch (err) {
            toast.error('Failed to load user');
        }
    };

    const handleResetPassword = async () => {
        if (!newPassword || newPassword.length < 4)
            return toast.error('Password must be at least 4 characters');
        try {
            await resetUserPassword(selected.user_id, { new_password: newPassword });
            toast.success('✅ Password reset successfully!');
            setShowReset(false);
            setNewPassword('');
            setSelected(null);
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to reset password');
        }
    };
    // ── Delete ───────────────────────────────────────────────────
    const handleDelete = async () => {
        try {
            await deleteUser(selected.user_id);
            toast.success('✅ User deleted!');
            setShowDelete(false);
            fetchUsers();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to delete user');
        }
    };

    const roleColors = {
        superadmin: 'bg-red-100 text-red-700',
        admin: 'bg-green-100 text-green-700',
        user: 'bg-blue-100 text-blue-700',
    };

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
    );

    return (
        <div className="space-y-6">

            {/* ── Header ── */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Users</h1>
                    <p className="text-gray-400 text-sm mt-1">Manage factory users and permissions</p>
                </div>
                <button
                    onClick={() => { setForm(emptyForm); setPermissions(emptyPermissions()); setShowAdd(true); }}
                    className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors shadow-sm"
                >
                    <Plus size={18} />
                    Add User
                </button>
            </div>

            {/* ── Stat Cards ── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-50 rounded-2xl p-5">
                    <p className="text-3xl font-bold text-gray-800">{users.length}</p>
                    <p className="text-sm font-medium text-gray-600 mt-1">Total Users</p>
                    <p className="text-xs text-blue-600 mt-1">In your factory</p>
                </div>
                <div className="bg-green-50 rounded-2xl p-5">
                    <p className="text-3xl font-bold text-gray-800">
                        {users.filter(u => u.status === 'active').length}
                    </p>
                    <p className="text-sm font-medium text-gray-600 mt-1">Active Users</p>
                    <p className="text-xs text-green-600 mt-1">Can login</p>
                </div>
                <div className="bg-purple-50 rounded-2xl p-5">
                    <p className="text-3xl font-bold text-gray-800">
                        {users.filter(u => u.role === 'admin').length}
                    </p>
                    <p className="text-sm font-medium text-gray-600 mt-1">Admins</p>
                    <p className="text-xs text-purple-600 mt-1">Full access</p>
                </div>
            </div>

            {/* ── Users Table ── */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-100">
                                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">User</th>
                                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Username</th>
                                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Role</th>
                                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Status</th>
                                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Created</th>
                                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {users.map(u => (
                                <tr key={u.user_id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm ${u.role === 'admin' ? 'bg-green-500' : 'bg-blue-500'
                                                }`}>
                                                {u.full_name?.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-gray-800">{u.full_name}</p>
                                                <p className="text-xs text-gray-400">{u.user_id}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-600 font-mono">{u.username}</td>
                                    <td className="px-6 py-4">
                                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${roleColors[u.role] || 'bg-gray-100 text-gray-600'}`}>
                                            {u.role}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${u.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                            }`}>
                                            {u.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500">
                                        {new Date(u.created_at).toLocaleDateString('en-PK', {
                                            day: 'numeric', month: 'short', year: 'numeric'
                                        })}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => openView(u)}
                                                className="w-8 h-8 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center transition-colors"
                                            >
                                                <Eye size={14} />
                                            </button>
                                            {u.user_id !== currentUser?.user_id && (
                                                <>
                                                    <button
                                                        onClick={() => openEdit(u)}
                                                        className="w-8 h-8 bg-green-50 hover:bg-green-100 text-green-600 rounded-lg flex items-center justify-center transition-colors"
                                                        title="Edit User"
                                                    >
                                                        <Edit2 size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => { setSelected(u); setNewPassword(''); setShowReset(true); }}
                                                        className="w-8 h-8 bg-yellow-50 hover:bg-yellow-100 text-yellow-600 rounded-lg flex items-center justify-center transition-colors"
                                                        title="Reset Password"
                                                    >
                                                        <Key size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => { setSelected(u); setShowDelete(true); }}
                                                        className="w-8 h-8 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg flex items-center justify-center transition-colors"
                                                        title="Delete User"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {users.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                                        <UserCog size={40} className="mx-auto mb-3 opacity-30" />
                                        <p>No users found</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── Add User Modal ── */}
            {showAdd && (
                <Modal title="Add New User" onClose={() => setShowAdd(false)} wide>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                            <input type="text" value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })}
                                placeholder="e.g. Ahmed Khan"
                                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Username <span className="text-red-500">*</span></label>
                            <input type="text" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })}
                                placeholder="e.g. ahmed123"
                                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Password <span className="text-red-500">*</span></label>
                            <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                                placeholder="Set a password"
                                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                            <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}
                                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                                <option value="user">User</option>
                                <option value="admin">Admin</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                            <select value={form.status || 'active'} onChange={e => setForm({ ...form, status: e.target.value })}
                                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                            </select>
                        </div>
                    </div>

                    <div className="mb-4">
                        <div className="flex items-center gap-2 mb-3">
                            <Shield size={16} className="text-green-500" />
                            <h3 className="font-semibold text-gray-800">Module Permissions</h3>
                        </div>
                        <div className="text-xs text-gray-500 mb-3 flex gap-4">
                            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-700 inline-block"></span> View</span>
                            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-500 inline-block"></span> Add</span>
                            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-500 inline-block"></span> Edit</span>
                            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500 inline-block"></span> Delete</span>
                        </div>
                        <PermissionGrid permissions={permissions} onChange={setPermissions} />
                    </div>

                    <div className="flex gap-3">
                        <button onClick={() => setShowAdd(false)}
                            className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50">
                            Cancel
                        </button>
                        <button onClick={handleCreate}
                            className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2">
                            <Check size={16} /> Create User
                        </button>
                    </div>
                </Modal>
            )}

            {/* ── Edit User Modal ── */}
            {showEdit && (
                <Modal title="Edit User & Permissions" onClose={() => setShowEdit(false)} wide>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                            <input type="text" value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })}
                                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                            <input type="text" value={form.username} disabled
                                className="w-full border border-gray-100 bg-gray-50 rounded-xl px-4 py-2.5 text-sm text-gray-500 cursor-not-allowed" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                            <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}
                                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                                <option value="user">User</option>
                                <option value="admin">Admin</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                            <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
                                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                            </select>
                        </div>
                    </div>

                    <div className="mb-4">
                        <div className="flex items-center gap-2 mb-3">
                            <Shield size={16} className="text-green-500" />
                            <h3 className="font-semibold text-gray-800">Module Permissions</h3>
                        </div>
                        <PermissionGrid permissions={permissions} onChange={setPermissions} />
                    </div>

                    <div className="flex gap-3">
                        <button onClick={() => setShowEdit(false)}
                            className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50">
                            Cancel
                        </button>
                        <button onClick={handleEdit}
                            className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2">
                            <Check size={16} /> Save Changes
                        </button>
                    </div>
                </Modal>
            )}

            {/* ── View Permissions Modal ── */}
            {showView && viewData && (
                <Modal title="User Permissions" onClose={() => setShowView(false)} wide>
                    <div className="bg-gray-50 rounded-xl p-4 mb-4 flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${viewData.user.role === 'admin' ? 'bg-green-500' : 'bg-blue-500'
                            }`}>
                            {viewData.user.full_name?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <p className="font-semibold text-gray-800">{viewData.user.full_name}</p>
                            <p className="text-xs text-gray-400">@{viewData.user.username} · {viewData.user.role}</p>
                        </div>
                    </div>
                    <PermissionGrid permissions={viewData.permissions || emptyPermissions()} onChange={() => { }} disabled={true} />
                </Modal>
            )}
            {/* ── Reset Password Modal ── */}
            {showReset && selected && (
                <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
                        <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Key size={22} className="text-yellow-600" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-800 text-center mb-1">
                            Reset Password
                        </h3>
                        <p className="text-gray-400 text-sm text-center mb-6">
                            Set new password for <strong>{selected.full_name}</strong>
                        </p>
                        <input
                            type="password"
                            value={newPassword}
                            onChange={e => setNewPassword(e.target.value)}
                            placeholder="Enter new password (min 4 chars)"
                            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 mb-4"
                        />
                        <div className="flex gap-3">
                            <button
                                onClick={() => { setShowReset(false); setSelected(null); }}
                                className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleResetPassword}
                                className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2"
                            >
                                <Key size={16} />
                                Reset Password
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* ── Delete Confirm ── */}
            {showDelete && selected && (
                <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
                        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Trash2 size={22} className="text-red-600" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-800 text-center mb-2">Delete User?</h3>
                        <p className="text-gray-500 text-sm text-center mb-6">
                            Are you sure you want to delete <strong>{selected.full_name}</strong>?
                        </p>
                        <div className="flex gap-3">
                            <button onClick={() => setShowDelete(false)}
                                className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-medium">
                                Cancel
                            </button>
                            <button onClick={handleDelete}
                                className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2.5 rounded-xl text-sm font-medium">
                                Yes, Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}