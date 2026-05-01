'use client';
import { useEffect, useState } from 'react';
import {
    getProductionLogs, createProductionLog,
    updateProductionLog, getProducts,
    getRawMaterials
} from '../../../lib/api';
import {
    Factory, Plus, Search, Edit2,
    Check, X, TrendingUp, Calendar
} from 'lucide-react';
import toast from 'react-hot-toast';
import { usePermissions } from '../../../hooks/usePermissions';

// ── Constants ──────────────────────────────────────────────────
const ELEC_COST_PER_UNIT = 30;    // Rs 30 per unit produced

// ── Modal ──────────────────────────────────────────────────────
function Modal({ title, onClose, children, wide }) {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
            <div className={`bg-white rounded-2xl shadow-2xl w-full ${wide ? 'max-w-2xl' : 'max-w-md'} max-h-[90vh] overflow-y-auto`}>
                <div className="flex items-center justify-between p-6 border-b border-gray-100 sticky top-0 bg-white z-10">
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

// ── Shift Badge ────────────────────────────────────────────────
function ShiftBadge({ shift }) {
    const styles = {
        Morning: 'bg-yellow-100 text-yellow-700',
        Evening: 'bg-blue-100 text-blue-700',
        Night: 'bg-purple-100 text-purple-700',
    };
    return (
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${styles[shift] || 'bg-gray-100 text-gray-700'}`}>
            {shift}
        </span>
    );
}

// ── Input Field ────────────────────────────────────────────────
function InputField({ label, type = 'text', value, onChange, placeholder, required, disabled, hint }) {
    return (
        <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">
                    {label} {required && <span className="text-red-500">*</span>}
                </label>
                {hint && <span className="text-xs text-blue-500">{hint}</span>}
            </div>
            <input
                type={type}
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder}
                disabled={disabled}
                className={`w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all
          ${disabled
                        ? 'bg-gray-50 border-gray-100 text-gray-500 cursor-not-allowed'
                        : 'border-gray-200 bg-white'
                    }`}
            />
        </div>
    );
}

// ── Main Page ──────────────────────────────────────────────────
export default function ProductionPage() {
    const [logs, setLogs] = useState([]);
    const [filtered, setFiltered] = useState([]);
    const [products, setProducts] = useState([]);
    const [materials, setMaterials] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showAdd, setShowAdd] = useState(false);
    const [showEdit, setShowEdit] = useState(false);
    const [showDetail, setShowDetail] = useState(false);
    const [selected, setSelected] = useState(null);
    const { can } = usePermissions();

    const today = new Date().toISOString().split('T')[0];

    const emptyForm = {
        date: today,
        shift: '',
        machine_id: 'MC01',
        product_id: '',
        material_id: '',
        units_produced: '',
        bags_consumed: '',
        mat_cost: '',
        elec_units: '',
        elec_cost: '',
        shift_expense: '0',
        other_expense: '0',
        total_sale_value: '',
        remarks: '',
    };
    const [form, setForm] = useState(emptyForm);

    // ── Fetch ────────────────────────────────────────────────────
    const fetchData = async () => {
        try {
            const [lRes, pRes, mRes] = await Promise.all([
                getProductionLogs(),
                getProducts(),
                getRawMaterials(),
            ]);
            setLogs(lRes.data);
            setFiltered(lRes.data);
            setProducts(pRes.data);
            setMaterials(mRes.data);
        } catch (err) {
            toast.error('Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    // ── Search ───────────────────────────────────────────────────
    useEffect(() => {
        const q = search.toLowerCase();
        setFiltered(logs.filter(l =>
            (l.product_name && l.product_name.toLowerCase().includes(q)) ||
            (l.machine_name && l.machine_name.toLowerCase().includes(q)) ||
            l.shift.toLowerCase().includes(q)
        ));
    }, [search, logs]);

    // ── Auto Calculations when units change ──────────────────────
    const recalculate = (updatedForm) => {
        const units = Number(updatedForm.units_produced || 0);
        const product = products.find(p => p.product_id === updatedForm.product_id);
        const material = materials.find(m => m.material_id === updatedForm.material_id);

        // Ratio = product_ratio_qty / rm_ratio_qty
        const productRatio = Number(product?.product_ratio_qty || 26);
        const rmRatio = Number(product?.rm_ratio_qty || 1);
        const unitsPerRMUnit = productRatio / rmRatio;
        
        // RM consumed = units / unitsPerRMUnit (rounded up)
        const bags = units > 0 ? Math.ceil(units / unitsPerRMUnit) : '';

        // Material cost = bags × cost_per_unit
        const matCost = bags && material
            ? (Number(bags) * Number(material.cost_per_unit || 0)).toFixed(2)
            : updatedForm.mat_cost;

        // Electricity cost = units × 3
        const elecCost = units > 0
            ? (units * ELEC_COST_PER_UNIT).toFixed(2)
            : '';

        // Total sale value = units × sale_price
        const saleVal = units > 0 && product
            ? (units * Number(product.sale_price || 0)).toFixed(2)
            : updatedForm.total_sale_value;

        return {
            ...updatedForm,
            bags_consumed: bags.toString(),
            mat_cost: matCost,
            elec_units: units.toString(),
            elec_cost: elecCost,
            total_sale_value: saleVal,
        };
    };

    // ── Handle product change ─────────────────────────────────────
    const handleProductChange = (productId) => {
        // Auto select the linked raw material from the product
        const product = products.find(p => p.product_id === productId);
        const updated = {
            ...form,
            product_id: productId,
            material_id: product?.material_id || form.material_id,
        };
        setForm(recalculate(updated));
    };

    // ── Handle material change ────────────────────────────────────
    const handleMaterialChange = (materialId) => {
        const updated = { ...form, material_id: materialId };
        setForm(recalculate(updated));
    };

    // ── Handle units change ───────────────────────────────────────
    const handleUnitsChange = (units) => {
        const updated = { ...form, units_produced: units };
        setForm(recalculate(updated));
    };

    // ── Net profit preview ────────────────────────────────────────
    const netProfitPreview = (
        Number(form.total_sale_value || 0) -
        Number(form.mat_cost || 0) -
        Number(form.elec_cost || 0) -
        Number(form.shift_expense || 0) -
        Number(form.other_expense || 0)
    );

    // ── Add ──────────────────────────────────────────────────────
    const handleAdd = async () => {
        if (!form.shift) return toast.error('Shift is required');
        if (!form.product_id) return toast.error('Product is required');
        if (!form.units_produced) return toast.error('Units produced is required');
        if (!form.bags_consumed) return toast.error('Bags consumed is required');
        try {
            await createProductionLog(form);
            toast.success('✅ Production log added!');
            setShowAdd(false);
            setForm(emptyForm);
            fetchData();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to add log');
        }
    };

    // ── Edit ─────────────────────────────────────────────────────
    const handleEdit = async () => {
        try {
            await updateProductionLog(selected.log_id, {
                elec_units: form.elec_units,
                elec_cost: form.elec_cost,
                shift_expense: form.shift_expense,
                other_expense: form.other_expense,
                total_sale_value: form.total_sale_value,
                remarks: form.remarks,
            });
            toast.success('✅ Production log updated!');
            setShowEdit(false);
            setSelected(null);
            fetchData();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to update log');
        }
    };

    const openEdit = (log) => {
        setSelected(log);
        setForm({
            ...emptyForm,
            elec_units: log.elec_units || '',
            elec_cost: log.elec_cost || '',
            shift_expense: log.shift_expense || '0',
            other_expense: log.other_expense || '0',
            total_sale_value: log.total_sale_value || '',
            remarks: log.remarks || '',
        });
        setShowEdit(true);
    };

    // ── Summary ──────────────────────────────────────────────────
    const totalProfit = logs.reduce((s, l) => s + Number(l.net_profit || 0), 0);
    const totalSale = logs.reduce((s, l) => s + Number(l.total_sale_value || 0), 0);
    const totalUnits = logs.reduce((s, l) => s + Number(l.units_produced || 0), 0);
    const todayLogs = logs.filter(l => l.date?.split('T')[0] === today);
    const todayProfit = todayLogs.reduce((s, l) => s + Number(l.net_profit || 0), 0);

    const shiftOptions = ['Morning', 'Evening', 'Night'];
    const productOptions = products;
    const materialOptions = materials;

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
                    <h1 className="text-2xl font-bold text-gray-800">Production</h1>
                    <p className="text-gray-400 text-sm mt-1">Daily production logs and shift management</p>
                </div>
                {can('production', 'add') && (
                    <button
                        onClick={() => { setForm(emptyForm); setShowAdd(true); }}
                        className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors shadow-sm"
                    >
                        <Plus size={18} />
                        Add Production Log
                    </button>
                )}
            </div>

            {/* ── Stat Cards ── */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 rounded-2xl p-5 border border-white shadow-sm">
                    <p className="text-3xl font-bold text-gray-800">{logs.length}</p>
                    <p className="text-sm font-medium text-gray-600 mt-1">Total Runs</p>
                    <p className="text-xs text-blue-600 mt-1">{todayLogs.length} today</p>
                </div>
                <div className="bg-green-50 rounded-2xl p-5 border border-white shadow-sm">
                    <p className="text-2xl font-bold text-gray-800">Rs {totalProfit.toLocaleString()}</p>
                    <p className="text-sm font-medium text-gray-600 mt-1">Total Net Profit</p>
                    <p className="text-xs text-green-600 mt-1">Rs {todayProfit.toLocaleString()} today</p>
                </div>
                <div className="bg-purple-50 rounded-2xl p-5 border border-white shadow-sm">
                    <p className="text-3xl font-bold text-gray-800">{totalUnits.toLocaleString()}</p>
                    <p className="text-sm font-medium text-gray-600 mt-1">Units Produced</p>
                    <p className="text-xs text-purple-600 mt-1">All time total</p>
                </div>
                <div className="bg-orange-50 rounded-2xl p-5 border border-white shadow-sm">
                    <p className="text-2xl font-bold text-gray-800">Rs {totalSale.toLocaleString()}</p>
                    <p className="text-sm font-medium text-gray-600 mt-1">Total Sale Value</p>
                    <p className="text-xs text-orange-600 mt-1">All production runs</p>
                </div>
            </div>

            {/* ── Search ── */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search by product, machine or shift..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                </div>
            </div>

            {/* ── Logs Table ── */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-100">
                                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Date</th>
                                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Shift</th>
                                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Product</th>
                                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Machine</th>
                                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Units</th>
                                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Sale Value</th>
                                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Net Profit</th>
                                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {filtered.map(log => (
                                <tr key={log.log_id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center">
                                                <Calendar size={13} className="text-blue-500" />
                                            </div>
                                            <span className="text-sm text-gray-600">
                                                {new Date(log.date).toLocaleDateString('en-PK', {
                                                    day: 'numeric', month: 'short', year: 'numeric'
                                                })}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4"><ShiftBadge shift={log.shift} /></td>
                                    <td className="px-6 py-4">
                                        <div>
                                            <p className="text-sm font-medium text-gray-800">{log.product_name || '—'}</p>
                                            <p className="text-xs text-gray-400">{log.material_name || 'No material'}</p>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-600">
                                        {log.machine_name || log.machine_id}
                                    </td>
                                    <td className="px-6 py-4">
                                        <p className="text-sm font-bold text-gray-800">{Number(log.units_produced).toLocaleString()}</p>
                                        <p className="text-xs text-gray-400">
                                            {log.bags_consumed} {materials.find(m => m.material_id === log.material_id)?.unit || 'bag'}(s) used
                                        </p>
                                    </td>
                                    <td className="px-6 py-4 text-sm font-medium text-blue-600">
                                        Rs {Number(log.total_sale_value || 0).toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-1">
                                            <TrendingUp size={14} className="text-green-500" />
                                            <span className="text-sm font-bold text-green-600">
                                                Rs {Number(log.net_profit || 0).toLocaleString()}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => { setSelected(log); setShowDetail(true); }}
                                                className="w-8 h-8 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center transition-colors text-xs font-bold"
                                            >
                                                i
                                            </button>
                                            {can('production', 'edit') && (
                                                <button
                                                    onClick={() => openEdit(log)}
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
                                    <td colSpan={8} className="px-6 py-12 text-center text-gray-400">
                                        <Factory size={40} className="mx-auto mb-3 opacity-30" />
                                        <p>No production logs found</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── Add Modal ── */}
            {showAdd && (
                <Modal title="Add Production Log" onClose={() => setShowAdd(false)} wide>

                    {/* ── Section 1: Required Info ── */}
                    <div className="bg-blue-50 rounded-xl p-3 mb-4">
                        <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Step 1 — Basic Info</p>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4">
                        <InputField
                            label="Date" type="date"
                            value={form.date}
                            onChange={v => setForm({ ...form, date: v })}
                            required
                        />
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Shift <span className="text-red-500">*</span>
                            </label>
                            <div className="flex gap-2">
                                {shiftOptions.map(s => (
                                    <button
                                        key={s}
                                        onClick={() => setForm({ ...form, shift: s })}
                                        className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all border-2 ${form.shift === s
                                            ? s === 'Morning' ? 'bg-yellow-400 text-white border-yellow-400'
                                                : s === 'Evening' ? 'bg-blue-500 text-white border-blue-500'
                                                    : 'bg-purple-500 text-white border-purple-500'
                                            : 'border-gray-200 text-gray-600 hover:border-gray-300'
                                            }`}
                                    >
                                        {s === 'Morning' ? '🌅' : s === 'Evening' ? '🌆' : '🌙'} {s}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Product */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Product <span className="text-red-500">*</span>
                        </label>
                        <select
                            value={form.product_id}
                            onChange={e => handleProductChange(e.target.value)}
                            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                        >
                            <option value="">-- Select Product --</option>
                            {productOptions.map(p => (
                                <option key={p.product_id} value={p.product_id}>
                                    {p.name} — Rs {Number(p.sale_price).toLocaleString()} / {p.unit}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Raw Material */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Raw Material</label>
                        <select
                            value={form.material_id}
                            onChange={e => handleMaterialChange(e.target.value)}
                            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                        >
                            <option value="">-- Select Material --</option>
                            {materialOptions.map(m => (
                                <option key={m.material_id} value={m.material_id}>
                                    {m.name} — Rs {Number(m.cost_per_unit).toLocaleString()} / {m.unit} (Stock: {m.current_stock})
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Units Produced — triggers all calculations */}
                    <div className="mb-4">
                        <div className="flex items-center justify-between mb-1">
                            <label className="block text-sm font-medium text-gray-700">
                                Units Produced <span className="text-red-500">*</span>
                            </label>
                            <span className="text-xs text-blue-500">
                                {Number(products.find(p => p.product_id === form.product_id)?.rm_ratio_qty || 1).toLocaleString()} {materials.find(m => m.material_id === form.material_id)?.unit || 'unit'} = {Number(products.find(p => p.product_id === form.product_id)?.product_ratio_qty || 26).toLocaleString()} units
                            </span>
                        </div>
                        <input
                            type="number"
                            value={form.units_produced}
                            onChange={e => handleUnitsChange(e.target.value)}
                            placeholder="e.g. 115 — RM & costs auto calculate"
                            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                    </div>

                    {/* ── Section 2: Auto Calculated (editable) ── */}
                    <div className="bg-green-50 rounded-xl p-3 mb-4 mt-2">
                        <p className="text-xs font-semibold text-green-600 uppercase tracking-wider">
                            Step 2 — Auto Calculated (editable)
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-x-4">
                        <InputField
                            label="RM Consumed"
                            type="number"
                            value={form.bags_consumed}
                            onChange={v => setForm({ ...form, bags_consumed: v })}
                            placeholder="Auto calculated"
                            hint={`${Number(products.find(p => p.product_id === form.product_id)?.rm_ratio_qty || 1).toLocaleString()} RM per ${Number(products.find(p => p.product_id === form.product_id)?.product_ratio_qty || 26).toLocaleString()} units`}
                            required
                        />
                        <InputField
                            label="Material Cost (Rs)"
                            type="number"
                            value={form.mat_cost}
                            onChange={v => setForm({ ...form, mat_cost: v })}
                            placeholder="Auto calculated"
                            hint="RM × cost/unit"
                            required
                        />
                        <InputField
                            label="Electricity Cost (Rs)"
                            type="number"
                            value={form.elec_cost}
                            onChange={v => setForm({ ...form, elec_cost: v })}
                            placeholder="Auto calculated"
                            hint={`units × Rs${ELEC_COST_PER_UNIT}`}
                            required
                        />
                        <InputField
                            label="Total Sale Value (Rs)"
                            type="number"
                            value={form.total_sale_value}
                            onChange={v => setForm({ ...form, total_sale_value: v })}
                            placeholder="Auto calculated"
                            hint="units × sale price"
                        />
                    </div>

                    {/* ── Section 3: Expenses ── */}
                    <div className="bg-orange-50 rounded-xl p-3 mb-4 mt-2">
                        <p className="text-xs font-semibold text-orange-600 uppercase tracking-wider">
                            Step 3 — Expenses
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-x-4">
                        <InputField
                            label="Shift Expense (Rs)"
                            type="number"
                            value={form.shift_expense}
                            onChange={v => setForm({ ...form, shift_expense: v })}
                            placeholder="e.g. 3500"
                            hint="Default: 0"
                            required
                        />
                        <InputField
                            label="Other Expense (Rs)"
                            type="number"
                            value={form.other_expense}
                            onChange={v => setForm({ ...form, other_expense: v })}
                            placeholder="e.g. 500"
                            hint="Default: 0"
                            required
                        />
                    </div>

                    <InputField
                        label="Remarks"
                        value={form.remarks}
                        onChange={v => setForm({ ...form, remarks: v })}
                        placeholder="Optional notes..."
                    />

                    {/* ── Live Profit Preview ── */}
                    {form.total_sale_value && (
                        <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-xl p-4 mb-4 text-white">
                            <div className="grid grid-cols-3 gap-4 text-center">
                                <div>
                                    <p className="text-xs opacity-80">Sale Value</p>
                                    <p className="font-bold">Rs {Number(form.total_sale_value || 0).toLocaleString()}</p>
                                </div>
                                <div>
                                    <p className="text-xs opacity-80">Total Cost</p>
                                    <p className="font-bold">Rs {(
                                        Number(form.mat_cost || 0) +
                                        Number(form.elec_cost || 0) +
                                        Number(form.shift_expense || 0) +
                                        Number(form.other_expense || 0)
                                    ).toLocaleString()}</p>
                                </div>
                                <div>
                                    <p className="text-xs opacity-80">Net Profit</p>
                                    <p className="text-lg font-bold">Rs {netProfitPreview.toLocaleString()}</p>
                                </div>
                            </div>
                        </div>
                    )}

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
                            Save Log
                        </button>
                    </div>
                </Modal>
            )}

            {/* ── Edit Modal ── */}
            {showEdit && (
                <Modal title="Edit Production Log" onClose={() => setShowEdit(false)}>
                    <p className="text-xs text-gray-400 mb-4 bg-gray-50 rounded-xl p-3">
                        ℹ️ Only expenses and remarks can be edited. Core production data is locked.
                    </p>
                    <InputField label="Electricity Units" type="number" value={form.elec_units} onChange={v => setForm({ ...form, elec_units: v })} placeholder="e.g. 85" />
                    <InputField label="Electricity Cost (Rs)" type="number" value={form.elec_cost} onChange={v => setForm({ ...form, elec_cost: v })} placeholder="e.g. 1020" />
                    <InputField label="Shift Expense (Rs)" type="number" value={form.shift_expense} onChange={v => setForm({ ...form, shift_expense: v })} placeholder="e.g. 3500" />
                    <InputField label="Other Expense (Rs)" type="number" value={form.other_expense} onChange={v => setForm({ ...form, other_expense: v })} placeholder="e.g. 500" />
                    <InputField label="Total Sale Value (Rs)" type="number" value={form.total_sale_value} onChange={v => setForm({ ...form, total_sale_value: v })} placeholder="e.g. 322000" />
                    <InputField label="Remarks" value={form.remarks} onChange={v => setForm({ ...form, remarks: v })} placeholder="Optional notes..." />
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

            {/* ── Detail Modal ── */}
            {showDetail && selected && (
                <Modal title="Production Log Detail" onClose={() => setShowDetail(false)}>
                    <div className="space-y-3">
                        {[
                            { label: 'Log ID', value: selected.log_id },
                            { label: 'Date', value: new Date(selected.date).toLocaleDateString('en-PK', { day: 'numeric', month: 'long', year: 'numeric' }) },
                            { label: 'Shift', value: selected.shift },
                            { label: 'Machine', value: selected.machine_name || selected.machine_id },
                            { label: 'Product', value: selected.product_name },
                            { label: 'Material Used', value: selected.material_name || '—' },
                            { label: 'Units Produced', value: Number(selected.units_produced).toLocaleString() },
                            { label: 'Material Consumed', value: `${selected.bags_consumed} ${materials.find(m => m.material_id === selected.material_id)?.unit || 'unit'}(s) (${Number(products.find(p => p.product_id === selected.product_id)?.rm_ratio_qty || 1).toLocaleString()} unit = ${Number(products.find(p => p.product_id === selected.product_id)?.product_ratio_qty || 26).toLocaleString()} units produced)` },
                            { label: 'Material Cost', value: `Rs ${Number(selected.mat_cost || 0).toLocaleString()}` },
                            { label: 'Electricity', value: `${selected.elec_units} units — Rs ${Number(selected.elec_cost || 0).toLocaleString()} (Rs ${ELEC_COST_PER_UNIT}/unit)` },
                            { label: 'Shift Expense', value: `Rs ${Number(selected.shift_expense || 0).toLocaleString()}` },
                            { label: 'Other Expense', value: `Rs ${Number(selected.other_expense || 0).toLocaleString()}` },
                            { label: 'Total Sale Value', value: `Rs ${Number(selected.total_sale_value || 0).toLocaleString()}` },
                            { label: 'Net Profit', value: `Rs ${Number(selected.net_profit || 0).toLocaleString()}`, highlight: true },
                            { label: 'Remarks', value: selected.remarks || '—' },
                        ].map(({ label, value, highlight }) => (
                            <div key={label} className={`flex justify-between py-2 border-b border-gray-50 ${highlight ? 'bg-green-50 rounded-xl px-3' : ''}`}>
                                <span className="text-sm text-gray-500">{label}</span>
                                <span className={`text-sm font-semibold ${highlight ? 'text-green-600' : 'text-gray-800'}`}>{value}</span>
                            </div>
                        ))}
                    </div>
                </Modal>
            )}

        </div>
    );
}