'use client';
import { useEffect, useState } from 'react';
import { getRawMaterials, getVendors, createRawMaterial, updateRawMaterial, addInventoryMovement } from '../../../lib/api';
import { Warehouse, Plus, Search, Edit2, AlertTriangle, Check, X, TrendingUp } from 'lucide-react';
import toast from 'react-hot-toast';
import { usePermissions } from '../../../hooks/usePermissions';

// ── Modal ──────────────────────────────────────────────────────
function Modal({ title, onClose, children }) {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
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
                    <option value="">-- Select Vendor --</option>
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

// ── Stock Badge ────────────────────────────────────────────────
function StockBadge({ current, reorder }) {
    if (Number(current) <= 0)
        return <span className="bg-red-100 text-red-700 text-xs font-medium px-2.5 py-1 rounded-full">Out of Stock</span>;
    if (Number(current) <= Number(reorder))
        return <span className="bg-yellow-100 text-yellow-700 text-xs font-medium px-2.5 py-1 rounded-full">Low Stock</span>;
    return <span className="bg-green-100 text-green-700 text-xs font-medium px-2.5 py-1 rounded-full">In Stock</span>;
}

// ── Main Page ──────────────────────────────────────────────────
export default function RawMaterialsPage() {
    const [materials, setMaterials] = useState([]);
    const [vendors, setVendors] = useState([]);
    const [filtered, setFiltered] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('all');
    const [showAdd, setShowAdd] = useState(false);
    const [showEdit, setShowEdit] = useState(false);
    const [showRestock, setShowRestock] = useState(false);
    const [selected, setSelected] = useState(null);
    const { can } = usePermissions();

    const emptyForm = {
        name: '', vendor_id: '', unit: 'piece',
        current_stock: '', reorder_level: '', cost_per_unit: '', remarks: ''
    };
    const [form, setForm] = useState(emptyForm);

    const [restockForm, setRestockForm] = useState({ quantity: '', cost_per_unit: '', reference: '', notes: '' });

    // ── Restock Logic ──
    const handleRestock = async () => {
        if (!restockForm.quantity) return toast.error('Quantity is required');
        try {
            await addInventoryMovement({
                type: 'IN',
                item_type: 'raw_material',
                item_id: selected.material_id,
                quantity: restockForm.quantity,
                unit: selected.unit,
                unit_price: restockForm.cost_per_unit,
                new_unit_price: restockForm.cost_per_unit,
                reference: restockForm.reference,
                notes: restockForm.notes
            });
            toast.success(`✅ Stock updated! New balance: ${Number(selected.current_stock) + Number(restockForm.quantity)}`);
            setShowRestock(false);
            setRestockForm({ quantity: '', cost_per_unit: '', reference: '', notes: '' });
            fetchData();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to restock');
        }
    };

    const openRestock = (material) => {
        setSelected(material);
        setRestockForm({
            quantity: '',
            cost_per_unit: material.cost_per_unit || '',
            reference: '',
            notes: ''
        });
        setShowRestock(true);
    };

    // ── Fetch ────────────────────────────────────────────────────
    const fetchData = async () => {
        try {
            const [mRes, vRes] = await Promise.all([
                getRawMaterials(),
                getVendors(),
            ]);
            setMaterials(mRes.data);
            setFiltered(mRes.data);
            setVendors(vRes.data);
        } catch (err) {
            toast.error('Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    // ── Search & Filter ──────────────────────────────────────────
    useEffect(() => {
        let list = [...materials];
        const q = search.toLowerCase();
        if (q) list = list.filter(m => m.name.toLowerCase().includes(q));
        if (filter === 'low') list = list.filter(m => Number(m.current_stock) <= Number(m.reorder_level) && Number(m.current_stock) > 0);
        if (filter === 'out') list = list.filter(m => Number(m.current_stock) <= 0);
        if (filter === 'ok') list = list.filter(m => Number(m.current_stock) > Number(m.reorder_level));
        setFiltered(list);
    }, [search, filter, materials]);

    // ── Add ──────────────────────────────────────────────────────
    const handleAdd = async () => {
        if (!form.name) return toast.error('Name is required');
        try {
            await createRawMaterial(form);
            toast.success('✅ Raw material added!');
            setShowAdd(false);
            setForm(emptyForm);
            fetchData();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to add material');
        }
    };

    // ── Edit ─────────────────────────────────────────────────────
    const handleEdit = async () => {
        if (!form.name) return toast.error('Name is required');
        try {
            await updateRawMaterial(selected.material_id, form);
            toast.success('✅ Material updated!');
            setShowEdit(false);
            setSelected(null);
            setForm(emptyForm);
            fetchData();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to update material');
        }
    };

    const openEdit = (material) => {
        setSelected(material);
        setForm({
            name: material.name,
            vendor_id: material.vendor_id || '',
            unit: material.unit || 'piece',
            current_stock: material.current_stock || '',
            reorder_level: material.reorder_level || '',
            cost_per_unit: material.cost_per_unit || '',
            remarks: material.remarks || '',
        });
        setShowEdit(true);
    };

    // ── Summary ──────────────────────────────────────────────────
    const totalValue = materials.reduce((s, m) => s + Number(m.current_stock) * Number(m.cost_per_unit || 0), 0);
    const lowCount = materials.filter(m => Number(m.current_stock) <= Number(m.reorder_level) && Number(m.current_stock) > 0).length;
    const outCount = materials.filter(m => Number(m.current_stock) <= 0).length;

    const vendorOptions = vendors.map(v => ({ value: v.vendor_id, label: v.name }));
    const unitOptions = [
        { value: 'piece', label: 'Piece' },
        { value: 'bag', label: 'Bag' },
        { value: 'ton', label: 'Ton' },
        { value: 'kg', label: 'KG' },
        { value: 'liter', label: 'Liter' },
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
                    <h1 className="text-2xl font-bold text-gray-800">Raw Materials</h1>
                    <p className="text-gray-400 text-sm mt-1">Manage input materials and packaging stock</p>
                </div>
                {can('rawmaterials', 'add') && (
                    <button
                        onClick={() => { setForm(emptyForm); setShowAdd(true); }}
                        className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors shadow-sm"
                    >
                        <Plus size={18} />
                        Add Material
                    </button>
                )}
            </div>

            {/* ── Stat Cards ── */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 rounded-2xl p-5 border border-white shadow-sm">
                    <p className="text-3xl font-bold text-gray-800">{materials.length}</p>
                    <p className="text-sm font-medium text-gray-600 mt-1">Total Materials</p>
                    <p className="text-xs text-blue-600 mt-1">In catalogue</p>
                </div>
                <div className="bg-green-50 rounded-2xl p-5 border border-white shadow-sm">
                    <p className="text-3xl font-bold text-gray-800">
                        Rs {totalValue.toLocaleString()}
                    </p>
                    <p className="text-sm font-medium text-gray-600 mt-1">Stock Value</p>
                    <p className="text-xs text-green-600 mt-1">At cost price</p>
                </div>
                <div className="bg-yellow-50 rounded-2xl p-5 border border-white shadow-sm">
                    <p className="text-3xl font-bold text-gray-800">{lowCount}</p>
                    <p className="text-sm font-medium text-gray-600 mt-1">Low Stock</p>
                    <p className="text-xs text-yellow-600 mt-1">Need reordering</p>
                </div>
                <div className="bg-red-50 rounded-2xl p-5 border border-white shadow-sm">
                    <p className="text-3xl font-bold text-gray-800">{outCount}</p>
                    <p className="text-sm font-medium text-gray-600 mt-1">Out of Stock</p>
                    <p className="text-xs text-red-600 mt-1">Urgent attention</p>
                </div>
            </div>

            {/* ── Search & Filter ── */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                <div className="flex flex-col md:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search materials..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        />
                    </div>
                    <div className="flex gap-2">
                        {['all', 'ok', 'low', 'out'].map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${filter === f
                                    ? 'bg-green-500 text-white'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                            >
                                {f === 'all' ? 'All' : f === 'ok' ? 'In Stock' : f === 'low' ? 'Low Stock' : 'Out of Stock'}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Table ── */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-100">
                                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Material</th>
                                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Vendor</th>
                                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Unit</th>
                                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Stock</th>
                                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Reorder At</th>
                                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Cost/Unit</th>
                                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Status</th>
                                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {filtered.map(material => (
                                <tr key={material.material_id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${Number(material.current_stock) <= Number(material.reorder_level)
                                                ? 'bg-red-50' : 'bg-orange-50'
                                                }`}>
                                                <Warehouse size={16} className={
                                                    Number(material.current_stock) <= Number(material.reorder_level)
                                                        ? 'text-red-500' : 'text-orange-500'
                                                } />
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-gray-800">{material.name}</p>
                                                <p className="text-xs text-gray-400">{material.material_id}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {material.vendor_name ? (
                                            <div>
                                                <p className="text-sm text-gray-700">{material.vendor_name}</p>
                                                <p className="text-xs text-gray-400">{material.vendor_phone}</p>
                                            </div>
                                        ) : (
                                            <span className="text-gray-400 text-sm">—</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="bg-blue-50 text-blue-700 text-xs font-medium px-2.5 py-1 rounded-full">
                                            {material.unit}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div>
                                            <p className="text-sm font-bold text-gray-800">{Number(material.current_stock).toLocaleString()}</p>
                                            {/* Stock bar */}
                                            <div className="w-20 bg-gray-100 rounded-full h-1.5 mt-1">
                                                <div
                                                    className={`h-1.5 rounded-full ${Number(material.current_stock) <= 0 ? 'bg-red-500' :
                                                        Number(material.current_stock) <= Number(material.reorder_level) ? 'bg-yellow-500' : 'bg-green-500'
                                                        }`}
                                                    style={{
                                                        width: `${Math.min(
                                                            material.reorder_level > 0
                                                                ? (Number(material.current_stock) / (Number(material.reorder_level) * 3)) * 100
                                                                : 100,
                                                            100
                                                        )}%`
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-600">
                                        {Number(material.reorder_level).toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-600">
                                        Rs {Number(material.cost_per_unit || 0).toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4">
                                        <StockBadge
                                            current={material.current_stock}
                                            reorder={material.reorder_level}
                                        />
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex gap-2">
                                            {can('inventory', 'add') && (
                                                <button
                                                    onClick={() => openRestock(material)}
                                                    className="w-8 h-8 bg-orange-50 hover:bg-orange-100 text-orange-600 rounded-lg flex items-center justify-center transition-colors"
                                                    title="Restock / Add Quantity"
                                                >
                                                    <TrendingUp size={14} />
                                                </button>
                                            )}
                                            {can('rawmaterials', 'edit') && (
                                                <button
                                                    onClick={() => openEdit(material)}
                                                    className="w-8 h-8 bg-green-50 hover:bg-green-100 text-green-600 rounded-lg flex items-center justify-center transition-colors"
                                                    title="Edit material details"
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
                                    <td colSpan={8} className="px-6 py-12 text-center text-gray-400">
                                        <Warehouse size={40} className="mx-auto mb-3 opacity-30" />
                                        <p>No materials found</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── Add Modal ── */}
            {showAdd && (
                <Modal title="Add Raw Material" onClose={() => setShowAdd(false)}>
                    <Field label="Material Name" value={form.name} onChange={v => setForm({ ...form, name: v })} placeholder="e.g. 50kg Polyprop Bag" required />
                    <Field label="Vendor" value={form.vendor_id} onChange={v => setForm({ ...form, vendor_id: v })} options={vendorOptions} />
                    <Field label="Unit" value={form.unit} onChange={v => setForm({ ...form, unit: v })} options={unitOptions} />
                    <Field label="Current Stock" value={form.current_stock} onChange={v => setForm({ ...form, current_stock: v })} placeholder="e.g. 5000" type="number" />
                    <Field label="Reorder Level" value={form.reorder_level} onChange={v => setForm({ ...form, reorder_level: v })} placeholder="e.g. 500" type="number" />
                    <Field label="Cost Per Unit (Rs)" value={form.cost_per_unit} onChange={v => setForm({ ...form, cost_per_unit: v })} placeholder="e.g. 18" type="number" />
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
                            Add Material
                        </button>
                    </div>
                </Modal>
            )}

            {/* ── Edit Modal ── */}
            {showEdit && (
                <Modal title="Edit Raw Material" onClose={() => setShowEdit(false)}>
                    <Field label="Material Name" value={form.name} onChange={v => setForm({ ...form, name: v })} placeholder="e.g. 50kg Polyprop Bag" required />
                    <Field label="Vendor" value={form.vendor_id} onChange={v => setForm({ ...form, vendor_id: v })} options={vendorOptions} />
                    <Field label="Unit" value={form.unit} onChange={v => setForm({ ...form, unit: v })} options={unitOptions} />
                    <Field label="Current Stock" value={form.current_stock} onChange={v => setForm({ ...form, current_stock: v })} placeholder="e.g. 5000" type="number" />
                    <Field label="Reorder Level" value={form.reorder_level} onChange={v => setForm({ ...form, reorder_level: v })} placeholder="e.g. 500" type="number" />
                    <Field label="Cost Per Unit (Rs)" value={form.cost_per_unit} onChange={v => setForm({ ...form, cost_per_unit: v })} placeholder="e.g. 18" type="number" />
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

            {/* ── Restock Modal ── */}
            {showRestock && selected && (
                <Modal title={`Restock: ${selected.name}`} onClose={() => setShowRestock(false)}>
                    <div className="mb-4 bg-orange-50 rounded-xl p-4 border border-orange-100 flex items-center justify-between">
                        <div>
                            <p className="text-xs text-orange-600 font-bold uppercase tracking-wider">Current Stock</p>
                            <p className="text-xl font-bold text-gray-800">{selected.current_stock} {selected.unit}</p>
                        </div>
                        <Warehouse size={32} className="text-orange-200" />
                    </div>

                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Purchase Price (Per {selected.unit})
                        </label>
                        <input
                            type="number"
                            value={restockForm.cost_per_unit}
                            onChange={e => setRestockForm({ ...restockForm, cost_per_unit: e.target.value })}
                            placeholder="Current cost price"
                            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                        <p className="text-[10px] text-gray-400 mt-1">Changing this will update the master cost price for this material.</p>
                    </div>

                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Quantity to Add ({selected.unit}) <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="number"
                            value={restockForm.quantity}
                            onChange={e => setRestockForm({ ...restockForm, quantity: e.target.value })}
                            placeholder="e.g. 100"
                            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                    </div>

                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Reference / PO #</label>
                        <input
                            type="text"
                            value={restockForm.reference}
                            onChange={e => setRestockForm({ ...restockForm, reference: e.target.value })}
                            placeholder="e.g. PO-2024-001"
                            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                    </div>

                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                        <input
                            type="text"
                            value={restockForm.notes}
                            onChange={e => setRestockForm({ ...restockForm, notes: e.target.value })}
                            placeholder="Optional notes..."
                            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={() => setShowRestock(false)}
                            className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleRestock}
                            disabled={!restockForm.quantity}
                            className="flex-1 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
                        >
                            <Plus size={16} />
                            Update Stock
                        </button>
                    </div>
                </Modal>
            )}

        </div>
    );
}
