'use client';
import { useEffect, useState } from 'react';
import {
    getInvoices, getInvoiceById,
    createInvoice, getCustomers, getProducts
} from '../../../lib/api';
import {
    FileText, Plus, Search, Eye, Check, X, Download
} from 'lucide-react';
import toast from 'react-hot-toast';
import { usePermissions } from '../../../hooks/usePermissions';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ── Modal Component ──────────────────────────────────────────────────────
function Modal({ title, onClose, children, wide }) {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
            <div className={`bg-white rounded-2xl shadow-2xl w-full ${wide ? 'max-w-2xl' : 'max-w-md'} max-h-[90vh] overflow-y-auto`}>
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

// ── Status Badge ───────────────────────────────────────────────
function StatusBadge({ status }) {
    const styles = {
        paid: 'bg-green-100 text-green-700',
        partial: 'bg-yellow-100 text-yellow-700',
        unpaid: 'bg-red-100 text-red-700',
    };
    return (
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${styles[status] || 'bg-gray-100 text-gray-600'}`}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
    );
}

// ── Main Invoices Page ──────────────────────────────────────────────────
export default function InvoicesPage() {
    const [invoices, setInvoices] = useState([]);
    const [filtered, setFiltered] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [showAdd, setShowAdd] = useState(false);
    const [showDetail, setShowDetail] = useState(false);
    const [detail, setDetail] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const { can } = usePermissions();

    const today = new Date().toISOString().split('T')[0];
    const dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Invoice Form State
    const emptyForm = { customer_id: '', date: today, due_date: dueDate };
    const [form, setForm] = useState(emptyForm);
    const [items, setItems] = useState([{ product_id: '', quantity: '', unit_price: '' }]);

    // Fetch Data
    const fetchData = async () => {
        try {
            const [iRes, cRes, pRes] = await Promise.all([
                getInvoices(),
                getCustomers(),
                getProducts(),
            ]);
            setInvoices(iRes.data);
            setFiltered(iRes.data);
            setCustomers(cRes.data);
            setProducts(pRes.data);
        } catch (err) {
            toast.error('Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    // Search & Filter
    useEffect(() => {
        let list = [...invoices];
        const q = search.toLowerCase();
        if (q) list = list.filter(i =>
            i.invoice_no.toLowerCase().includes(q) ||
            (i.customer_name && i.customer_name.toLowerCase().includes(q))
        );
        if (statusFilter !== 'all') list = list.filter(i => i.status === statusFilter);
        setFiltered(list);
    }, [search, statusFilter, invoices]);

    // Item Helpers
    const addItem = () => setItems([...items, { product_id: '', quantity: '', unit_price: '' }]);

    const removeItem = (idx) => {
        if (items.length === 1) return toast.error('At least one item required');
        setItems(items.filter((_, i) => i !== idx));
    };

    const updateItem = (idx, field, value) => {
        const updated = [...items];
        updated[idx][field] = value;
        if (field === 'product_id') {
            const product = products.find(p => p.product_id === value);
            if (product) updated[idx].unit_price = product.sale_price;
        }
        setItems(updated);
    };

    // Calculate Total
    const invoiceTotal = items.reduce((sum, item) => {
        return sum + (Number(item.quantity || 0) * Number(item.unit_price || 0));
    }, 0);

    // Create Invoice
    const handleCreate = async () => {
        if (!form.customer_id) return toast.error('Please select a customer');
        if (items.some(i => !i.product_id || !i.quantity || !i.unit_price))
            return toast.error('Please fill all item fields');

        try {
            await createInvoice({ ...form, items });
            toast.success('✅ Invoice created successfully!');
            setShowAdd(false);
            setForm(emptyForm);
            setItems([{ product_id: '', quantity: '', unit_price: '' }]);
            fetchData();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to create invoice');
        }
    };

    // View Invoice Detail
    const viewDetail = async (invoiceId) => {
        setDetailLoading(true);
        setShowDetail(true);
        try {
            const res = await getInvoiceById(invoiceId);
            setDetail(res.data);
        } catch (err) {
            toast.error('Failed to load invoice details');
        } finally {
            setDetailLoading(false);
        }
    };

    // ── Download Invoice as PDF ─────────────────────────────────────
    const downloadPDF = () => {
        if (!detail) return;

        const { invoice, items: invoiceItems, payments } = detail;
        const doc = new jsPDF();

        // Title
        doc.setFontSize(22);
        doc.text('INVOICE', 105, 20, { align: 'center' });

        // Invoice Info
        doc.setFontSize(11);
        doc.text(`Invoice No: ${invoice.invoice_no}`, 20, 35);
        doc.text(`Date: ${new Date(invoice.date).toLocaleDateString('en-PK')}`, 20, 42);
        doc.text(`Due Date: ${invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('en-PK') : '—'}`, 20, 49);

        // Customer
        doc.setFontSize(12);
        doc.text('Bill To:', 20, 65);
        doc.setFontSize(11);
        doc.text(invoice.customer_name || 'Walk-in Customer', 20, 72);

        // Items Table
        const tableColumn = ['Product', 'Quantity', 'Unit Price', 'Amount'];
        const tableRows = invoiceItems.map(item => [
            item.product_name,
            item.quantity.toString(),
            `Rs ${Number(item.unit_price).toLocaleString()}`,
            `Rs ${Number(item.line_total).toLocaleString()}`
        ]);

        autoTable(doc, {
            startY: 85,
            head: [tableColumn],
            body: tableRows,
            theme: 'grid',
            styles: { fontSize: 10, cellPadding: 5 },
            headStyles: { fillColor: [16, 185, 129], textColor: 255 },
            alternateRowStyles: { fillColor: [245, 245, 245] },
        });

        const finalY = doc.lastAutoTable.finalY + 15;

        // Summary
        doc.setFontSize(12);
        doc.text(`Total Amount:`, 140, finalY, { align: 'right' });
        doc.text(`Rs ${Number(invoice.total_amount).toLocaleString()}`, 195, finalY, { align: 'right' });

        doc.text(`Amount Paid:`, 140, finalY + 10, { align: 'right' });
        doc.text(`Rs ${Number(invoice.amount_paid).toLocaleString()}`, 195, finalY + 10, { align: 'right' });

        doc.setFontSize(13);
        doc.setTextColor(220, 38, 38);
        doc.text(`Balance Due:`, 140, finalY + 22, { align: 'right' });
        doc.text(`Rs ${Number(invoice.balance_due).toLocaleString()}`, 195, finalY + 22, { align: 'right' });
        doc.setTextColor(0);

        // Payment History
        if (payments && payments.length > 0) {
            doc.setFontSize(12);
            doc.text('Payment History', 20, finalY + 45);

            const payRows = payments.map(p => [
                p.receipt_no,
                new Date(p.date).toLocaleDateString('en-PK'),
                p.method || 'Cash',
                `Rs ${Number(p.amount).toLocaleString()}`
            ]);

            autoTable(doc, {
                startY: finalY + 55,
                head: [['Receipt No', 'Date', 'Method', 'Amount']],
                body: payRows,
                theme: 'striped',
                styles: { fontSize: 10 },
                headStyles: { fillColor: [59, 130, 246] },
            });
        }

        // Footer
        doc.setFontSize(10);
        doc.text('Thank you for your business!', 105, 280, { align: 'center' });
        doc.text('Powered by Your Company Name', 105, 285, { align: 'center' });

        // Save PDF
        doc.save(`Invoice_${invoice.invoice_no}.pdf`);
        toast.success('📄 Invoice downloaded as PDF');
    };

    // Summary Stats
    const totalAmount = invoices.reduce((s, i) => s + Number(i.total_amount || 0), 0);
    const totalPaid = invoices.reduce((s, i) => s + Number(i.amount_paid || 0), 0);
    const totalPending = invoices.reduce((s, i) => s + Number(i.balance_due || 0), 0);
    const unpaidCount = invoices.filter(i => i.status === 'unpaid').length;
    const partialCount = invoices.filter(i => i.status === 'partial').length;
    const paidCount = invoices.filter(i => i.status === 'paid').length;

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
    );

    return (
        <div className="space-y-6">

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Invoices</h1>
                    <p className="text-gray-400 text-sm mt-1">Create and manage customer invoices</p>
                </div>
                {can('invoices', 'add') && (
                    <button
                        onClick={() => {
                            setForm(emptyForm);
                            setItems([{ product_id: '', quantity: '', unit_price: '' }]);
                            setShowAdd(true);
                        }}
                        className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors shadow-sm"
                    >
                        <Plus size={18} />
                        Create Invoice
                    </button>
                )}
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 rounded-2xl p-5 border border-white shadow-sm">
                    <p className="text-2xl font-bold text-gray-800">Rs {totalAmount.toLocaleString()}</p>
                    <p className="text-sm font-medium text-gray-600 mt-1">Total Invoiced</p>
                    <p className="text-xs text-blue-600 mt-1">{invoices.length} invoices</p>
                </div>
                <div className="bg-green-50 rounded-2xl p-5 border border-white shadow-sm">
                    <p className="text-2xl font-bold text-gray-800">Rs {totalPaid.toLocaleString()}</p>
                    <p className="text-sm font-medium text-gray-600 mt-1">Total Collected</p>
                    <p className="text-xs text-green-600 mt-1">{paidCount} fully paid</p>
                </div>
                <div className="bg-red-50 rounded-2xl p-5 border border-white shadow-sm">
                    <p className="text-2xl font-bold text-gray-800">Rs {totalPending.toLocaleString()}</p>
                    <p className="text-sm font-medium text-gray-600 mt-1">Total Pending</p>
                    <p className="text-xs text-red-600 mt-1">{unpaidCount} unpaid · {partialCount} partial</p>
                </div>
                <div className="bg-yellow-50 rounded-2xl p-5 border border-white shadow-sm">
                    <p className="text-2xl font-bold text-gray-800">{unpaidCount + partialCount}</p>
                    <p className="text-sm font-medium text-gray-600 mt-1">Needs Attention</p>
                    <p className="text-xs text-yellow-600 mt-1">Awaiting payment</p>
                </div>
            </div>

            {/* Search & Filter */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                <div className="flex flex-col md:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search by invoice no or customer..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        />
                    </div>
                    <div className="flex gap-2">
                        {['all', 'unpaid', 'partial', 'paid'].map(s => (
                            <button
                                key={s}
                                onClick={() => setStatusFilter(s)}
                                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors capitalize ${statusFilter === s
                                    ? 'bg-green-500 text-white'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                            >
                                {s === 'all' ? 'All' : s}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Invoices Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-100">
                                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Invoice</th>
                                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Customer</th>
                                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Date</th>
                                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Due Date</th>
                                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Total</th>
                                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Paid</th>
                                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Balance</th>
                                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Status</th>
                                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {filtered.map(invoice => (
                                <tr key={invoice.invoice_id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 bg-cyan-50 rounded-lg flex items-center justify-center">
                                                <FileText size={14} className="text-cyan-500" />
                                            </div>
                                            <span className="text-sm font-medium text-gray-800">{invoice.invoice_no}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-7 h-7 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                                                {invoice.customer_name?.charAt(0).toUpperCase()}
                                            </div>
                                            <span className="text-sm text-gray-700">{invoice.customer_name}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-600">
                                        {new Date(invoice.date).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-600">
                                        {invoice.due_date
                                            ? new Date(invoice.due_date).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })
                                            : '—'
                                        }
                                    </td>
                                    <td className="px-6 py-4 text-sm font-semibold text-gray-800">
                                        Rs {Number(invoice.total_amount).toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 text-sm font-medium text-green-600">
                                        Rs {Number(invoice.amount_paid).toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 text-sm font-medium text-red-600">
                                        Rs {Number(invoice.balance_due).toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4">
                                        <StatusBadge status={invoice.status} />
                                    </td>
                                    <td className="px-6 py-4">
                                        <button
                                            onClick={() => viewDetail(invoice.invoice_id)}
                                            className="w-8 h-8 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center transition-colors"
                                        >
                                            <Eye size={14} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan={9} className="px-6 py-12 text-center text-gray-400">
                                        <FileText size={40} className="mx-auto mb-3 opacity-30" />
                                        <p>No invoices found</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create Invoice Modal */}
            {showAdd && (
                <Modal title="Create New Invoice" onClose={() => setShowAdd(false)} wide>
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Customer <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={form.customer_id}
                                onChange={e => setForm({ ...form, customer_id: e.target.value })}
                                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                            >
                                <option value="">-- Select Customer --</option>
                                {customers.map(c => (
                                    <option key={c.customer_id} value={c.customer_id}>
                                        {c.name} (Credit: Rs {Number(c.credit_limit).toLocaleString()} | Due: Rs {Number(c.balance_due).toLocaleString()})
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Date</label>
                            <input
                                type="date" value={form.date}
                                onChange={e => setForm({ ...form, date: e.target.value })}
                                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                            <input
                                type="date" value={form.due_date}
                                onChange={e => setForm({ ...form, due_date: e.target.value })}
                                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                            />
                        </div>
                    </div>

                    {/* Items Section */}
                    <div className="mb-6">
                        <div className="flex items-center justify-between mb-3">
                            <label className="text-sm font-medium text-gray-700">Invoice Items</label>
                            <button
                                onClick={addItem}
                                className="flex items-center gap-1 text-green-600 text-xs font-medium hover:text-green-700"
                            >
                                <Plus size={14} /> Add Item
                            </button>
                        </div>

                        <div className="space-y-3">
                            {items.map((item, idx) => (
                                <div key={idx} className="flex gap-3 items-center bg-gray-50 rounded-xl p-4">
                                    <select
                                        value={item.product_id}
                                        onChange={e => updateItem(idx, 'product_id', e.target.value)}
                                        className="flex-1 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                                    >
                                        <option value="">-- Select Product --</option>
                                        {products.map(p => (
                                            <option key={p.product_id} value={p.product_id}>
                                                {p.name} (Rs {Number(p.sale_price).toLocaleString()})
                                            </option>
                                        ))}
                                    </select>
                                    <input
                                        type="number"
                                        placeholder="Qty"
                                        value={item.quantity}
                                        onChange={e => updateItem(idx, 'quantity', e.target.value)}
                                        className="w-20 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                                    />
                                    <input
                                        type="number"
                                        placeholder="Price"
                                        value={item.unit_price}
                                        onChange={e => updateItem(idx, 'unit_price', e.target.value)}
                                        className="w-28 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                                    />
                                    <div className="w-28 text-right">
                                        <p className="text-xs text-gray-400">Total</p>
                                        <p className="text-sm font-semibold text-gray-700">
                                            Rs {(Number(item.quantity || 0) * Number(item.unit_price || 0)).toLocaleString()}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => removeItem(idx)}
                                        className="w-8 h-8 bg-red-50 hover:bg-red-100 text-red-500 rounded-lg flex items-center justify-center"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Total */}
                    <div className="bg-green-50 rounded-xl p-5 flex justify-between items-center mb-6">
                        <span className="text-lg font-medium text-gray-700">Invoice Total</span>
                        <span className="text-2xl font-bold text-green-700">
                            Rs {invoiceTotal.toLocaleString()}
                        </span>
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={() => setShowAdd(false)}
                            className="flex-1 border border-gray-200 text-gray-600 py-3 rounded-xl font-medium hover:bg-gray-50"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleCreate}
                            className="flex-1 bg-green-500 hover:bg-green-600 text-white py-3 rounded-xl font-medium flex items-center justify-center gap-2"
                        >
                            <Check size={18} />
                            Create Invoice
                        </button>
                    </div>
                </Modal>
            )}

            {/* Invoice Detail Modal with PDF Download */}
            {showDetail && (
                <Modal title="Invoice Detail" onClose={() => { setShowDetail(false); setDetail(null); }} wide>
                    {detailLoading ? (
                        <div className="flex justify-center py-12">
                            <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    ) : detail ? (
                        <div className="space-y-6">
                            {/* Download Button */}
                            <div className="flex justify-end">
                                <button
                                    onClick={downloadPDF}
                                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl text-sm font-medium transition-all shadow-sm"
                                >
                                    <Download size={18} />
                                    Download as PDF
                                </button>
                            </div>

                            {/* Invoice Header */}
                            <div className="bg-gray-50 rounded-xl p-5 flex justify-between items-start">
                                <div>
                                    <p className="text-2xl font-bold text-gray-800">{detail.invoice.invoice_no}</p>
                                    <p className="text-gray-600 mt-1">{detail.invoice.customer_name}</p>
                                    <p className="text-sm text-gray-500 mt-1">
                                        {new Date(detail.invoice.date).toLocaleDateString('en-PK', { day: 'numeric', month: 'long', year: 'numeric' })}
                                    </p>
                                </div>
                                <StatusBadge status={detail.invoice.status} />
                            </div>

                            {/* Items Table */}
                            <div>
                                <p className="text-sm font-semibold text-gray-700 mb-3">Items</p>
                                <div className="border border-gray-100 rounded-xl overflow-hidden">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="bg-gray-50">
                                                <th className="text-left text-xs text-gray-500 px-5 py-3">Product</th>
                                                <th className="text-right text-xs text-gray-500 px-5 py-3">Qty</th>
                                                <th className="text-right text-xs text-gray-500 px-5 py-3">Unit Price</th>
                                                <th className="text-right text-xs text-gray-500 px-5 py-3">Total</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {detail.items.map((item, idx) => (
                                                <tr key={idx} className="hover:bg-gray-50">
                                                    <td className="px-5 py-3 text-sm text-gray-700">{item.product_name}</td>
                                                    <td className="px-5 py-3 text-sm text-gray-600 text-right">{item.quantity}</td>
                                                    <td className="px-5 py-3 text-sm text-gray-600 text-right">Rs {Number(item.unit_price).toLocaleString()}</td>
                                                    <td className="px-5 py-3 text-sm font-semibold text-gray-800 text-right">Rs {Number(item.line_total).toLocaleString()}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Summary */}
                            <div className="grid grid-cols-3 gap-4">
                                <div className="bg-blue-50 rounded-xl p-4 text-center">
                                    <p className="text-xs text-blue-600">Total</p>
                                    <p className="text-lg font-bold text-gray-800 mt-1">Rs {Number(detail.invoice.total_amount).toLocaleString()}</p>
                                </div>
                                <div className="bg-green-50 rounded-xl p-4 text-center">
                                    <p className="text-xs text-green-600">Paid</p>
                                    <p className="text-lg font-bold text-gray-800 mt-1">Rs {Number(detail.invoice.amount_paid).toLocaleString()}</p>
                                </div>
                                <div className="bg-red-50 rounded-xl p-4 text-center">
                                    <p className="text-xs text-red-600">Balance</p>
                                    <p className="text-lg font-bold text-gray-800 mt-1">Rs {Number(detail.invoice.balance_due).toLocaleString()}</p>
                                </div>
                            </div>

                            {/* Payment History */}
                            {detail.payments.length > 0 && (
                                <div>
                                    <p className="text-sm font-semibold text-gray-700 mb-3">Payment History</p>
                                    <div className="space-y-2">
                                        {detail.payments.map(pay => (
                                            <div key={pay.payment_id} className="flex justify-between items-center bg-gray-50 rounded-xl px-5 py-4">
                                                <div>
                                                    <p className="font-medium">{pay.receipt_no}</p>
                                                    <p className="text-xs text-gray-500">
                                                        {new Date(pay.date).toLocaleDateString('en-PK')} • {pay.method}
                                                    </p>
                                                </div>
                                                <p className="text-lg font-semibold text-green-600">
                                                    Rs {Number(pay.amount).toLocaleString()}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : null}
                </Modal>
            )}
        </div>
    );
}