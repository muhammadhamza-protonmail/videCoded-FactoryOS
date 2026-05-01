'use client';
import { useEffect, useState } from 'react';
import {
    getPayments, createPayment,
    getInvoices, getCustomers,
    getPaymentsByCustomer,
    allocatePayment
} from '../../../lib/api';
import {
    CreditCard, Plus, Search,
    Check, X, Eye, Filter, Link,
    AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { usePermissions } from '../../../hooks/usePermissions';

// ── Modal ──────────────────────────────────────────────────────
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

// ── Method Badge ───────────────────────────────────────────────
function MethodBadge({ method }) {
    const styles = {
        cash: 'bg-green-100  text-green-700',
        bank_transfer: 'bg-blue-100   text-blue-700',
        cheque: 'bg-purple-100 text-purple-700',
    };
    const labels = {
        cash: '💵 Cash',
        bank_transfer: '🏦 Bank Transfer',
        cheque: '📄 Cheque',
    };
    return (
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${styles[method] || 'bg-gray-100 text-gray-600'}`}>
            {labels[method] || method}
        </span>
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
            {status}
        </span>
    );
}

// ── Main Page ──────────────────────────────────────────────────
export default function PaymentsPage() {
    const [payments, setPayments] = useState([]);
    const [filtered, setFiltered] = useState([]);
    const [invoices, setInvoices] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [methodFilter, setMethodFilter] = useState('all');
    const [showAdd, setShowAdd] = useState(false);
    const [showLedger, setShowLedger] = useState(false);
    const [showAllocate, setShowAllocate] = useState(false);
    const [allocatingPayment, setAllocatingPayment] = useState(null);
    const [ledgerData, setLedgerData] = useState(null);
    const [ledgerLoading, setLedgerLoading] = useState(false);
    const { can } = usePermissions();

    const today = new Date().toISOString().split('T')[0];

    // ── Form ─────────────────────────────────────────────────────
    const emptyForm = {
        customer_id: '', invoice_id: '',
        date: today, amount: '', method: 'cash', notes: ''
    };
    const [form, setForm] = useState(emptyForm);
    const [customerInvoices, setCustomerInvoices] = useState([]);
    const [selectedInvoice, setSelectedInvoice] = useState(null);

    // ── Allocation Form ──
    const [allocForm, setAllocForm] = useState({ invoice_id: '' });

    // ── Fetch ────────────────────────────────────────────────────
    const fetchData = async () => {
        try {
            const [pRes, iRes, cRes] = await Promise.all([
                getPayments(),
                getInvoices(),
                getCustomers(),
            ]);
            setPayments(pRes.data);
            setFiltered(pRes.data);
            setInvoices(iRes.data);
            setCustomers(cRes.data);
        } catch (err) {
            toast.error('Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    // ── Search & Filter ──────────────────────────────────────────
    useEffect(() => {
        let list = [...payments];
        const q = search.toLowerCase();
        if (q) list = list.filter(p =>
            p.receipt_no.toLowerCase().includes(q) ||
            (p.customer_name && p.customer_name.toLowerCase().includes(q)) ||
            (p.invoice_no && p.invoice_no.toLowerCase().includes(q))
        );
        if (methodFilter !== 'all') list = list.filter(p => p.method === methodFilter);
        setFiltered(list);
    }, [search, methodFilter, payments]);

    // ── When customer selected → load their unpaid invoices ──────
    const handleCustomerChange = (customerId) => {
        setForm({ ...emptyForm, customer_id: customerId });
        setSelectedInvoice(null);
        if (customerId) {
            const unpaid = invoices.filter(i =>
                i.customer_id === customerId &&
                i.status !== 'paid'
            );
            setCustomerInvoices(unpaid);
        } else {
            setCustomerInvoices([]);
        }
    };

    // ── When invoice selected → prefill amount ───────────────────
    const handleInvoiceChange = (invoiceId) => {
        // Toggle off if same selected
        if (form.invoice_id === invoiceId) {
            setSelectedInvoice(null);
            setForm(prev => ({ ...prev, invoice_id: '', amount: '' }));
            return;
        }

        const invoice = invoices.find(i => i.invoice_id === invoiceId);
        setSelectedInvoice(invoice);
        setForm(prev => ({
            ...prev,
            invoice_id: invoiceId,
            amount: invoice ? invoice.balance_due : '',
        }));
    };

    // ── Record Payment ────────────────────────────────────────────
    const handleCreate = async () => {
        if (!form.customer_id) return toast.error('Please select a customer');
        if (!form.amount) return toast.error('Amount is required');
        if (!form.method) return toast.error('Payment method is required');
        try {
            await createPayment(form);
            toast.success('✅ Payment recorded!');
            setShowAdd(false);
            setForm(emptyForm);
            setCustomerInvoices([]);
            setSelectedInvoice(null);
            fetchData();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to record payment');
        }
    };

    // ── Allocate Payment ──────────────────────────────────────────
    const handleAllocate = async () => {
        if (!allocForm.invoice_id) return toast.error('Please select an invoice');
        try {
            await allocatePayment({
                payment_id: allocatingPayment.payment_id,
                invoice_id: allocForm.invoice_id
            });
            toast.success('✅ Payment allocated to invoice!');
            setShowAllocate(false);
            setAllocatingPayment(null);
            setAllocForm({ invoice_id: '' });
            fetchData();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to allocate payment');
        }
    };

    const openAllocate = (payment) => {
        const unpaid = invoices.filter(i =>
            i.customer_id === payment.customer_id &&
            i.status !== 'paid' &&
            Number(i.balance_due) >= Number(payment.amount)
        );
        setCustomerInvoices(unpaid);
        setAllocatingPayment(payment);
        setShowAllocate(true);
    };

    // ── View Customer Ledger ──────────────────────────────────────
    const viewLedger = async (customerId) => {
        setLedgerLoading(true);
        setShowLedger(true);
        try {
            const res = await getPaymentsByCustomer(customerId);
            const customer = customers.find(c => c.customer_id === customerId);
            setLedgerData({ ...res.data, customer });
        } catch (err) {
            toast.error('Failed to load ledger');
        } finally {
            setLedgerLoading(false);
        }
    };

    // ── Summary ───────────────────────────────────────────────────
    const totalCollected = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
    const todayPayments = payments.filter(p => p.date?.split('T')[0] === today);
    const todayCollected = todayPayments.reduce((s, p) => s + Number(p.amount || 0), 0);
    const cashTotal = payments.filter(p => p.method === 'cash').reduce((s, p) => s + Number(p.amount || 0), 0);
    const bankTotal = payments.filter(p => p.method === 'bank_transfer').reduce((s, p) => s + Number(p.amount || 0), 0);

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
                    <h1 className="text-2xl font-bold text-gray-800">Payments</h1>
                    <p className="text-gray-400 text-sm mt-1">Record and track customer payments</p>
                </div>
                {can('payments', 'add') && (
                    <button
                        onClick={() => { setForm(emptyForm); setCustomerInvoices([]); setSelectedInvoice(null); setShowAdd(true); }}
                        className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors shadow-sm"
                    >
                        <Plus size={18} />
                        Record Payment
                    </button>
                )}
            </div>

            {/* ── Stat Cards ── */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-green-50 rounded-2xl p-5 border border-white shadow-sm">
                    <p className="text-2xl font-bold text-gray-800">Rs {totalCollected.toLocaleString()}</p>
                    <p className="text-sm font-medium text-gray-600 mt-1">Total Collected</p>
                    <p className="text-xs text-green-600 mt-1">{payments.length} payments</p>
                </div>
                <div className="bg-blue-50 rounded-2xl p-5 border border-white shadow-sm">
                    <p className="text-2xl font-bold text-gray-800">Rs {todayCollected.toLocaleString()}</p>
                    <p className="text-sm font-medium text-gray-600 mt-1">Collected Today</p>
                    <p className="text-xs text-blue-600 mt-1">{todayPayments.length} payments today</p>
                </div>
                <div className="bg-yellow-50 rounded-2xl p-5 border border-white shadow-sm">
                    <p className="text-2xl font-bold text-gray-800">Rs {cashTotal.toLocaleString()}</p>
                    <p className="text-sm font-medium text-gray-600 mt-1">Cash Received</p>
                    <p className="text-xs text-yellow-600 mt-1">Cash payments only</p>
                </div>
                <div className="bg-purple-50 rounded-2xl p-5 border border-white shadow-sm">
                    <p className="text-2xl font-bold text-gray-800">Rs {bankTotal.toLocaleString()}</p>
                    <p className="text-sm font-medium text-gray-600 mt-1">Bank Transfers</p>
                    <p className="text-xs text-purple-600 mt-1">Online payments</p>
                </div>
            </div>

            {/* ── Search & Filter ── */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                <div className="flex flex-col md:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search by receipt, customer or invoice..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        />
                    </div>
                    <div className="flex gap-2">
                        {['all', 'cash', 'bank_transfer', 'cheque'].map(m => (
                            <button
                                key={m}
                                onClick={() => setMethodFilter(m)}
                                className={`px-3 py-2 rounded-xl text-xs font-medium transition-colors ${methodFilter === m
                                    ? 'bg-green-500 text-white'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                            >
                                {m === 'all' ? 'All' : m === 'bank_transfer' ? 'Bank' : m.charAt(0).toUpperCase() + m.slice(1)}
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
                                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Receipt</th>
                                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Customer</th>
                                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Invoice</th>
                                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Date</th>
                                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Amount</th>
                                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Method</th>
                                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Notes</th>
                                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {filtered.map(payment => (
                                <tr key={payment.payment_id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 bg-pink-50 rounded-lg flex items-center justify-center">
                                                <CreditCard size={14} className="text-pink-500" />
                                            </div>
                                            <span className="text-sm font-medium text-gray-800">{payment.receipt_no}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-7 h-7 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                                                {payment.customer_name?.charAt(0).toUpperCase()}
                                            </div>
                                            <span className="text-sm text-gray-700">{payment.customer_name}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {payment.invoice_no ? (
                                            <span className="text-sm text-gray-600">{payment.invoice_no}</span>
                                        ) : (
                                            <span className="bg-orange-100 text-orange-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tight">
                                                Unallocated
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-600">
                                        {new Date(payment.date).toLocaleDateString('en-PK', {
                                            day: 'numeric', month: 'short', year: 'numeric'
                                        })}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-sm font-bold text-green-600">
                                            Rs {Number(payment.amount).toLocaleString()}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <MethodBadge method={payment.method} />
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500">
                                        {payment.notes || '—'}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => viewLedger(payment.customer_id)}
                                                className="w-8 h-8 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center transition-colors"
                                                title="View customer payment history"
                                            >
                                                <Eye size={14} />
                                            </button>
                                            {!payment.invoice_id && can('payments', 'edit') && (
                                                <button
                                                    onClick={() => openAllocate(payment)}
                                                    className="w-8 h-8 bg-orange-50 hover:bg-orange-100 text-orange-600 rounded-lg flex items-center justify-center transition-colors"
                                                    title="Allocate to an invoice"
                                                >
                                                    <Link size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="px-6 py-12 text-center text-gray-400">
                                        <CreditCard size={40} className="mx-auto mb-3 opacity-30" />
                                        <p>No payments found</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── Record Payment Modal ── */}
            {showAdd && (
                <Modal title="Record Payment" onClose={() => setShowAdd(false)}>

                    {/* Step 1 — Select Customer */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Customer <span className="text-red-500">*</span>
                        </label>
                        <select
                            value={form.customer_id}
                            onChange={e => handleCustomerChange(e.target.value)}
                            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                        >
                            <option value="">-- Select Customer --</option>
                            {customers.filter(c => Number(c.balance_due) > 0).map(c => (
                                <option key={c.customer_id} value={c.customer_id}>
                                    {c.name} — Due: Rs {Number(c.balance_due).toLocaleString()}
                                </option>
                            ))}
                        </select>
                        {customers.filter(c => Number(c.balance_due) > 0).length === 0 && (
                            <p className="text-xs text-green-600 mt-1">✅ All customers have zero balance!</p>
                        )}
                    </div>

                    {/* Step 2 — Select Invoice (Optional) */}
                    {form.customer_id && (
                        <div className="mb-4">
                            <div className="flex items-center justify-between mb-2">
                                <label className="block text-sm font-medium text-gray-700">
                                    Link to Invoice <span className="text-gray-400 font-normal">(Optional)</span>
                                </label>
                                {form.invoice_id && (
                                    <button 
                                        onClick={() => handleInvoiceChange(form.invoice_id)}
                                        className="text-xs text-red-500 hover:underline"
                                    >
                                        Clear Selection
                                    </button>
                                )}
                            </div>
                            
                            {customerInvoices.length > 0 ? (
                                <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                                    {customerInvoices.map(inv => (
                                        <div
                                            key={inv.invoice_id}
                                            onClick={() => handleInvoiceChange(inv.invoice_id)}
                                            className={`flex justify-between items-center p-3 rounded-xl border cursor-pointer transition-all ${form.invoice_id === inv.invoice_id
                                                ? 'border-green-500 bg-green-50'
                                                : 'border-gray-200 hover:border-gray-300'
                                                }`}
                                        >
                                            <div>
                                                <p className="text-sm font-medium text-gray-800">{inv.invoice_no}</p>
                                                <p className="text-xs text-gray-400">
                                                    {new Date(inv.date).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-bold text-red-600">
                                                    Rs {Number(inv.balance_due).toLocaleString()}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-sm text-gray-500 bg-gray-50 rounded-xl p-3 flex items-center gap-2">
                                    <AlertCircle size={16} />
                                    No pending invoices. This will be a "Payment on Account".
                                </div>
                            )}
                            
                            {!form.invoice_id && (
                                <div className="mt-2 text-[10px] text-orange-600 font-medium bg-orange-50 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                                    <Filter size={10} />
                                    Recording as UNALLOCATED (Payment on Account)
                                </div>
                            )}
                        </div>
                    )}

                    {/* Step 3 — Payment Details */}
                    {form.customer_id && (
                        <>
                            {selectedInvoice && (
                                <div className="bg-blue-50 rounded-xl p-3 mb-4">
                                    <p className="text-xs text-blue-600 font-medium">Balance Due on {selectedInvoice.invoice_no}</p>
                                    <p className="text-xl font-bold text-gray-800">
                                        Rs {Number(selectedInvoice.balance_due).toLocaleString()}
                                    </p>
                                </div>
                            )}

                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Amount (Rs) <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="number"
                                    value={form.amount}
                                    onChange={e => setForm({ ...form, amount: e.target.value })}
                                    placeholder="Enter amount"
                                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                                />
                            </div>

                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Payment Method <span className="text-red-500">*</span>
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    {['cash', 'bank_transfer', 'cheque'].map(m => (
                                        <button
                                            key={m}
                                            onClick={() => setForm({ ...form, method: m })}
                                            className={`py-2.5 rounded-xl text-xs font-medium transition-all border ${form.method === m
                                                ? 'bg-green-500 text-white border-green-500'
                                                : 'border-gray-200 text-gray-600 hover:border-gray-300'
                                                }`}
                                        >
                                            {m === 'cash' ? '💵 Cash' : m === 'bank_transfer' ? '🏦 Bank' : '📄 Cheque'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                                <input
                                    type="date"
                                    value={form.date}
                                    onChange={e => setForm({ ...form, date: e.target.value })}
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
                        </>
                    )}

                    <div className="flex gap-3 mt-2">
                        <button
                            onClick={() => setShowAdd(false)}
                            className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleCreate}
                            disabled={!form.customer_id || !form.amount}
                            className="flex-1 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
                        >
                            <Check size={16} />
                            Record Payment
                        </button>
                    </div>
                </Modal>
            )}

            {/* ── Allocate Payment Modal ── */}
            {showAllocate && allocatingPayment && (
                <Modal title="Allocate Payment to Invoice" onClose={() => setShowAllocate(false)}>
                    <div className="mb-4 bg-orange-50 rounded-xl p-4 border border-orange-100">
                        <div className="flex justify-between items-start mb-2">
                            <div>
                                <p className="text-xs text-orange-600 font-bold uppercase tracking-wider">Unallocated Payment</p>
                                <p className="text-lg font-bold text-gray-800">{allocatingPayment.receipt_no}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-lg font-bold text-green-600">Rs {Number(allocatingPayment.amount).toLocaleString()}</p>
                            </div>
                        </div>
                        <p className="text-sm text-gray-600">{allocatingPayment.customer_name}</p>
                    </div>

                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-3">
                            Select Invoice to Link <span className="text-red-500">*</span>
                        </label>
                        {customerInvoices.length > 0 ? (
                            <div className="space-y-2">
                                {customerInvoices.map(inv => (
                                    <div
                                        key={inv.invoice_id}
                                        onClick={() => setAllocForm({ invoice_id: inv.invoice_id })}
                                        className={`flex justify-between items-center p-4 rounded-xl border cursor-pointer transition-all ${allocForm.invoice_id === inv.invoice_id
                                            ? 'border-green-500 bg-green-50 shadow-sm'
                                            : 'border-gray-200 hover:border-gray-300'
                                            }`}
                                    >
                                        <div>
                                            <p className="text-sm font-bold text-gray-800">{inv.invoice_no}</p>
                                            <p className="text-xs text-gray-400">Due Date: {new Date(inv.due_date).toLocaleDateString()}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-bold text-red-600">Rs {Number(inv.balance_due).toLocaleString()}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-6 bg-gray-50 rounded-2xl">
                                <AlertCircle size={32} className="mx-auto text-gray-300 mb-2" />
                                <p className="text-sm text-gray-500">No unpaid invoices found that can accommodate this payment amount.</p>
                            </div>
                        )}
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={() => setShowAllocate(false)}
                            className="flex-1 border border-gray-200 text-gray-600 py-3 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleAllocate}
                            disabled={!allocForm.invoice_id}
                            className="flex-1 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-3 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
                        >
                            <Link size={16} />
                            Link Payment
                        </button>
                    </div>
                </Modal>
            )}

            {/* ── Customer Payment History Modal ── */}
            {showLedger && (
                <Modal title="Customer Payment History" onClose={() => { setShowLedger(false); setLedgerData(null); }} wide>
                    {ledgerLoading ? (
                        <div className="flex justify-center py-8">
                            <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    ) : ledgerData ? (
                        <div className="space-y-4">
                            <div className="bg-gray-50 rounded-xl p-4 flex justify-between">
                                <div>
                                    <p className="font-semibold text-gray-800">{ledgerData.customer?.name}</p>
                                    <p className="text-xs text-gray-400 mt-1">{ledgerData.payment_count} payments recorded</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-gray-400">Total Paid</p>
                                    <p className="text-xl font-bold text-green-600">
                                        Rs {Number(ledgerData.total_paid || 0).toLocaleString()}
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                {ledgerData.payments?.map(pay => (
                                    <div key={pay.payment_id} className="flex justify-between items-center bg-gray-50 rounded-xl px-4 py-3">
                                        <div>
                                            <p className="text-sm font-medium text-gray-800">{pay.receipt_no}</p>
                                            <p className="text-xs text-gray-400">
                                                {new Date(pay.date).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                {' · '}{pay.invoice_no}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-bold text-green-600">
                                                Rs {Number(pay.amount).toLocaleString()}
                                            </p>
                                            <MethodBadge method={pay.method} />
                                        </div>
                                    </div>
                                ))}
                                {(!ledgerData.payments || ledgerData.payments.length === 0) && (
                                    <p className="text-center text-gray-400 py-4">No payments found</p>
                                )}
                            </div>
                        </div>
                    ) : null}
                </Modal>
            )}

        </div>
    );
}