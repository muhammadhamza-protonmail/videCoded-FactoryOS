'use client';
import { useEffect, useState } from 'react';
import { getVendors, createVendor, updateVendor, deleteVendor } from '../../../lib/api';
import { ShoppingCart, Plus, Search, Edit2, Trash2, Check, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { usePermissions } from '../../../hooks/usePermissions';

// ── Modal ──────────────────────────────────────────────────────
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

// ── Field ──────────────────────────────────────────────────────
function Field({ label, type = 'text', value, onChange, placeholder, required, options }) {
    return (
        <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
                {label} {required && <span className="text-red-500">*</span>}
            </label>
            {options ? (
                <select
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                >
                    {options.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                </select>
            ) : (
                <input
                    type={type}
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    placeholder={placeholder}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                />
            )}
        </div>
    );
}

// ── Confirm Delete Modal ───────────────────────────────────────
function ConfirmDelete({ vendor, onConfirm, onCancel }) {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Trash2 size={22} className="text-red-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-800 text-center mb-2">Delete Vendor?</h3>
                <p className="text-gray-500 text-sm text-center mb-6">
                    Are you sure you want to delete <strong>{vendor.name}</strong>? This cannot be undone.
                </p>
                <div className="flex gap-3">
                    <button
                        onClick={onCancel}
                        className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2.5 rounded-xl text-sm font-medium transition-colors"
                    >
                        Yes, Delete
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Main Page ──────────────────────────────────────────────────
export default function VendorsPage() {
    const [vendors, setVendors] = useState([]);
    const [filtered, setFiltered] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showAdd, setShowAdd] = useState(false);
    const [showEdit, setShowEdit] = useState(false);
    const [showDelete, setShowDelete] = useState(false);
    const [selected, setSelected] = useState(null);
    const { can } = usePermissions();

    const emptyForm = {
        name: '', phone: '', address: '', payment_terms: 'Cash', remarks: ''
    };
    const [form, setForm] = useState(emptyForm);

    // ── Fetch ────────────────────────────────────────────────────
    const fetchVendors = async () => {
        try {
            const res = await getVendors();
            setVendors(res.data);
            setFiltered(res.data);
        } catch (err) {
            toast.error('Failed to load vendors');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchVendors(); }, []);

    // ── Search ───────────────────────────────────────────────────
    useEffect(() => {
        const q = search.toLowerCase();
        setFiltered(vendors.filter(v =>
            v.name.toLowerCase().includes(q) ||
            (v.phone && v.phone.includes(q))
        ));
    }, [search, vendors]);

    // ── Add ──────────────────────────────────────────────────────
    const handleAdd = async () => {
        if (!form.name) return toast.error('Name is required');
        try {
            await createVendor(form);
            toast.success('✅ Vendor added!');
            setShowAdd(false);
            setForm(emptyForm);
            fetchVendors();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to add vendor');
        }
    };

    // ── Edit ─────────────────────────────────────────────────────
    const handleEdit = async () => {
        if (!form.name) return toast.error('Name is required');
        try {
            await updateVendor(selected.vendor_id, form);
            toast.success('✅ Vendor updated!');
            setShowEdit(false);
            setSelected(null);
            setForm(emptyForm);
            fetchVendors();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to update vendor');
        }
    };

    // ── Delete ───────────────────────────────────────────────────
    const handleDelete = async () => {
        try {
            await deleteVendor(selected.vendor_id);
            toast.success('✅ Vendor deleted!');
            setShowDelete(false);
            setSelected(null);
            fetchVendors();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to delete vendor');
        }
    };

    const openEdit = (vendor) => {
        setSelected(vendor);
        setForm({
            name: vendor.name,
            phone: vendor.phone || '',
            address: vendor.address || '',
            payment_terms: vendor.payment_terms || 'Cash',
            remarks: vendor.remarks || '',
        });
        setShowEdit(true);
    };

    // ── Summary ──────────────────────────────────────────────────
    const totalPayable = vendors.reduce(
        (sum, v) => sum + Number(v.current_payable || 0), 0
    );

    const paymentTermsOptions = [
        { value: 'Cash', label: 'Cash' },
        { value: '7 days', label: '7 Days' },
        { value: '15 days', label: '15 Days' },
        { value: '30 days', label: '30 Days' },
        { value: '45 days', label: '45 Days' },
    ];

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
                    <h1 className="text-2xl font-bold text-gray-800">Vendors</h1>
                    <p className="text-gray-400 text-sm mt-1">Manage your raw material suppliers</p>
                </div>
                {can('vendors', 'add') && (
                    <button
                        onClick={() => { setForm(emptyForm); setShowAdd(true); }}
                        className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors shadow-sm"
                    >
                        <Plus size={18} />
                        Add Vendor
                    </button>
                )}
            </div>

            {/* ── Stat Cards ── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-50 rounded-2xl p-5 border border-white shadow-sm">
                    <p className="text-3xl font-bold text-gray-800">{vendors.length}</p>
                    <p className="text-sm font-medium text-gray-600 mt-1">Total Vendors</p>
                    <p className="text-xs text-blue-600 mt-1">Active suppliers</p>
                </div>
                <div className="bg-red-50 rounded-2xl p-5 border border-white shadow-sm">
                    <p className="text-3xl font-bold text-gray-800">
                        Rs {totalPayable.toLocaleString()}
                    </p>
                    <p className="text-sm font-medium text-gray-600 mt-1">Total Payable</p>
                    <p className="text-xs text-red-600 mt-1">Outstanding to vendors</p>
                </div>
                <div className="bg-yellow-50 rounded-2xl p-5 border border-white shadow-sm">
                    <p className="text-3xl font-bold text-gray-800">
                        {vendors.filter(v => Number(v.current_payable) > 0).length}
                    </p>
                    <p className="text-sm font-medium text-gray-600 mt-1">Vendors with Dues</p>
                    <p className="text-xs text-yellow-600 mt-1">Pending payments</p>
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
                                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Vendor</th>
                                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Phone</th>
                                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Address</th>
                                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Payment Terms</th>
                                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Payable</th>
                                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {filtered.map(vendor => (
                                <tr key={vendor.vendor_id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                                                {vendor.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-gray-800">{vendor.name}</p>
                                                <p className="text-xs text-gray-400">{vendor.vendor_id}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-600">
                                        {vendor.phone || '—'}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-600">
                                        {vendor.address || '—'}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="bg-blue-100 text-blue-700 text-xs font-medium px-2.5 py-1 rounded-full">
                                            {vendor.payment_terms || 'Cash'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`text-sm font-semibold ${Number(vendor.current_payable) > 0
                                            ? 'text-red-600'
                                            : 'text-green-600'
                                            }`}>
                                            Rs {Number(vendor.current_payable || 0).toLocaleString()}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            {can('vendors', 'edit') && (
                                                <button
                                                    onClick={() => openEdit(vendor)}
                                                    className="w-8 h-8 bg-green-50 hover:bg-green-100 text-green-600 rounded-lg flex items-center justify-center transition-colors"
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                            )}
                                            {can('vendors', 'delete') && (
                                                <button
                                                    onClick={() => { setSelected(vendor); setShowDelete(true); }}
                                                    className="w-8 h-8 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg flex items-center justify-center transition-colors"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                                        <ShoppingCart size={40} className="mx-auto mb-3 opacity-30" />
                                        <p>No vendors found</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── Add Modal ── */}
            {showAdd && (
                <Modal title="Add New Vendor" onClose={() => setShowAdd(false)}>
                    <Field label="Vendor Name" value={form.name} onChange={v => setForm({ ...form, name: v })} placeholder="e.g. Ali Packaging Co." required />
                    <Field label="Phone" value={form.phone} onChange={v => setForm({ ...form, phone: v })} placeholder="e.g. 0300-1111111" />
                    <Field label="Address" value={form.address} onChange={v => setForm({ ...form, address: v })} placeholder="e.g. Karachi" />
                    <Field label="Payment Terms" value={form.payment_terms} onChange={v => setForm({ ...form, payment_terms: v })} options={paymentTermsOptions} />
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
                            Add Vendor
                        </button>
                    </div>
                </Modal>
            )}

            {/* ── Edit Modal ── */}
            {showEdit && (
                <Modal title="Edit Vendor" onClose={() => setShowEdit(false)}>
                    <Field label="Vendor Name" value={form.name} onChange={v => setForm({ ...form, name: v })} placeholder="e.g. Ali Packaging Co." required />
                    <Field label="Phone" value={form.phone} onChange={v => setForm({ ...form, phone: v })} placeholder="e.g. 0300-1111111" />
                    <Field label="Address" value={form.address} onChange={v => setForm({ ...form, address: v })} placeholder="e.g. Karachi" />
                    <Field label="Payment Terms" value={form.payment_terms} onChange={v => setForm({ ...form, payment_terms: v })} options={paymentTermsOptions} />
                    <Field label="Current Payable (Rs)" value={form.current_payable || ''} onChange={v => setForm({ ...form, current_payable: v })} placeholder="e.g. 45000" type="number" />
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

            {/* ── Delete Confirm ── */}
            {showDelete && selected && (
                <ConfirmDelete
                    vendor={selected}
                    onConfirm={handleDelete}
                    onCancel={() => { setShowDelete(false); setSelected(null); }}
                />
            )}

        </div>
    );
}