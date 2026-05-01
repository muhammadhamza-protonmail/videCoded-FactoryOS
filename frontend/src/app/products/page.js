'use client';
import { useEffect, useState } from 'react';
import { getProducts, createProduct, updateProduct, getRawMaterials } from '../../../lib/api';
import { Package, Plus, Search, Edit2, AlertTriangle, Check, X, TrendingUp, TrendingDown } from 'lucide-react';
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
    const pct = reorder > 0 ? (current / reorder) * 100 : 100;
    if (current <= 0)
        return <span className="bg-red-100 text-red-700 text-xs font-medium px-2.5 py-1 rounded-full">Out of Stock</span>;
    if (current <= reorder)
        return <span className="bg-yellow-100 text-yellow-700 text-xs font-medium px-2.5 py-1 rounded-full">Low Stock</span>;
    return <span className="bg-green-100 text-green-700 text-xs font-medium px-2.5 py-1 rounded-full">In Stock</span>;
}

// ── Main Page ──────────────────────────────────────────────────
export default function ProductsPage() {
    const [products, setProducts] = useState([]);
    const [filtered, setFiltered] = useState([]);
    const [materials, setMaterials] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('all');
    const [showAdd, setShowAdd] = useState(false);
    const [showEdit, setShowEdit] = useState(false);
    const [selected, setSelected] = useState(null);
    const { can } = usePermissions();

    const emptyForm = {
        name: '', unit: 'bag', sale_price: '',
        current_stock: '', reorder_level: '', 
        material_id: '', units_per_bag: '26',
        rm_ratio_qty: '1', product_ratio_qty: '26',
        status: 'active', remarks: ''
    };
    const [form, setForm] = useState(emptyForm);

    // ── Fetch ────────────────────────────────────────────────────
    const fetchProducts = async () => {
        try {
            const [pRes, mRes] = await Promise.all([
                getProducts(),
                getRawMaterials(),
            ]);
            setProducts(pRes.data);
            setFiltered(pRes.data);
            setMaterials(mRes.data);
        } catch (err) {
            toast.error('Failed to load products');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchProducts(); }, []);

    // ── Search & Filter ──────────────────────────────────────────
    useEffect(() => {
        let list = [...products];
        const q = search.toLowerCase();
        if (q) list = list.filter(p => p.name.toLowerCase().includes(q));
        if (filter === 'low') list = list.filter(p => Number(p.current_stock) <= Number(p.reorder_level) && Number(p.current_stock) > 0);
        if (filter === 'out') list = list.filter(p => Number(p.current_stock) <= 0);
        if (filter === 'ok') list = list.filter(p => Number(p.current_stock) > Number(p.reorder_level));
        setFiltered(list);
    }, [search, filter, products]);

    // ── Add ──────────────────────────────────────────────────────
    const handleAdd = async () => {
        if (!form.name) return toast.error('Name is required');
        if (!form.sale_price) return toast.error('Sale price is required');
        try {
            await createProduct(form);
            toast.success('✅ Product added!');
            setShowAdd(false);
            setForm(emptyForm);
            fetchProducts();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to add product');
        }
    };

    // ── Edit ─────────────────────────────────────────────────────
    const handleEdit = async () => {
        if (!form.name) return toast.error('Name is required');
        try {
            await updateProduct(selected.product_id, form);
            toast.success('✅ Product updated!');
            setShowEdit(false);
            setSelected(null);
            setForm(emptyForm);
            fetchProducts();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to update product');
        }
    };

    const openEdit = (product) => {
        setSelected(product);
        setForm({
            name: product.name,
            unit: product.unit || 'bag',
            sale_price: product.sale_price || '',
            current_stock: product.current_stock || '',
            reorder_level: product.reorder_level || '',
            material_id: product.material_id || '',
            units_per_bag: product.units_per_bag || '26',
            rm_ratio_qty: product.rm_ratio_qty || '1',
            product_ratio_qty: product.product_ratio_qty || '26',
            status: product.status || 'active',
            remarks: product.remarks || '',
        });
        setShowEdit(true);
    };

    // ── Summary ──────────────────────────────────────────────────
    const totalValue = products.reduce((s, p) => s + Number(p.current_stock) * Number(p.sale_price), 0);
    const lowStockCount = products.filter(p => Number(p.current_stock) <= Number(p.reorder_level) && Number(p.current_stock) > 0).length;
    const outOfStock = products.filter(p => Number(p.current_stock) <= 0).length;

    const unitOptions = [
        { value: 'bag', label: 'Bag' },
        { value: 'pack', label: 'Pack' },
        { value: 'ton', label: 'Ton' },
        { value: 'kg', label: 'KG' },
        { value: 'piece', label: 'Piece' },
    ];

    const statusOptions = [
        { value: 'active', label: 'Active' },
        { value: 'inactive', label: 'Inactive' },
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
                    <h1 className="text-2xl font-bold text-gray-800">Products</h1>
                    <p className="text-gray-400 text-sm mt-1">Manage finished goods and stock levels</p>
                </div>
                {can('products', 'add') && (
                    <button
                        onClick={() => { setForm(emptyForm); setShowAdd(true); }}
                        className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors shadow-sm"
                    >
                        <Plus size={18} />
                        Add Product
                    </button>
                )}
            </div>

            {/* ── Stat Cards ── */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 rounded-2xl p-5 border border-white shadow-sm">
                    <p className="text-3xl font-bold text-gray-800">{products.length}</p>
                    <p className="text-sm font-medium text-gray-600 mt-1">Total Products</p>
                    <p className="text-xs text-blue-600 mt-1">In catalogue</p>
                </div>
                <div className="bg-green-50 rounded-2xl p-5 border border-white shadow-sm">
                    <p className="text-3xl font-bold text-gray-800">
                        Rs {totalValue.toLocaleString()}
                    </p>
                    <p className="text-sm font-medium text-gray-600 mt-1">Stock Value</p>
                    <p className="text-xs text-green-600 mt-1">At sale price</p>
                </div>
                <div className="bg-yellow-50 rounded-2xl p-5 border border-white shadow-sm">
                    <p className="text-3xl font-bold text-gray-800">{lowStockCount}</p>
                    <p className="text-sm font-medium text-gray-600 mt-1">Low Stock</p>
                    <p className="text-xs text-yellow-600 mt-1">Need restocking</p>
                </div>
                <div className="bg-red-50 rounded-2xl p-5 border border-white shadow-sm">
                    <p className="text-3xl font-bold text-gray-800">{outOfStock}</p>
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
                            placeholder="Search products..."
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

            {/* ── Products Grid ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filtered.map(product => {
                    const stockPct = product.reorder_level > 0
                        ? Math.min((Number(product.current_stock) / (Number(product.reorder_level) * 3)) * 100, 100)
                        : 100;
                    const isLow = Number(product.current_stock) <= Number(product.reorder_level);

                    return (
                        <div key={product.product_id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">

                            {/* Card Header */}
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${isLow ? 'bg-red-50' : 'bg-green-50'
                                        }`}>
                                        <Package size={22} className={isLow ? 'text-red-500' : 'text-green-500'} />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-800 text-sm leading-tight">{product.name}</h3>
                                        <p className="text-xs text-gray-400 mt-0.5">{product.product_id} · {product.unit}</p>
                                    </div>
                                </div>
                                <StockBadge current={Number(product.current_stock)} reorder={Number(product.reorder_level)} />
                            </div>

                            {/* Stats Row */}
                            <div className="grid grid-cols-3 gap-3 mb-4">
                                <div className="text-center">
                                    <p className="text-lg font-bold text-gray-800">{product.current_stock}</p>
                                    <p className="text-xs text-gray-400">In Stock</p>
                                </div>
                                <div className="text-center border-x border-gray-100">
                                    <p className="text-lg font-bold text-gray-800">{product.reorder_level}</p>
                                    <p className="text-xs text-gray-400">Reorder At</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-lg font-bold text-green-600">
                                        {Number(product.sale_price).toLocaleString()}
                                    </p>
                                    <p className="text-xs text-gray-400">Sale Price</p>
                                </div>
                            </div>

                            {/* Stock Progress Bar */}
                            <div className="mb-4">
                                <div className="flex justify-between text-xs text-gray-400 mb-1">
                                    <span>Stock Level</span>
                                    <span>{Math.round(stockPct)}%</span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-2">
                                    <div
                                        className={`h-2 rounded-full transition-all ${stockPct < 30 ? 'bg-red-500' :
                                            stockPct < 60 ? 'bg-yellow-500' : 'bg-green-500'
                                            }`}
                                        style={{ width: `${stockPct}%` }}
                                    />
                                </div>
                            </div>

                            {/* Stock Value */}
                            <div className="flex items-center justify-between mb-4 bg-gray-50 rounded-xl p-3">
                                <span className="text-xs text-gray-500">Stock Value</span>
                                <span className="text-sm font-semibold text-gray-800">
                                    Rs {(Number(product.current_stock) * Number(product.sale_price)).toLocaleString()}
                                </span>
                            </div>

                            {/* Actions */}
                            {can('products', 'edit') && (
                                <button
                                    onClick={() => openEdit(product)}
                                    className="w-full flex items-center justify-center gap-2 border border-gray-200 text-gray-600 hover:bg-green-50 hover:border-green-300 hover:text-green-600 py-2 rounded-xl text-sm font-medium transition-all"
                                >
                                    <Edit2 size={14} />
                                    Edit Product
                                </button>
                            )}
                        </div>
                    );
                })}

                {filtered.length === 0 && (
                    <div className="col-span-3 text-center py-12 text-gray-400">
                        <Package size={48} className="mx-auto mb-3 opacity-30" />
                        <p>No products found</p>
                    </div>
                )}
            </div>

            {/* ── Add Modal ── */}
            {showAdd && (
                <Modal title="Add New Product" onClose={() => setShowAdd(false)}>
                    <Field label="Product Name" value={form.name} onChange={v => setForm({ ...form, name: v })} placeholder="e.g. Wheat Flour 50kg Bag" required />
                    <Field label="Unit" value={form.unit} onChange={v => setForm({ ...form, unit: v })} options={unitOptions} />
                    <Field label="Sale Price (Rs)" value={form.sale_price} onChange={v => setForm({ ...form, sale_price: v })} placeholder="e.g. 2800" type="number" required />
                    <Field label="Current Stock" value={form.current_stock} onChange={v => setForm({ ...form, current_stock: v })} placeholder="e.g. 320" type="number" />
                    <Field label="Reorder Level" value={form.reorder_level} onChange={v => setForm({ ...form, reorder_level: v })} placeholder="e.g. 50" type="number" />
                    <Field 
                        label="Raw Material" 
                        value={form.material_id} 
                        onChange={v => setForm({ ...form, material_id: v })} 
                        options={[
                            { value: '', label: '-- Select Material --' },
                            ...materials.map(m => ({ value: m.material_id, label: m.name }))
                        ]} 
                    />
                    <div className="grid grid-cols-2 gap-3 mb-4">
                        <Field 
                            label={`Qty Produced (${form.unit})`}
                            value={form.product_ratio_qty} 
                            onChange={v => setForm({ ...form, product_ratio_qty: v, units_per_bag: v / (form.rm_ratio_qty || 1) })} 
                            placeholder="e.g. 1200" 
                            type="number" 
                            required 
                        />
                        <Field 
                            label={`From RM Qty (${materials.find(m => m.material_id === form.material_id)?.unit || 'unit'})`} 
                            value={form.rm_ratio_qty} 
                            onChange={v => setForm({ ...form, rm_ratio_qty: v, units_per_bag: (form.product_ratio_qty || 1) / v })} 
                            placeholder="e.g. 50" 
                            type="number" 
                            required 
                        />
                    </div>
                    <p className="text-xs text-gray-400 -mt-2 mb-4 italic">
                        Ratio: {Number(form.product_ratio_qty || 0).toLocaleString()} {form.unit} per {Number(form.rm_ratio_qty || 0).toLocaleString()} {materials.find(m => m.material_id === form.material_id)?.unit || 'unit'}
                    </p>
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
                            Add Product
                        </button>
                    </div>
                </Modal>
            )}

            {/* ── Edit Modal ── */}
            {showEdit && (
                <Modal title="Edit Product" onClose={() => setShowEdit(false)}>
                    <Field label="Product Name" value={form.name} onChange={v => setForm({ ...form, name: v })} placeholder="e.g. Wheat Flour 50kg Bag" required />
                    <Field label="Unit" value={form.unit} onChange={v => setForm({ ...form, unit: v })} options={unitOptions} />
                    <Field label="Sale Price (Rs)" value={form.sale_price} onChange={v => setForm({ ...form, sale_price: v })} placeholder="e.g. 2800" type="number" required />
                    <Field label="Current Stock" value={form.current_stock} onChange={v => setForm({ ...form, current_stock: v })} placeholder="e.g. 320" type="number" />
                    <Field label="Reorder Level" value={form.reorder_level} onChange={v => setForm({ ...form, reorder_level: v })} placeholder="e.g. 50" type="number" />
                    <Field 
                        label="Raw Material" 
                        value={form.material_id} 
                        onChange={v => setForm({ ...form, material_id: v })} 
                        options={[
                            { value: '', label: '-- Select Material --' },
                            ...materials.map(m => ({ value: m.material_id, label: m.name }))
                        ]} 
                    />
                    <div className="grid grid-cols-2 gap-3 mb-4">
                        <Field 
                            label={`Qty Produced (${form.unit})`}
                            value={form.product_ratio_qty} 
                            onChange={v => setForm({ ...form, product_ratio_qty: v, units_per_bag: v / (form.rm_ratio_qty || 1) })} 
                            placeholder="e.g. 1200" 
                            type="number" 
                            required 
                        />
                        <Field 
                            label={`From RM Qty (${materials.find(m => m.material_id === form.material_id)?.unit || 'unit'})`} 
                            value={form.rm_ratio_qty} 
                            onChange={v => setForm({ ...form, rm_ratio_qty: v, units_per_bag: (form.product_ratio_qty || 1) / v })} 
                            placeholder="e.g. 50" 
                            type="number" 
                            required 
                        />
                    </div>
                    <p className="text-xs text-gray-400 -mt-2 mb-4 italic">
                        Ratio: {Number(form.product_ratio_qty || 0).toLocaleString()} {form.unit} per {Number(form.rm_ratio_qty || 0).toLocaleString()} {materials.find(m => m.material_id === form.material_id)?.unit || 'unit'}
                    </p>
                    <Field label="Status" value={form.status} onChange={v => setForm({ ...form, status: v })} options={statusOptions} />
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