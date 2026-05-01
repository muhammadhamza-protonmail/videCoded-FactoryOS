'use client';
import { useEffect, useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar, Cell
} from 'recharts';
import {
  Users, Package, TrendingUp, CreditCard,
  AlertTriangle, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import {
  getCustomers, getProducts, getInvoices,
  getProductionLogs, getInventorySummary
} from '../../lib/api';

// ── Reusable Components ────────────────────────────────────────
function StatCard({ title, value, icon, color, sub, trend }) {
  const colors = {
    blue: { bg: 'bg-blue-50', icon: 'bg-blue-500', text: 'text-blue-600' },
    purple: { bg: 'bg-purple-50', icon: 'bg-purple-500', text: 'text-purple-600' },
    green: { bg: 'bg-green-50', icon: 'bg-green-500', text: 'text-green-600' },
    orange: { bg: 'bg-orange-50', icon: 'bg-orange-500', text: 'text-orange-600' },
  };
  const c = colors[color];
  return (
    <div className={`${c.bg} rounded-2xl p-5 border border-white shadow-sm`}>
      <div className="flex items-center justify-between mb-3">
        <div className={`${c.icon} w-10 h-10 rounded-xl flex items-center justify-center text-white`}>
          {icon}
        </div>
        {trend === 'up'
          ? <ArrowUpRight size={18} className="text-green-500" />
          : <ArrowDownRight size={18} className="text-red-500" />
        }
      </div>
      <p className="text-2xl font-bold text-gray-800 mb-1">{value}</p>
      <p className="text-sm font-medium text-gray-600">{title}</p>
      <p className={`text-xs ${c.text} mt-1 font-medium`}>{sub}</p>
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    paid: 'bg-green-100 text-green-700',
    partial: 'bg-yellow-100 text-yellow-700',
    unpaid: 'bg-red-100 text-red-700',
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${styles[status] || ''}`}>
      {status}
    </span>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────
export default function Dashboard() {
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [production, setProduction] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [c, p, i, pr] = await Promise.all([
          getCustomers().catch(() => ({ data: [] })),
          getProducts().catch(() => ({ data: [] })),
          getInvoices().catch(() => ({ data: [] })),
          getProductionLogs().catch(() => ({ data: [] })),
        ]);
        setCustomers(c.data);
        setProducts(p.data);
        setInvoices(i.data);
        setProduction(pr.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  // ── Calculations ───────────────────────────────────────────────
  const totalReceivables = customers.reduce(
    (sum, c) => sum + Number(c.balance_due || 0), 0
  );
  const unpaidInvoices = invoices.filter(i => i.status === 'unpaid').length;
  const partialInvoices = invoices.filter(i => i.status === 'partial').length;
  const paidInvoices = invoices.filter(i => i.status === 'paid').length;
  const lowStockCount = products.filter(
    p => Number(p.current_stock) <= Number(p.reorder_level)
  ).length;
  const totalProfit = production.reduce(
    (sum, p) => sum + Number(p.net_profit || 0), 0
  );

  // ── Chart Data ─────────────────────────────────────────────────
  const productionChartData = production.slice(-7).map(log => ({
    date: new Date(log.date).toLocaleDateString('en-PK', { month: 'short', day: 'numeric' }),
    profit: Number(log.net_profit || 0),
    sale: Number(log.total_sale_value || 0),
  }));

  const invoiceChartData = [
    { name: 'Unpaid', value: unpaidInvoices, fill: '#f87171' },
    { name: 'Partial', value: partialInvoices, fill: '#fbbf24' },
    { name: 'Paid', value: paidInvoices, fill: '#4ade80' },
  ];

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-500">Loading dashboard...</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Total Customers"
          value={customers.length}
          icon={<Users size={22} />}
          color="blue"
          sub={`Rs ${totalReceivables.toLocaleString()} receivable`}
          trend="up"
        />
        <StatCard
          title="Total Products"
          value={products.length}
          icon={<Package size={22} />}
          color="purple"
          sub={`${lowStockCount} low stock alerts`}
          trend={lowStockCount > 0 ? 'down' : 'up'}
        />
        <StatCard
          title="Total Net Profit"
          value={`Rs ${totalProfit.toLocaleString()}`}
          icon={<TrendingUp size={22} />}
          color="green"
          sub={`${production.length} production runs`}
          trend="up"
        />
        <StatCard
          title="Pending Invoices"
          value={unpaidInvoices + partialInvoices}
          icon={<CreditCard size={22} />}
          color="orange"
          sub={`${paidInvoices} invoices paid`}
          trend={unpaidInvoices > 0 ? 'down' : 'up'}
        />
      </div>

      {/* ── Charts Row ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Production Profit Chart */}
        <div className="xl:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-semibold text-gray-800">Production Profit</h3>
              <p className="text-gray-400 text-sm">Last 7 production runs</p>
            </div>
            <span className="bg-green-100 text-green-700 text-xs font-medium px-3 py-1 rounded-full">
              Net Profit
            </span>
          </div>
          {productionChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={productionChartData}>
                <defs>
                  <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="saleGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(val) => `Rs ${Number(val).toLocaleString()}`}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                />
                <Area type="monotone" dataKey="sale" stroke="#0ea5e9" fill="url(#saleGrad)" strokeWidth={2} name="Sale Value" />
                <Area type="monotone" dataKey="profit" stroke="#22c55e" fill="url(#profitGrad)" strokeWidth={2} name="Net Profit" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-52 text-gray-400">
              <p>No production data yet</p>
            </div>
          )}
        </div>

        {/* Invoice Status Chart */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="mb-6">
            <h3 className="font-semibold text-gray-800">Invoice Status</h3>
            <p className="text-gray-400 text-sm">Current breakdown</p>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={invoiceChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
              />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {invoiceChartData.map((entry, index) => (
                  <Cell key={index} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Bottom Row ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* Recent Invoices */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">Recent Invoices</h3>
            <a href="/invoices" className="text-green-600 text-sm font-medium hover:underline">
              View all →
            </a>
          </div>
          <div className="space-y-3">
            {invoices.slice(0, 5).map(inv => (
              <div key={inv.invoice_id} className="flex items-center justify-between py-2 border-b border-gray-50">
                <div>
                  <p className="text-sm font-medium text-gray-700">{inv.customer_name}</p>
                  <p className="text-xs text-gray-400">{inv.invoice_no}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-800">
                    Rs {Number(inv.total_amount).toLocaleString()}
                  </p>
                  <StatusBadge status={inv.status} />
                </div>
              </div>
            ))}
            {invoices.length === 0 && (
              <p className="text-gray-400 text-sm text-center py-4">No invoices yet</p>
            )}
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">Stock Alerts</h3>
            <a href="/inventory" className="text-green-600 text-sm font-medium hover:underline">
              View all →
            </a>
          </div>
          <div className="space-y-3">
            {products
              .filter(p => Number(p.current_stock) <= Number(p.reorder_level))
              .slice(0, 5)
              .map(p => (
                <div key={p.product_id} className="flex items-center gap-3 py-2 border-b border-gray-50">
                  <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                    <AlertTriangle size={16} className="text-red-500" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-700">{p.name}</p>
                    <p className="text-xs text-gray-400">
                      Stock: {p.current_stock} / Reorder at: {p.reorder_level}
                    </p>
                  </div>
                  <span className="bg-red-100 text-red-600 text-xs font-medium px-2 py-1 rounded-full">
                    Low Stock
                  </span>
                </div>
              ))}
            {products.filter(p => Number(p.current_stock) <= Number(p.reorder_level)).length === 0 && (
              <div className="flex items-center gap-3 py-4">
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                  <Package size={16} className="text-green-500" />
                </div>
                <p className="text-gray-500 text-sm">All products well stocked ✅</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}