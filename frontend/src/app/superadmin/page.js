'use client';
import { useEffect, useState, useRef } from 'react';
import {
    Shield, Building2, Users, Database, Settings,
    LogOut, Upload, Image as ImageIcon, Plus, Trash2,
    Edit2, Key, Check, X, RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../context/AuthContext';
import { API_BASE_URL, API_ORIGIN } from '../../../lib/config';

const api = axios.create({ baseURL: API_BASE_URL });
api.interceptors.request.use(cfg => {
    const t = localStorage.getItem('token');
    if (t) cfg.headers.Authorization = `Bearer ${t}`;
    return cfg;
});

// ─── tiny helpers ───────────────────────────────────────────────
function Badge({ label, color = 'gray' }) {
    const map = {
        green: 'bg-emerald-100 text-emerald-700',
        blue: 'bg-blue-100 text-blue-700',
        red: 'bg-red-100 text-red-700',
        gray: 'bg-gray-100 text-gray-600',
    };
    return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${map[color]}`}>{label}</span>;
}

function Modal({ title, onClose, children }) {
    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white">
                    <h2 className="font-semibold text-gray-800">{title}</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
                </div>
                <div className="p-5">{children}</div>
            </div>
        </div>
    );
}

// ─── Main Component ─────────────────────────────────────────────
export default function SuperadminDashboard() {
    const router = useRouter();
    const { logout } = useAuth();
    const fileInputRef = useRef(null);
    const [tab, setTab] = useState('overview');
    const [loading, setLoading] = useState(true);

    const [stats, setStats] = useState({ factories: 0, users: 0, customers: 0, invoices: 0, total_revenue: 0 });
    const [factories, setFactories] = useState([]);
    const [allUsers, setAllUsers] = useState([]);
    const [settings, setSettings] = useState({ app_name: 'FactoryOS', logo_url: '' });
    const [uploading, setUploading] = useState(false);

    // Add factory modal
    const [showAddFactory, setShowAddFactory] = useState(false);
    const [factoryForm, setFactoryForm] = useState({ name: '', address: '' });

    // Add user modal
    const [showAddUser, setShowAddUser] = useState(false);
    const [userForm, setUserForm] = useState({ username: '', password: '', full_name: '', role: 'admin', factory_id: '' });

    // Reset password modal
    const [showReset, setShowReset] = useState(false);
    const [resetTarget, setResetTarget] = useState(null);
    const [newPwd, setNewPwd] = useState('');

    // ── fetch ──
    const load = async () => {
        if (!localStorage.getItem('token')) return;
        setLoading(true);
        try {
            const [s, f, u, st] = await Promise.all([
                api.get('/superadmin/dashboard'),
                api.get('/superadmin/factories'),
                api.get('/superadmin/users'),
                api.get('/superadmin/settings'),
            ]);
            setStats(s.data);
            setFactories(f.data);
            setAllUsers(u.data);
            setSettings(st.data || settings);
        } catch (err) { 
            if (err.response?.status !== 401) {
                toast.error('Failed to load data. Is the server running?'); 
            }
        }
        finally { setLoading(false); }
    };

    useEffect(() => { load(); }, []);

    const handleLogout = () => {
        logout();
        window.location.href = '/login';
    };

    // ── Settings ──
    const saveSettings = async (e) => {
        e.preventDefault();
        try {
            await api.put('/superadmin/settings', settings);
            toast.success('Settings saved!');
        } catch { toast.error('Failed to save settings'); }
    };

    const uploadLogo = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const fd = new FormData();
        fd.append('logo', file);
        setUploading(true);
        try {
            const res = await api.post('/superadmin/upload-logo', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
            setSettings(s => ({ ...s, logo_url: res.data.url }));
            toast.success('Logo uploaded!');
        } catch { toast.error('Upload failed'); }
        finally { setUploading(false); }
    };

    // ── Add Factory ──
    const handleAddFactory = async () => {
        if (!factoryForm.name) return toast.error('Factory name required');
        try {
            await api.post('/superadmin/factories', factoryForm);
            toast.success('Factory created!');
            setShowAddFactory(false);
            setFactoryForm({ name: '', address: '' });
            load();
        } catch (err) { toast.error(err.response?.data?.error || 'Failed to create factory'); }
    };

    // ── Add User ──
    const handleAddUser = async () => {
        if (!userForm.username || !userForm.password || !userForm.factory_id)
            return toast.error('Username, password and factory are required');
        try {
            await api.post('/superadmin/users', userForm);
            toast.success('User created!');
            setShowAddUser(false);
            setUserForm({ username: '', password: '', full_name: '', role: 'admin', factory_id: '' });
            load();
        } catch (err) { toast.error(err.response?.data?.error || 'Failed to create user'); }
    };

    // ── Delete User ──
    const deleteUser = async (id) => {
        if (!confirm('Delete this user?')) return;
        try {
            await api.delete(`/users/${id}`);
            toast.success('User deleted');
            load();
        } catch { toast.error('Failed to delete user'); }
    };

    // ── Reset Password ──
    const handleReset = async () => {
        if (!newPwd || newPwd.length < 4) return toast.error('Min 4 characters');
        try {
            await api.put(`/users/${resetTarget.user_id}/reset-password`, { new_password: newPwd });
            toast.success('Password reset!');
            setShowReset(false); setResetTarget(null); setNewPwd('');
        } catch { toast.error('Failed'); }
    };

    if (loading) return (
        <div className="min-h-[60vh] flex items-center justify-center">
            <div className="text-center space-y-3">
                <div className="animate-spin w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto"></div>
                <p className="text-gray-500 text-sm">Loading Control Center...</p>
            </div>
        </div>
    );

    const roleColor = { superadmin: 'red', admin: 'green', user: 'blue' };

    return (
        <div className="space-y-6">
            {/* ── Header ── */}
            <div className="flex flex-wrap gap-3 items-center justify-between bg-slate-900 p-5 rounded-3xl text-white shadow-xl">
                <div className="flex items-center gap-4">
                    <div className="bg-indigo-500 p-3 rounded-2xl shadow">
                        <Shield size={26} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold">Superadmin Control Center</h1>
                        <p className="text-indigo-300 text-xs">Global Multi-Tenant Administration</p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    {[
                        { key: 'overview', label: 'Overview' },
                        { key: 'factories', label: 'Factories' },
                        { key: 'users', label: 'All Users' },
                        { key: 'settings', label: 'Settings' },
                    ].map(t => (
                        <button key={t.key} onClick={() => setTab(t.key)}
                            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${tab === t.key ? 'bg-indigo-500 text-white shadow' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>
                            {t.label}
                        </button>
                    ))}
                    <div className="w-px bg-slate-700 mx-1 self-stretch" />
                    <button onClick={load} className="px-3 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors" title="Refresh">
                        <RefreshCw size={16} />
                    </button>
                    <button onClick={handleLogout} className="px-4 py-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-colors flex items-center gap-2 text-sm font-medium">
                        <LogOut size={16} /> Logout
                    </button>
                </div>
            </div>

            {/* ── Overview ── */}
            {tab === 'overview' && (
                <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                            { label: 'Factories', value: stats.factories, icon: Building2, color: 'bg-blue-100 text-blue-600' },
                            { label: 'Total Users', value: stats.users, icon: Users, color: 'bg-emerald-100 text-emerald-600' },
                            { label: 'Total Invoices', value: stats.invoices, icon: Database, color: 'bg-purple-100 text-purple-600' },
                            { label: 'Global Revenue', value: `Rs ${Number(stats.total_revenue || 0).toLocaleString()}`, icon: Shield, color: 'bg-rose-100 text-rose-600' },
                        ].map(card => (
                            <div key={card.label} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center gap-4">
                                <div className={`p-3 rounded-xl ${card.color}`}><card.icon size={22} /></div>
                                <div>
                                    <p className="text-xs text-gray-500">{card.label}</p>
                                    <p className="text-xl font-bold text-gray-800">{card.value}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="p-5 border-b bg-gray-50 flex items-center justify-between">
                            <h3 className="font-bold text-gray-800">Active Factories</h3>
                            <button onClick={() => setTab('factories')} className="text-xs text-indigo-600 hover:underline">Manage →</button>
                        </div>
                        <table className="w-full text-sm">
                            <thead className="bg-white border-b">
                                <tr>{['Factory', 'Users', 'Status', 'Created'].map(h => <th key={h} className="p-4 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>)}</tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {factories.map(f => (
                                    <tr key={f.factory_id} className="hover:bg-gray-50">
                                        <td className="p-4 font-medium text-gray-900">{f.name}<br /><span className="text-xs text-gray-400">{f.factory_id}</span></td>
                                        <td className="p-4 text-gray-600">{f.user_count}</td>
                                        <td className="p-4"><Badge label={f.status || 'active'} color="green" /></td>
                                        <td className="p-4 text-gray-500 text-xs">{new Date(f.created_at).toLocaleDateString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {/* ── Factories ── */}
            {tab === 'factories' && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="p-5 border-b bg-gray-50 flex items-center justify-between">
                        <h3 className="font-bold text-gray-800">Manage Factories</h3>
                        <button onClick={() => setShowAddFactory(true)} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors">
                            <Plus size={16} /> New Factory
                        </button>
                    </div>
                    <table className="w-full text-sm">
                        <thead className="bg-white border-b">
                            <tr>{['ID', 'Factory Name', 'Address', 'Users', 'Status'].map(h => <th key={h} className="p-4 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>)}</tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {factories.map(f => (
                                <tr key={f.factory_id} className="hover:bg-gray-50">
                                    <td className="p-4 text-xs text-gray-400 font-mono">{f.factory_id}</td>
                                    <td className="p-4 font-semibold text-gray-900">{f.name}</td>
                                    <td className="p-4 text-gray-500">{f.address || '—'}</td>
                                    <td className="p-4 text-gray-600">{f.user_count}</td>
                                    <td className="p-4"><Badge label={f.status || 'active'} color="green" /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ── All Users ── */}
            {tab === 'users' && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="p-5 border-b bg-gray-50 flex items-center justify-between">
                        <h3 className="font-bold text-gray-800">All Users Across System</h3>
                        <button onClick={() => setShowAddUser(true)} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors">
                            <Plus size={16} /> New Admin/User
                        </button>
                    </div>
                    <table className="w-full text-sm">
                        <thead className="bg-white border-b">
                            <tr>{['User', 'Username', 'Role', 'Factory', 'Status', 'Actions'].map(h => <th key={h} className="p-4 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>)}</tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {allUsers.map(u => (
                                <tr key={u.user_id} className="hover:bg-gray-50">
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${u.role === 'admin' ? 'bg-green-500' : u.role === 'superadmin' ? 'bg-red-500' : 'bg-blue-500'}`}>
                                                {(u.full_name || u.username)?.charAt(0).toUpperCase()}
                                            </div>
                                            <span className="font-medium text-gray-800">{u.full_name || '—'}</span>
                                        </div>
                                    </td>
                                    <td className="p-4 font-mono text-gray-600 text-xs">{u.username}</td>
                                    <td className="p-4"><Badge label={u.role} color={roleColor[u.role] || 'gray'} /></td>
                                    <td className="p-4 text-gray-500 text-xs">{u.factory_name || (u.role === 'superadmin' ? '(Global)' : '—')}</td>
                                    <td className="p-4"><Badge label={u.status || 'active'} color={u.status === 'active' ? 'green' : 'red'} /></td>
                                    <td className="p-4">
                                        {u.role !== 'superadmin' && (
                                            <div className="flex gap-2">
                                                <button onClick={() => { setResetTarget(u); setNewPwd(''); setShowReset(true); }} className="w-8 h-8 bg-yellow-50 hover:bg-yellow-100 text-yellow-600 rounded-lg flex items-center justify-center" title="Reset Password">
                                                    <Key size={14} />
                                                </button>
                                                <button onClick={() => deleteUser(u.user_id)} className="w-8 h-8 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg flex items-center justify-center" title="Delete User">
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {allUsers.length === 0 && (
                                <tr><td colSpan={6} className="p-10 text-center text-gray-400">No users found</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ── Settings ── */}
            {tab === 'settings' && (
                <div className="max-w-2xl">
                    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                        <h3 className="font-bold text-gray-800 mb-5 flex items-center gap-2"><Settings size={18} /> Global White-Label Settings</h3>
                        <form onSubmit={saveSettings} className="space-y-5">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Application Name</label>
                                <input type="text" value={settings.app_name} onChange={e => setSettings(s => ({ ...s, app_name: e.target.value }))}
                                    className="w-full p-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Application Logo</label>
                                <div className="flex items-center gap-4">
                                    {settings.logo_url ? (
                                        <div className="w-20 h-20 rounded-xl border-2 border-gray-100 bg-gray-50 overflow-hidden">
                                            <img src={settings.logo_url.startsWith('http') ? settings.logo_url : `${API_ORIGIN}${settings.logo_url}`} alt="Logo" className="w-full h-full object-contain" />
                                        </div>
                                    ) : (
                                        <div className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center text-gray-400">
                                            <ImageIcon size={28} />
                                        </div>
                                    )}
                                    <div className="flex-1 space-y-2">
                                        <div className="flex gap-2">
                                            <input type="text" value={settings.logo_url} onChange={e => setSettings(s => ({ ...s, logo_url: e.target.value }))}
                                                className="flex-1 p-2.5 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="/uploads/logo.png or https://..." />
                                            <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={uploadLogo} />
                                            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
                                                className="bg-gray-100 border border-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-200 flex items-center gap-2">
                                                {uploading ? <div className="animate-spin h-4 w-4 border-2 border-gray-500 border-t-transparent rounded-full" /> : <Upload size={15} />}
                                                Upload
                                            </button>
                                        </div>
                                        <p className="text-xs text-gray-400">Recommended: 200×200px PNG/SVG</p>
                                    </div>
                                </div>
                            </div>
                            <button type="submit" className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2">
                                <Check size={16} /> Save Settings
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Add Factory Modal ── */}
            {showAddFactory && (
                <Modal title="Create New Factory" onClose={() => setShowAddFactory(false)}>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Factory Name *</label>
                            <input type="text" value={factoryForm.name} onChange={e => setFactoryForm(f => ({ ...f, name: e.target.value }))}
                                className="w-full p-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="e.g. Lahore Factory Unit 2" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                            <textarea value={factoryForm.address} onChange={e => setFactoryForm(f => ({ ...f, address: e.target.value }))}
                                className="w-full p-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none h-20" />
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button onClick={() => setShowAddFactory(false)} className="flex-1 border border-gray-200 py-2.5 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
                            <button onClick={handleAddFactory} className="flex-1 bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700 flex items-center justify-center gap-2">
                                <Check size={16} /> Create
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* ── Add User Modal ── */}
            {showAddUser && (
                <Modal title="Create Admin / User" onClose={() => setShowAddUser(false)}>
                    <div className="space-y-4">
                        {[
                            { label: 'Full Name', key: 'full_name', placeholder: 'Ahmed Khan' },
                            { label: 'Username *', key: 'username', placeholder: 'ahmed123' },
                            { label: 'Password *', key: 'password', placeholder: 'min 4 chars', type: 'password' },
                        ].map(f => (
                            <div key={f.key}>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
                                <input type={f.type || 'text'} value={userForm[f.key]} placeholder={f.placeholder}
                                    onChange={e => setUserForm(u => ({ ...u, [f.key]: e.target.value }))}
                                    className="w-full p-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" />
                            </div>
                        ))}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                            <select value={userForm.role} onChange={e => setUserForm(u => ({ ...u, role: e.target.value }))}
                                className="w-full p-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none">
                                <option value="admin">Admin</option>
                                <option value="user">User</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Assign to Factory *</label>
                            <select value={userForm.factory_id} onChange={e => setUserForm(u => ({ ...u, factory_id: e.target.value }))}
                                className="w-full p-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none">
                                <option value="">— Select Factory —</option>
                                {factories.map(f => <option key={f.factory_id} value={f.factory_id}>{f.name}</option>)}
                            </select>
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button onClick={() => setShowAddUser(false)} className="flex-1 border border-gray-200 py-2.5 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
                            <button onClick={handleAddUser} className="flex-1 bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700 flex items-center justify-center gap-2">
                                <Check size={16} /> Create
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* ── Reset Password Modal ── */}
            {showReset && resetTarget && (
                <Modal title={`Reset Password — ${resetTarget.full_name || resetTarget.username}`} onClose={() => { setShowReset(false); setResetTarget(null); }}>
                    <div className="space-y-4">
                        <input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)}
                            placeholder="Enter new password (min 4 chars)"
                            className="w-full p-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-500 outline-none" />
                        <div className="flex gap-3">
                            <button onClick={() => { setShowReset(false); setResetTarget(null); }} className="flex-1 border border-gray-200 py-2.5 rounded-xl text-sm text-gray-600">Cancel</button>
                            <button onClick={handleReset} className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2">
                                <Key size={15} /> Reset
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
}
