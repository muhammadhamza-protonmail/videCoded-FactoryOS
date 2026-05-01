'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getCustomerLedger } from '../../../../lib/api';
import { ArrowLeft, TrendingUp, TrendingDown, CreditCard } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function CustomerLedgerPage() {
    const { id } = useParams();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetch = async () => {
            try {
                const res = await getCustomerLedger(id);
                setData(res.data);
            } catch (err) {
                toast.error('Failed to load ledger');
            } finally {
                setLoading(false);
            }
        };
        fetch();
    }, [id]);

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
    );

    if (!data) return (
        <div className="text-center py-12 text-gray-400">Customer not found</div>
    );

    const { customer, ledger, balance_due } = data;

    return (
        <div className="space-y-6">

            {/* ── Header ── */}
            <div className="flex items-center gap-4">
                <Link href="/customers">
                    <button className="w-9 h-9 bg-white border border-gray-200 rounded-xl flex items-center justify-center hover:bg-gray-50 transition-colors">
                        <ArrowLeft size={18} className="text-gray-600" />
                    </button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">{customer.name}</h1>
                    <p className="text-gray-400 text-sm">{customer.phone} · {customer.address}</p>
                </div>
            </div>

            {/* ── Customer Stats ── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-50 rounded-2xl p-5">
                    <p className="text-xs text-blue-600 font-medium uppercase tracking-wider mb-2">Credit Limit</p>
                    <p className="text-2xl font-bold text-gray-800">
                        Rs {Number(customer.credit_limit).toLocaleString()}
                    </p>
                </div>
                <div className={`${Number(balance_due) > 0 ? 'bg-red-50' : 'bg-green-50'} rounded-2xl p-5`}>
                    <p className={`text-xs font-medium uppercase tracking-wider mb-2 ${Number(balance_due) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        Balance Due
                    </p>
                    <p className="text-2xl font-bold text-gray-800">
                        Rs {Number(balance_due).toLocaleString()}
                    </p>
                </div>
                <div className="bg-purple-50 rounded-2xl p-5">
                    <p className="text-xs text-purple-600 font-medium uppercase tracking-wider mb-2">Total Transactions</p>
                    <p className="text-2xl font-bold text-gray-800">{ledger.length}</p>
                </div>
            </div>

            {/* ── Ledger Table ── */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-100">
                    <h2 className="font-semibold text-gray-800">Account Ledger</h2>
                    <p className="text-gray-400 text-sm mt-1">Complete transaction history with running balance</p>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-100">
                                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">#</th>
                                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Date</th>
                                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Description</th>
                                <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Debit (Rs)</th>
                                <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Credit (Rs)</th>
                                <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Balance (Rs)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {ledger.map((entry, index) => (
                                <tr key={index} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 text-sm text-gray-400">{index + 1}</td>
                                    <td className="px-6 py-4 text-sm text-gray-600">
                                        {new Date(entry.date).toLocaleDateString('en-PK', {
                                            day: 'numeric', month: 'short', year: 'numeric'
                                        })}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${entry.type === 'invoice'
                                                    ? 'bg-red-50'
                                                    : 'bg-green-50'
                                                }`}>
                                                {entry.type === 'invoice'
                                                    ? <TrendingUp size={14} className="text-red-500" />
                                                    : <TrendingDown size={14} className="text-green-500" />
                                                }
                                            </div>
                                            <span className="text-sm text-gray-700">{entry.description}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        {Number(entry.debit) > 0 ? (
                                            <span className="text-sm font-medium text-red-600">
                                                {Number(entry.debit).toLocaleString()}
                                            </span>
                                        ) : (
                                            <span className="text-gray-300 text-sm">—</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        {Number(entry.credit) > 0 ? (
                                            <span className="text-sm font-medium text-green-600">
                                                {Number(entry.credit).toLocaleString()}
                                            </span>
                                        ) : (
                                            <span className="text-gray-300 text-sm">—</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <span className={`text-sm font-bold ${Number(entry.running_balance) > 0
                                                ? 'text-red-600'
                                                : 'text-green-600'
                                            }`}>
                                            {Number(entry.running_balance).toLocaleString()}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {ledger.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                                        <CreditCard size={40} className="mx-auto mb-3 opacity-30" />
                                        <p>No transactions yet</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* ── Balance Footer ── */}
                {ledger.length > 0 && (
                    <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end">
                        <div className="text-right">
                            <p className="text-sm text-gray-500">Closing Balance</p>
                            <p className={`text-2xl font-bold ${Number(balance_due) > 0 ? 'text-red-600' : 'text-green-600'
                                }`}>
                                Rs {Number(balance_due).toLocaleString()}
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}