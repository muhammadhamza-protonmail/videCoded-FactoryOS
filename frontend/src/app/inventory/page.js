'use client';
import { useEffect, useState } from 'react';
import {
    getInventorySummary, getInventoryMovements, addInventoryMovement,
    getProducts, getRawMaterials
} from '../../../lib/api';
import {
    TrendingUp, TrendingDown, Plus, Search,
    Check, X, Package, Warehouse, AlertTriangle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { usePermissions } from '../../../hooks/usePermissions';

// ── Modal ──────────────────────────────────────────────────────
function Modal({ title, onClose, children }) {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-6 border-b border-gray-100 sticky top-0 bg-white">
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

// ── Type Badge ─────────────────────────────────────────────────
function TypeBadge({ type }) {
    return (
        <span className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full w-fit ${type === 'IN'
            ? 'bg-green-100 text-green-700'
            : 'bg-red-100 text-red-700'
            }`}>
            {type === 'IN'
                ? <><TrendingUp size={11} /> Stock In</>
                : <><TrendingDown size={11} /> Stock Out</>
            }
        </span>
    );
}

// ── Stock Status Badge ─────────────────────────────────────────
function StockStatus({ status }) {
    const styles = {
        ok: 'bg-green-100 text-green-700',
        low_stock: 'bg-yellow-100 text-yellow-700',
        out_of_stock: 'bg-red-100 text-red-700',
    };
    const labels = {
        ok: '✅ In Stock',
        low_stock: '⚠️ Low Stock',
        out_of_stock: '❌ Out of Stock',
    };
    return (
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${styles[status] || 'bg-gray-100 text-gray-600'}`}>
            {labels[status] || status}
        </span>
    );
}

// ── Main Page ──────────────────────────────────────────────────
export default function InventoryPage() {
    const [summary, setSummary] = useState(null);
    const [movements, setMovements] = useState([]);
    const [filtered, setFiltered] = useState([]);
    const [products, setProducts] = useState([]);
    const [materials, setMaterials] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [activeTab, setActiveTab] = useState('overview');
    const [typeFilter, setTypeFilter] = useState('all');
    const [showAdd, setShowAdd] = useState(false);
    const { can } = usePermissions();

    const today = new Date().toISOString().split('T')[0];

    const emptyForm = {
        date: today, type: 'IN', item_type: 'product',
        item_id: '', quantity: '', unit: 'bag',
        reference: '', notes: '', unit_price: ''
    };
    const [form, setForm] = useState(emptyForm);

    // ── Fetch ────────────────────────────────────────────────────
    const fetchData = async () => {
        try {
            const [sRes, mRes, pRes, rmRes] = await Promise.all([
                getInventorySummary(),
                getInventoryMovements(),
                getProducts(),
                getRawMaterials(),
            ]);
            setSummary(sRes.data);
            setMovements(mRes.data);
            setFiltered(mRes.data);
            setProducts(pRes.data);
            setMaterials(rmRes.data);
        } catch (err) {
            toast.error('Failed to load inventory data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    // ── Search & Filter ──────────────────────────────────────────
    useEffect(() => {
        let list = [...movements];
        const q = search.toLowerCase();
        if (q) list = list.filter(m =>
            m.item_id.toLowerCase().includes(q) ||
            (m.reference && m.reference.toLowerCase().includes(q)) ||
            (m.notes && m.notes.toLowerCase().includes(q))
        );
        if (typeFilter !== 'all') list = list.filter(m => m.type === typeFilter);
        setFiltered(list);
    }, [search, typeFilter, movements]);

    // ── Add Movement ──────────────────────────────────────────────
    const handleAdd = async () => {
        if (!form.item_id) return toast.error('Please select an item');
        if (!form.quantity) return toast.error('Quantity is required');
        try {
            await addInventoryMovement(form);
            toast.success(`✅ Stock ${form.type === 'IN' ? 'added' : 'deducted'} successfully!`);
            setShowAdd(false);
            setForm(emptyForm);
            fetchData();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to add movement');
        }
    };

    // ── Item options based on type ────────────────────────────────
    const itemOptions = form.item_type === 'product'
        ? products.map(p => ({ value: p.product_id, label: ` (Stock: )`, unit: p.unit }))
        : materials.map(m => ({ value: m.material_id, label: ` (Stock: )`, unit: m.unit }));

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
                    <h1 className="text-2xl font-bold text-gray-800">Inventory</h1>
                    <p className="text-gray-400 text-sm mt-1">Stock levels, movements and alerts</p>
                </div>
                {can('inventory', 'add') && (
                    <button
                        onClick={() => { setForm(emptyForm); setShowAdd(true); }}
                        className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors shadow-sm"
                    >
                        <Plus size={18} />
                        Add Movement
                    </button>
                )}
            </div>

            {/* ── Summary Cards ── */}
            {summary && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-blue-50 rounded-2xl p-5 border border-white shadow-sm">
                        <p className="text-2xl font-bold text-gray-800">
                            Rs {Number(summary.summary.total_stock_value || 0).toLocaleString()}
                        </p>
                        <p className="text-sm font-medium text-gray-600 mt-1">Total Stock Value</p>
                        <p className="text-xs text-blue-600 mt-1">Products + Materials</p>
                    </div>
                    <div className="bg-green-50 rounded-2xl p-5 border border-white shadow-sm">
                        <p className="text-2xl font-bold text-gray-800">
                            Rs {Number(summary.summary.total_product_value || 0).toLocaleString()}
                        </p>
                        <p className="text-sm font-medium text-gray-600 mt-1">Products Value</p>
                        <p className="text-xs text-green-600 mt-1">{summary.summary.total_products} products</p>
                    </div>
                    <div className="bg-orange-50 rounded-2xl p-5 border border-white shadow-sm">
                        <p className="text-2xl font-bold text-gray-800">
                            Rs {Number(summary.summary.total_material_value || 0).toLocaleString()}
                        </p>
                        <p className="text-sm font-medium text-gray-600 mt-1">Materials Value</p>
                        <p className="text-xs text-orange-600 mt-1">{summary.summary.total_materials} materials</p>
                    </div>
                    <div className="bg-red-50 rounded-2xl p-5 border border-white shadow-sm">
                        <p className="text-2xl font-bold text-gray-800">
                            {Number(summary.summary.low_stock_products || 0) + Number(summary.summary.low_stock_materials || 0)}
                        </p>
                        <p className="text-sm font-medium text-gray-600 mt-1">Low Stock Alerts</p>
                        <p className="text-xs text-red-600 mt-1">Need restocking</p>
                    </div>
                </div>
            )}

            {/* ── Tabs ── */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-1 flex gap-1 w-fit">
                {['overview', 'products', 'materials', 'movements'].map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors capitalize ${activeTab === tab
                            ? 'bg-green-500 text-white'
                            : 'text-gray-600 hover:bg-gray-100'
                            }`}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {/* ── Overview Tab ── */}
            {activeTab === 'overview' && summary && (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

                    {/* Low Stock Products */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <AlertTriangle size={18} className="text-yellow-500" />
                            <h3 className="font-semibold text-gray-800">Low Stock Products</h3>
                        </div>
                        <div className="space-y-3">
                            {summary.products.filter(p => p.stock_status !== 'ok').map(p => (
                                <div key={p.product_id} className="flex items-center justify-between py-2 border-b border-gray-50">
                                    <div>
                                        <p className="text-sm font-medium text-gray-700">{p.name}</p>
                                        <p className="text-xs text-gray-400">
                                            Stock: {p.current_stock} · Reorder: {p.reorder_level}
                                        </p>
                                    </div>
                                    <StockStatus status={p.stock_status} />
                                </div>
                            ))}
                            {summary.products.filter(p => p.stock_status !== 'ok').length === 0 && (
                                <p className="text-sm text-green-600 text-center py-4">✅ All products well stocked</p>
                            )}
                        </div>
                    </div>

                    {/* Low Stock Materials */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <AlertTriangle size={18} className="text-orange-500" />
                            <h3 className="font-semibold text-gray-800">Low Stock Materials</h3>
                        </div>
                        <div className="space-y-3">
                            {summary.materials.filter(m => m.stock_status !== 'ok').map(m => (
                                <div key={m.material_id} className="flex items-center justify-between py-2 border-b border-gray-50">
                                    <div>
                                        <p className="text-sm font-medium text-gray-700">{m.name}</p>
                                        <p className="text-xs text-gray-400">
                                            Stock: {m.current_stock} · Reorder: {m.reorder_level}
                                            {m.vendor_name && ` · ${m.vendor_name}`}
                                        </p>
                                    </div>
                                    <StockStatus status={m.stock_status} />
                                </div>
                            ))}
                            {summary.materials.filter(m => m.stock_status !== 'ok').length === 0 && (
                                <p className="text-sm text-green-600 text-center py-4">✅ All materials well stocked</p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Products Tab ── */}
            {activeTab === 'products' && summary && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-100">
                                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Product</th>
                                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Unit</th>
                                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Stock</th>
                                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Reorder At</th>
                                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Sale Price</th>
                                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Stock Value</th>
                                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {summary.products.map(p => (
                                    <tr key={p.product_id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center">
                                                    <Package size={14} className="text-green-500" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-gray-800">{p.name}</p>
                                                    <p className="text-xs text-gray-400">{p.product_id}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-600">{p.unit}</td>
                                        <td className="px-6 py-4">
                                            <p className="text-sm font-bold text-gray-800">{Number(p.current_stock).toLocaleString()}</p>
                                            <div className="w-16 bg-gray-100 rounded-full h-1.5 mt-1">
                                                <div
                                                    className={`h-1.5 rounded-full ${p.stock_status === 'out_of_stock' ? 'bg-red-500' :
                                                        p.stock_status === 'low_stock' ? 'bg-yellow-500' : 'bg-green-500'
                                                        }`}
                                                    style={{ width: `${Math.min(p.reorder_level > 0 ? (p.current_stock / (p.reorder_level * 3)) * 100 : 100, 100)}%` }}
                                                />
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-600">{p.reorder_level}</td>
                                        <td className="px-6 py-4 text-sm text-gray-600">Rs {Number(p.sale_price).toLocaleString()}</td>
                                        <td className="px-6 py-4 text-sm font-semibold text-green-600">
                                            Rs {Number(p.stock_value || 0).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4"><StockStatus status={p.stock_status} /></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ── Materials Tab ── */}
            {activeTab === 'materials' && summary && (
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
                                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Stock Value</th>
                                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {summary.materials.map(m => (
                                    <tr key={m.material_id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 bg-orange-50 rounded-lg flex items-center justify-center">
                                                    <Warehouse size={14} className="text-orange-500" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-gray-800">{m.name}</p>
                                                    <p className="text-xs text-gray-400">{m.material_id}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-600">{m.vendor_name || '—'}</td>
                                        <td className="px-6 py-4 text-sm text-gray-600">{m.unit}</td>
                                        <td className="px-6 py-4">
                                            <p className="text-sm font-bold text-gray-800">{Number(m.current_stock).toLocaleString()}</p>
                                            <div className="w-16 bg-gray-100 rounded-full h-1.5 mt-1">
                                                <div
                                                    className={`h-1.5 rounded-full ${m.stock_status === 'out_of_stock' ? 'bg-red-500' :
                                                        m.stock_status === 'low_stock' ? 'bg-yellow-500' : 'bg-green-500'
                                                        }`}
                                                    style={{ width: `${Math.min(m.reorder_level > 0 ? (m.current_stock / (m.reorder_level * 3)) * 100 : 100, 100)}%` }}
                                                />
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-600">{m.reorder_level}</td>
                                        <td className="px-6 py-4 text-sm text-gray-600">Rs {Number(m.cost_per_unit || 0).toLocaleString()}</td>
                                        <td className="px-6 py-4 text-sm font-semibold text-orange-600">
                                            Rs {Number(m.stock_value || 0).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4"><StockStatus status={m.stock_status} /></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ── Movements Tab ── */}
            {activeTab === 'movements' && (
                <div className="space-y-4">
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                        <div className="flex flex-col md:flex-row gap-3">
                            <div className="relative flex-1">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search movements..."
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                                />
                            </div>
                            <div className="flex gap-2">
                                {['all', 'IN', 'OUT'].map(t => (
                                    <button
                                        key={t}
                                        onClick={() => setTypeFilter(t)}
                                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${typeFilter === t
                                            ? 'bg-green-500 text-white'
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                            }`}
                                    >
                                        {t === 'all' ? 'All' : t === 'IN' ? '📥 Stock In' : '📤 Stock Out'}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-100">
                                        <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">ID</th>
                                        <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Date</th>
                                        <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Type</th>
                                        <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Item Type</th>
                                        <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Item ID</th>
                                        <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Quantity</th>
                                        <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Reference</th>
                                        <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Notes</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {filtered.map(mv => (
                                        <tr key={mv.movement_id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 text-sm font-medium text-gray-700">{mv.movement_id}</td>
                                            <td className="px-6 py-4 text-sm text-gray-600">
                                                {new Date(mv.date).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })}
                                            </td>
                                            <td className="px-6 py-4"><TypeBadge type={mv.type} /></td>
                                            <td className="px-6 py-4">
                                                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${mv.item_type === 'product'
                                                    ? 'bg-green-100 text-green-700'
                                                    : 'bg-orange-100 text-orange-700'
                                                    }`}>
                                                    {mv.item_type === 'product' ? '📦 Product' : '🏭 Material'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600">{mv.item_id}</td>
                                            <td className="px-6 py-4">
                                                <span className={`text-sm font-bold ${mv.type === 'IN' ? 'text-green-600' : 'text-red-600'}`}>
                                                    {mv.type === 'IN' ? '+' : '-'}{Number(mv.quantity).toLocaleString()} {mv.unit}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600">{mv.reference || '—'}</td>
                                            <td className="px-6 py-4 text-sm text-gray-500">{mv.notes || '—'}</td>
                                        </tr>
                                    ))}
                                    {filtered.length === 0 && (
                                        <tr>
                                            <td colSpan={8} className="px-6 py-12 text-center text-gray-400">
                                                <TrendingUp size={40} className="mx-auto mb-3 opacity-30" />
                                                <p>No movements found</p>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Add Movement Modal ── */}
            {showAdd && (
                <Modal title="Add Stock Movement" onClose={() => setShowAdd(false)}>

                    {/* IN / OUT Toggle */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Movement Type</label>
                        <div className="grid grid-cols-2 gap-2">
                            {['IN', 'OUT'].map(t => (
                                <button
                                    key={t}
                                    onClick={() => setForm({ ...form, type: t })}
                                    className={`py-3 rounded-xl text-sm font-medium transition-all border-2 ${form.type === t
                                        ? t === 'IN'
                                            ? 'bg-green-500 text-white border-green-500'
                                            : 'bg-red-500 text-white border-red-500'
                                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                                        }`}
                                >
                                    {t === 'IN' ? '📥 Stock In' : '📤 Stock Out'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Product / Material Toggle */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Item Type</label>
                        <div className="grid grid-cols-2 gap-2">
                            {['product', 'raw_material'].map(t => (
                                <button
                                    key={t}
                                    onClick={() => setForm({ ...form, item_type: t, item_id: '' })}
                                    className={`py-2.5 rounded-xl text-sm font-medium transition-all border-2 ${form.item_type === t
                                        ? 'bg-blue-500 text-white border-blue-500'
                                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                                        }`}
                                >
                                    {t === 'product' ? '📦 Product' : '🏭 Raw Material'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Item Select */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Select Item <span className="text-red-500">*</span>
                        </label>
                        <select
                            value={form.item_id}
                            onChange={e => { const selectedId = e.target.value; const selectedItem = itemOptions.find(o => o.value === selectedId); setForm({ ...form, item_id: selectedId, unit: selectedItem ? selectedItem.unit : '' }); }} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                        >
                            <option value="">-- Select --</option>
                            {itemOptions.map(o => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                        </select>
                    </div>

                    {/* Quantity & Unit */}
                    <div className="grid grid-cols-2 gap-3 mb-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Quantity <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="number"
                                value={form.quantity}
                                onChange={e => setForm({ ...form, quantity: e.target.value })}
                                placeholder="e.g. 100"
                                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                            <input type="text" value={form.unit} readOnly disabled className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-gray-50 text-gray-500 cursor-not-allowed" />
                        </div>
                    </div>

                    {form.type === 'IN' && (
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                {form.item_type === 'raw_material' ? 'Purchase Price Per Unit' : 'Latest Price Per Unit'}
                            </label>
                            <input
                                type="number"
                                value={form.unit_price}
                                onChange={e => setForm({ ...form, unit_price: e.target.value })}
                                placeholder="e.g. 150"
                                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                            />
                            <p className="text-[10px] text-gray-400 mt-1">
                                This amount will be saved with the movement and also update the latest master price for this item.
                            </p>
                        </div>
                    )}

                    {/* Date */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                        <input
                            type="date"
                            value={form.date}
                            onChange={e => setForm({ ...form, date: e.target.value })}
                            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                    </div>

                    {/* Reference & Notes */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Reference</label>
                        <input
                            type="text"
                            value={form.reference}
                            onChange={e => setForm({ ...form, reference: e.target.value })}
                            placeholder="e.g. PO-2026-001"
                            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                    </div>
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                        <input
                            type="text"
                            value={form.notes}
                            onChange={e => setForm({ ...form, notes: e.target.value })}
                            placeholder="Optional notes..."
                            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                    </div>

                    <div className="flex gap-3">
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
                            Add Movement
                        </button>
                    </div>
                </Modal>
            )}
        </div>
    );
}
