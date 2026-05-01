'use client';
import { useEffect, useState } from 'react';
import { getCustomers, createCustomer, updateCustomer } from '../../../lib/api';
import { Users, Plus, Search, Edit2, Eye, X, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { usePermissions } from '../../../hooks/usePermissions';
import Link from 'next/link';

// ── Modal Component ────────────────────────────────────────────
function Modal({ title, onClose, children }) {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
                <div className="flex items-center justify-between p-6 border-b border-gray-100">
                    <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <X size={20} />
                    </button>
                </div>
                <div className="p-6">{children}</div>
            </div>
        </div>
    );
}

// ── Form Field ─────────────────────────────────────────────────
function Field({ label, type = 'text', value, onChange, placeholder, required }) {
    return (
        <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
                {label} {required && <span className="text-red-500">*</span>}
            </label>
            <input
                type={type}
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
            />
        </div>
    );
}

// ── Status Badge ───────────────────────────────────────────────
function StatusBadge({ status }) {
    return (
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${status === 'active'
            ? 'bg-green-100 text-green-700'
            : 'bg-red-100 text-red-700'
            }`}>
            {status}
        </span>
    );
}

// ── Main Page ──────────────────────────────────────────────────
export default function CustomersPage() {
    const [customers, setCustomers] = useState([]);
    const [filtered, setFiltered] = useState([]);
    const [loading, setLoading] = useState(true);
    const { can } = usePermissions();
    const [search, setSearch] = useState('');
    const [showAdd, setShowAdd] = useState(false);
    const [showEdit, setShowEdit] = useState(false);
    const [selected, setSelected] = useState(null);

    // Form state
    const emptyForm = { name: '', phone: '', address: '', credit_limit: '', remarks: '' };
    const [form, setForm] = useState(emptyForm);

    // ── Fetch ────────────────────────────────────────────────────
    const fetchCustomers = async () => {
        try {
            const res = await getCustomers();
            setCustomers(res.data);
            setFiltered(res.data);
        } catch (err) {
            toast.error('Failed to load customers');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchCustomers(); }, []);

    // ── Search ───────────────────────────────────────────────────
    useEffect(() => {
        const q = search.toLowerCase();
        setFiltered(customers.filter(c =>
            c.name.toLowerCase().includes(q) ||
            (c.phone && c.phone.includes(q))
        ));
    }, [search, customers]);

    // ── Add Customer ─────────────────────────────────────────────
    const handleAdd = async () => {
        if (!form.name) return toast.error('Name is required');
        try {
            await createCustomer(form);
            toast.success('Customer added successfully!');
            setShowAdd(false);
            setForm(emptyForm);
            fetchCustomers();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to add customer');
        }
    };

    // ── Edit Customer ─────────────────────────────────────────────
    const handleEdit = async () => {
        if (!form.name) return toast.error('Name is required');
        try {
            await updateCustomer(selected.customer_id, form);
            toast.success('Customer updated!');
            setShowEdit(false);
            setSelected(null);
            setForm(emptyForm);
            fetchCustomers();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to update customer');
        }
    };

    const openEdit = (customer) => {
        setSelected(customer);
        setForm({
            name: customer.name,
            phone: customer.phone || '',
            address: customer.address || '',
            credit_limit: customer.credit_limit || '',
            remarks: customer.remarks || '',
        });
        setShowEdit(true);
    };

    // ── Summary Stats ─────────────────────────────────────────────
    const totalReceivables = customers.reduce(
        (sum, c) => sum + Number(c.balance_due || 0), 0
    );
    const activeCount = customers.filter(c => c.status === 'active').length;

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
                    <h1 className="text-2xl font-bold text-gray-800">Customers</h1>
                    <p className="text-gray-400 text-sm mt-1">
                        Manage customer accounts and view ledgers
                    </p>
                </div>
                {can('customers', 'add') && (
                    <button
                        onClick={() => { setForm(emptyForm); setShowAdd(true); }}
                        className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors shadow-sm"
                    >
                        <Plus size={18} />
                        Add Customer
                    </button>
                )}
            </div>

            {/* ── Stat Cards ── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-50 rounded-2xl p-5 border border-white shadow-sm">
                    <p className="text-3xl font-bold text-gray-800">{customers.length}</p>
                    <p className="text-sm font-medium text-gray-600 mt-1">Total Customers</p>
                    <p className="text-xs text-blue-600 mt-1">{activeCount} active</p>
                </div>
                <div className="bg-green-50 rounded-2xl p-5 border border-white shadow-sm">
                    <p className="text-3xl font-bold text-gray-800">
                        Rs {totalReceivables.toLocaleString()}
                    </p>
                    <p className="text-sm font-medium text-gray-600 mt-1">Total Receivables</p>
                    <p className="text-xs text-green-600 mt-1">Outstanding balance</p>
                </div>
                <div className="bg-purple-50 rounded-2xl p-5 border border-white shadow-sm">
                    <p className="text-3xl font-bold text-gray-800">
                        {customers.filter(c => Number(c.balance_due) > 0).length}
                    </p>
                    <p className="text-sm font-medium text-gray-600 mt-1">Customers with Balance</p>
                    <p className="text-xs text-purple-600 mt-1">Have outstanding dues</p>
                </div>
            </div>

            {/* ── Search ── */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search by name or phone..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                </div>
            </div>

            {/* ── Table ── */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-100">
                                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Customer</th>
                                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Phone</th>
                                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Credit Limit</th>
                                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Balance Due</th>
                                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Status</th>
                                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {filtered.map(customer => (
                                <tr key={customer.customer_id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                                                {customer.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-gray-800">{customer.name}</p>
                                                <p className="text-xs text-gray-400">{customer.customer_id}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-600">
                                        {customer.phone || '—'}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-600">
                                        Rs {Number(customer.credit_limit).toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`text-sm font-semibold ${Number(customer.balance_due) > 0
                                            ? 'text-red-600'
                                            : 'text-green-600'
                                            }`}>
                                            Rs {Number(customer.balance_due).toLocaleString()}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <StatusBadge status={customer.status} />
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <Link href={`/customers/${customer.customer_id}`}>
                                                <button className="w-8 h-8 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center transition-colors">
                                                    <Eye size={14} />
                                                </button>
                                            </Link>
                                            {can('customers', 'edit') && (
                                                <button
                                                    onClick={() => openEdit(customer)}
                                                    className="w-8 h-8 bg-green-50 hover:bg-green-100 text-green-600 rounded-lg flex items-center justify-center transition-colors"
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                                        <Users size={40} className="mx-auto mb-3 opacity-30" />
                                        <p>No customers found</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── Add Modal ── */}
            {showAdd && (
                <Modal title="Add New Customer" onClose={() => setShowAdd(false)}>
                    <Field label="Full Name" value={form.name} onChange={v => setForm({ ...form, name: v })} placeholder="e.g. Ahmad Traders" required />
                    <Field label="Phone" value={form.phone} onChange={v => setForm({ ...form, phone: v })} placeholder="e.g. 0300-1234567" />
                    <Field label="Address" value={form.address} onChange={v => setForm({ ...form, address: v })} placeholder="e.g. Okara, Punjab" />
                    <Field label="Credit Limit" value={form.credit_limit} onChange={v => setForm({ ...form, credit_limit: v })} placeholder="e.g. 100000" type="number" />
                    <Field label="Remarks" value={form.remarks} onChange={v => setForm({ ...form, remarks: v })} placeholder="Any additional info..." />
                    <div className="flex gap-3 mt-2">
                        <button
                            onClick={() => setShowAdd(false)}
                            className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleAdd}
                            className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
                        >
                            <Check size={16} />
                            Add Customer
                        </button>
                    </div>
                </Modal>
            )}

            {/* ── Edit Modal ── */}
            {showEdit && (
                <Modal title="Edit Customer" onClose={() => setShowEdit(false)}>
                    <Field label="Full Name" value={form.name} onChange={v => setForm({ ...form, name: v })} placeholder="e.g. Ahmad Traders" required />
                    <Field label="Phone" value={form.phone} onChange={v => setForm({ ...form, phone: v })} placeholder="e.g. 0300-1234567" />
                    <Field label="Address" value={form.address} onChange={v => setForm({ ...form, address: v })} placeholder="e.g. Okara, Punjab" />
                    <Field label="Credit Limit" value={form.credit_limit} onChange={v => setForm({ ...form, credit_limit: v })} placeholder="e.g. 100000" type="number" />
                    <Field label="Remarks" value={form.remarks} onChange={v => setForm({ ...form, remarks: v })} placeholder="Any additional info..." />
                    <div className="flex gap-3 mt-2">
                        <button
                            onClick={() => setShowEdit(false)}
                            className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleEdit}
                            className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
                        >
                            <Check size={16} />
                            Save Changes
                        </button>
                    </div>
                </Modal>
            )}

        </div>
    );
}