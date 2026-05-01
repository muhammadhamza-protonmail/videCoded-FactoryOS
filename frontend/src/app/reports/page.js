'use client';
import { useEffect, useState, useMemo } from 'react';
import { 
    BarChart3, Download, FileText, 
    Users, ShoppingCart, Package, Warehouse,
    ArrowRight, Loader2, Calendar, TrendingUp, DollarSign, Activity
} from 'lucide-react';
import { 
    getCustomers, getVendors, 
    getProducts, getRawMaterials,
    getInvoices, getInventoryMovements, getProductionLogs
} from '../../../lib/api';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend
} from 'recharts';

export default function ReportsPage() {
    const [loading, setLoading] = useState(false);
    const [downloadingId, setDownloadingId] = useState(null);

    // Dashboard Data
    const [dashboardData, setDashboardData] = useState({
        invoices: [],
        productionLogs: []
    });

    // Date Filters
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setMonth(d.getMonth() - 1);
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

    // Custom Filters for Reports
    const [vendors, setVendors] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [selectedVendorId, setSelectedVendorId] = useState('');
    const [selectedCustomerId, setSelectedCustomerId] = useState('');

    // Fetch Initial Dashboard & Dropdown Data
    useEffect(() => {
        const fetchDashboardInfo = async () => {
            setLoading(true);
            try {
                const [iRes, pRes, vRes, cRes] = await Promise.all([
                    getInvoices(),
                    getProductionLogs(),
                    getVendors(),
                    getCustomers()
                ]);
                setDashboardData({
                    invoices: iRes.data || [],
                    productionLogs: pRes.data || []
                });
                setVendors(vRes.data || []);
                setCustomers(cRes.data || []);
            } catch (err) {
                toast.error('Failed to load dashboard data');
            } finally {
                setLoading(false);
            }
        };
        fetchDashboardInfo();
    }, []);

    // Filter functions
    const isDateInRange = (dateStr) => {
        if (!dateStr) return false;
        const d = new Date(dateStr);
        d.setHours(0,0,0,0);
        const start = startDate ? new Date(startDate) : new Date(0);
        start.setHours(0,0,0,0);
        const end = endDate ? new Date(endDate) : new Date();
        end.setHours(23,59,59,999);
        return d >= start && d <= end;
    };

    // Calculate KPIs based on Date Range
    const kpis = useMemo(() => {
        const filteredInvoices = dashboardData.invoices.filter(i => isDateInRange(i.date));
        const filteredLogs = dashboardData.productionLogs.filter(l => isDateInRange(l.date));

        const sales = filteredInvoices.reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0);
        const collected = filteredInvoices.reduce((sum, inv) => sum + Number(inv.amount_paid || 0), 0);
        
        const prodSales = filteredLogs.reduce((sum, log) => sum + Number(log.total_sale_value || 0), 0);
        const prodCosts = filteredLogs.reduce((sum, log) => 
            sum + Number(log.mat_cost || 0) + Number(log.elec_cost || 0) + Number(log.shift_expense || 0) + Number(log.other_expense || 0), 0);
        const profit = prodSales - prodCosts;

        return { sales, collected, profit };
    }, [dashboardData, startDate, endDate]);

    // Chart Data
    const chartData = useMemo(() => {
        const filteredLogs = dashboardData.productionLogs.filter(l => isDateInRange(l.date));
        // Group by Date
        const grouped = filteredLogs.reduce((acc, log) => {
            const date = log.date.split('T')[0];
            if (!acc[date]) acc[date] = { date, Sales: 0, Cost: 0 };
            acc[date].Sales += Number(log.total_sale_value || 0);
            acc[date].Cost += (Number(log.mat_cost || 0) + Number(log.elec_cost || 0) + Number(log.shift_expense || 0) + Number(log.other_expense || 0));
            return acc;
        }, {});
        return Object.values(grouped).sort((a, b) => new Date(a.date) - new Date(b.date));
    }, [dashboardData, startDate, endDate]);

    // ── PDF Generation Helpers ──
    const formatMoney = (value) => `Rs ${Number(value || 0).toLocaleString()}`;
    const formatDate = (value) => value ? new Date(value).toLocaleDateString('en-PK') : '—';
    const formatRemarks = (value) => typeof value === 'string' && value.trim() ? value.trim() : 'No remarks';

    const sectionTitle = (doc, text) => {
        const nextY = (doc.lastAutoTable?.finalY || 45) + 10;
        doc.setFontSize(13);
        doc.setTextColor(20);
        doc.text(text, 14, nextY);
        return nextY + 4;
    };

    const addHeader = (doc, title) => {
        const pageWidth = doc.internal.pageSize.width;
        
        // Modern Header Banner
        doc.setFillColor(30, 27, 75); // Dark Indigo bg-slate-900
        doc.rect(0, 0, pageWidth, 45, 'F');
        
        // Company Name
        doc.setFont("helvetica", "bold");
        doc.setFontSize(22);
        doc.setTextColor(255, 255, 255);
        doc.text("FACTORY MANAGEMENT SYSTEM", 14, 24);
        
        // Subtitle
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(165, 180, 252); // Indigo-300
        doc.text("AUTOMATED INTELLIGENCE REPORT", 14, 32);
        
        // Report Title
        doc.setFontSize(20);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(17, 24, 39); // Gray 900
        doc.text(title, 14, 60);
        
        // Metadata block
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(107, 114, 128);
        doc.text(`Generated:`, 14, 68);
        doc.setFont("helvetica", "normal");
        doc.text(`${new Date().toLocaleString()}`, 35, 68);
        
        if (startDate && endDate) {
            doc.setFont("helvetica", "bold");
            doc.text(`Period:`, 14, 73);
            doc.setFont("helvetica", "normal");
            doc.text(`${formatDate(startDate)}  to  ${formatDate(endDate)}`, 35, 73);
            return 85;
        }
        return 80; // startY for table
    };

    const addFooter = (doc) => {
        const pageCount = doc.internal.getNumberOfPages();
        const pageWidth = doc.internal.pageSize.width;
        const pageHeight = doc.internal.pageSize.height;
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            
            // Footer line
            doc.setDrawColor(229, 231, 235); // Gray-200
            doc.setLineWidth(0.5);
            doc.line(14, pageHeight - 15, pageWidth - 14, pageHeight - 15);
            
            // Footer text
            doc.setFontSize(8);
            doc.setFont("helvetica", "italic");
            doc.setTextColor(156, 163, 175); // Gray-400
            doc.text(`CONFIDENTIAL - Factory Management System`, 14, pageHeight - 8);
            
            // Page number
            doc.text(`Page ${i} of ${pageCount}`, pageWidth - 14, pageHeight - 8, { align: 'right' });
        }
    };

    // ── On-Demand Data Fetching & PDF Logic ──
    const downloadPDF = async (type) => {
        setDownloadingId(type);
        const doc = new jsPDF();
        let title = "";
        let head = [];
        let body = [];
        let summaryLines = [];
        let startY = 55;

        try {
            // Fetch necessary data dynamically
            if (type === 'customers') {
                const res = await getCustomers();
                const customers = res.data;
                title = "Customer Master List";
                head = [['ID', 'Name', 'Phone', 'Address', 'Balance Due', 'Credit Limit', 'Remarks']];
                body = customers.map(c => [
                    c.customer_id, c.name, c.phone || '—', c.address || '—', 
                    formatMoney(c.balance_due), formatMoney(c.credit_limit), formatRemarks(c.remarks)
                ]);
            } 
            else if (type === 'vendors') {
                const res = await getVendors();
                const vendors = res.data;
                title = "Vendor Master List";
                head = [['ID', 'Name', 'Phone', 'Email', 'Address', 'Remarks']];
                body = vendors.map(v => [
                    v.vendor_id, v.name, v.phone || '—', v.email || '—', v.address || '—', formatRemarks(v.remarks)
                ]);
            }
            else if (type === 'products') {
                const res = await getProducts();
                title = "Product Inventory Report";
                head = [['ID', 'Name', 'Unit', 'Stock', 'Reorder', 'Sale Price', 'Remarks']];
                body = res.data.map(p => [
                    p.product_id, p.name, p.unit, p.current_stock, p.reorder_level, formatMoney(p.sale_price), formatRemarks(p.remarks)
                ]);
            }
            else if (type === 'materials') {
                const res = await getRawMaterials();
                title = "Raw Materials Inventory Report";
                head = [['ID', 'Name', 'Vendor', 'Unit', 'Stock', 'Cost Price', 'Remarks']];
                body = res.data.map(m => [
                    m.material_id, m.name, m.vendor_name || '—', m.unit, m.current_stock, formatMoney(m.cost_per_unit), formatRemarks(m.remarks)
                ]);
            }
            else if (type === 'sales') {
                const res = await getInvoices();
                let invoices = res.data.filter(inv => isDateInRange(inv.date));
                if (selectedCustomerId) {
                    invoices = invoices.filter(inv => inv.customer_id === selectedCustomerId);
                }
                title = "Sales Report";
                head = [['Invoice #', 'Date', 'Customer', 'Total Sale', 'Paid', 'Balance', 'Status']];
                body = invoices.map(inv => [
                    inv.invoice_no || inv.invoice_id, formatDate(inv.date), inv.customer_name || '—',
                    formatMoney(inv.total_amount), formatMoney(inv.amount_paid), formatMoney(inv.balance_due), inv.status || 'unpaid'
                ]);
                const totalSales = invoices.reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0);
                const totalCollected = invoices.reduce((sum, inv) => sum + Number(inv.amount_paid || 0), 0);
                summaryLines = [
                    `Total Invoices: ${invoices.length}`,
                    `Total Sales: ${formatMoney(totalSales)}`,
                    `Collected: ${formatMoney(totalCollected)}`
                ];
            }
            else if (type === 'vendorPurchases') {
                const [mRes, matRes] = await Promise.all([getInventoryMovements(), getRawMaterials()]);
                const materials = matRes.data;
                let movements = mRes.data
                    .filter(movement => movement.item_type === 'raw_material' && movement.type === 'IN' && isDateInRange(movement.date));
                
                title = "Vendor Purchase History";
                
                if (selectedVendorId) {
                    const vendorMaterials = materials.filter(m => m.vendor_id === selectedVendorId).map(m => m.material_id);
                    movements = movements.filter(mv => vendorMaterials.includes(mv.item_id));
                    const vName = vendors.find(v => v.vendor_id === selectedVendorId)?.name;
                    if (vName) title += ` - ${vName}`;
                }
                
                head = [['Date', 'Vendor', 'Material', 'Quantity', 'Unit', 'Unit Price', 'Amount']];
                body = movements.sort((a, b) => new Date(b.date) - new Date(a.date)).map(movement => {
                    const material = materials.find(item => item.material_id === movement.item_id);
                    const unitPrice = movement.unit_price ?? material?.cost_per_unit ?? 0;
                    const amount = movement.total_amount ?? (Number(movement.quantity || 0) * Number(unitPrice || 0));
                    return [
                        formatDate(movement.date), material?.vendor_name || '—', material?.name || movement.item_id || '—',
                        Number(movement.quantity || 0).toLocaleString(), movement.unit || material?.unit || '—',
                        formatMoney(unitPrice), formatMoney(amount)
                    ];
                });
            }
            else if (type === 'pandl') {
                const res = await getProductionLogs();
                const logs = res.data.filter(log => isDateInRange(log.date));
                title = "Profit & Loss Statement";
                
                const totalSales = logs.reduce((sum, log) => sum + Number(log.total_sale_value || 0), 0);
                const matCost = logs.reduce((sum, log) => sum + Number(log.mat_cost || 0), 0);
                const elecCost = logs.reduce((sum, log) => sum + Number(log.elec_cost || 0), 0);
                const shiftExp = logs.reduce((sum, log) => sum + Number(log.shift_expense || 0), 0);
                const otherExp = logs.reduce((sum, log) => sum + Number(log.other_expense || 0), 0);
                const totalCost = matCost + elecCost + shiftExp + otherExp;
                const netProfit = totalSales - totalCost;

                startY = addHeader(doc, title);
                
                autoTable(doc, {
                    startY,
                    head: [['Financial Metric', 'Amount']],
                    body: [
                        ['Gross Revenue (Production Sales)', formatMoney(totalSales)],
                        ['Cost of Goods Sold (Materials)', formatMoney(matCost)],
                        ['Gross Profit', formatMoney(totalSales - matCost)],
                        ['Operating Expenses', ''],
                        ['  - Electricity Cost', formatMoney(elecCost)],
                        ['  - Shift Expenses', formatMoney(shiftExp)],
                        ['  - Other Expenses', formatMoney(otherExp)],
                        ['Total Operating Expenses', formatMoney(elecCost + shiftExp + otherExp)],
                        ['Net Margin (Profit)', formatMoney(netProfit)],
                    ],
                    theme: 'grid',
                    headStyles: { fillColor: [22, 101, 52] },
                    styles: { fontSize: 10, cellPadding: 4 },
                    willDrawCell: function(data) {
                        if (data.row.index === 2 || data.row.index === 8) {
                            doc.setFont(undefined, 'bold');
                            if (data.row.index === 8) {
                                doc.setTextColor(netProfit >= 0 ? 0 : 255, netProfit >= 0 ? 128 : 0, 0);
                            }
                        }
                    }
                });
                
                addFooter(doc);
                doc.save(`Profit_and_Loss_${new Date().toISOString().split('T')[0]}.pdf`);
                toast.success('P&L Statement downloaded!');
                setDownloadingId(null);
                return;
            }
            else if (type === 'grand') {
                const [cRes, vRes, pRes, mRes, iRes, mvRes, plRes] = await Promise.all([
                    getCustomers(), getVendors(), getProducts(), getRawMaterials(),
                    getInvoices(), getInventoryMovements(), getProductionLogs()
                ]);
                
                const gCustomers = cRes.data;
                const gVendors = vRes.data;
                const gProducts = pRes.data;
                const gMaterials = mRes.data;
                const gInvoices = iRes.data.filter(inv => isDateInRange(inv.date));
                const gMovements = mvRes.data.filter(mv => isDateInRange(mv.date));
                const gLogs = plRes.data.filter(log => isDateInRange(log.date));

                title = "Grand Business Report";

                // Calculations
                const gTotalSales = gInvoices.reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0);
                const gTotalCollected = gInvoices.reduce((sum, inv) => sum + Number(inv.amount_paid || 0), 0);
                const gTotalOutstanding = gInvoices.reduce((sum, inv) => sum + Number(inv.balance_due || 0), 0);
                
                const gActiveReceivables = gInvoices.filter(inv => Number(inv.balance_due || 0) > 0);
                const gPaidInvoicesCount = gInvoices.filter(inv => String(inv.status || '').toLowerCase() === 'paid').length;
                
                const gTotalPayables = gVendors.reduce((sum, v) => sum + Number(v.current_payable || 0), 0);
                
                const gTotalPurchases = gMovements
                    .filter(mv => mv.item_type === 'raw_material' && mv.type === 'IN')
                    .reduce((sum, mv) => {
                        const mat = gMaterials.find(item => item.material_id === mv.item_id);
                        const unitPrice = mv.unit_price ?? mat?.cost_per_unit ?? 0;
                        const amount = mv.total_amount ?? (Number(mv.quantity || 0) * Number(unitPrice || 0));
                        return sum + Number(amount || 0);
                    }, 0);

                const gTotalProdSales = gLogs.reduce((sum, log) => sum + Number(log.total_sale_value || 0), 0);
                const gTotalProdCosts = gLogs.reduce((sum, log) => 
                    sum + Number(log.mat_cost || 0) + Number(log.elec_cost || 0) + Number(log.shift_expense || 0) + Number(log.other_expense || 0), 0);
                const gNetProfit = gTotalProdSales - gTotalProdCosts;

                const getOverdueDays = (dueDate, balanceDue) => {
                    if (!dueDate || Number(balanceDue || 0) <= 0) return 0;
                    const due = new Date(dueDate);
                    const currentDay = new Date();
                    currentDay.setHours(0, 0, 0, 0);
                    due.setHours(0, 0, 0, 0);
                    const diffMs = currentDay - due;
                    return diffMs > 0 ? Math.floor(diffMs / (1000 * 60 * 60 * 24)) : 0;
                };

                const getLatestVendorPurchaseDate = (vendorId) => {
                    const materialIds = gMaterials.filter(m => m.vendor_id === vendorId).map(m => m.material_id);
                    if (materialIds.length === 0) return '—';
                    const relevantDates = gMovements
                        .filter(mv => mv.item_type === 'raw_material' && mv.type === 'IN' && materialIds.includes(mv.item_id) && mv.date)
                        .map(mv => mv.date)
                        .sort((a, b) => new Date(b) - new Date(a));
                    return relevantDates.length > 0 ? formatDate(relevantDates[0]) : '—';
                };

                const topCustomers = Object.values(
                    gInvoices.reduce((acc, inv) => {
                        const key = inv.customer_id || inv.customer_name || 'unknown';
                        if (!acc[key]) acc[key] = { customer: inv.customer_name || inv.customer_id || '—', sales: 0, paid: 0, balance: 0 };
                        acc[key].sales += Number(inv.total_amount || 0);
                        acc[key].paid += Number(inv.amount_paid || 0);
                        acc[key].balance += Number(inv.balance_due || 0);
                        return acc;
                    }, {})
                ).sort((a, b) => b.sales - a.sales).slice(0, 5);

                const topProducts = Object.values(
                    gLogs.reduce((acc, log) => {
                        const key = log.product_id || log.product_name || 'unknown';
                        if (!acc[key]) acc[key] = { product: log.product_name || log.product_id || '—', units: 0, sales: 0, profit: 0 };
                        const sale = Number(log.total_sale_value || 0);
                        const cost = Number(log.mat_cost || 0) + Number(log.elec_cost || 0) + Number(log.shift_expense || 0) + Number(log.other_expense || 0);
                        acc[key].units += Number(log.units_produced || 0);
                        acc[key].sales += sale;
                        acc[key].profit += sale - cost;
                        return acc;
                    }, {})
                ).sort((a, b) => b.sales - a.sales).slice(0, 5);

                const topPayableVendors = [...gVendors].sort((a, b) => Number(b.current_payable || 0) - Number(a.current_payable || 0)).slice(0, 5);

                startY = addHeader(doc, title);

                autoTable(doc, {
                    startY,
                    head: [['Executive Summary', 'Value']],
                    body: [
                        ['Customers', gCustomers.length],
                        ['Vendors', gVendors.length],
                        ['Products', gProducts.length],
                        ['Raw Materials', gMaterials.length],
                        ['Invoices in Period', gInvoices.length],
                        ['Paid Invoices in Period', gPaidInvoicesCount],
                        ['Open Receivables', gActiveReceivables.length],
                        ['Total Sales in Period', formatMoney(gTotalSales)],
                        ['Collections in Period', formatMoney(gTotalCollected)],
                        ['Outstanding', formatMoney(gTotalOutstanding)],
                        ['Total Vendor Payables', formatMoney(gTotalPayables)],
                        ['Purchase Value in Period', formatMoney(gTotalPurchases)],
                        ['Production Sales in Period', formatMoney(gTotalProdSales)],
                        ['Net Profit in Period', formatMoney(gNetProfit)],
                    ],
                    theme: 'grid',
                    headStyles: { fillColor: [22, 101, 52], textColor: 255 },
                    styles: { fontSize: 9, cellPadding: 4, lineColor: [229, 231, 235], lineWidth: 0.1 },
                });

                autoTable(doc, {
                    startY: sectionTitle(doc, 'Receivables Snapshot'),
                    head: [['Invoice #', 'Customer', 'Due Date', 'Balance', 'Overdue']],
                    body: gActiveReceivables.slice(0, 10).map(inv => [
                        inv.invoice_no || inv.invoice_id, inv.customer_name || '—', formatDate(inv.due_date),
                        formatMoney(inv.balance_due),
                        getOverdueDays(inv.due_date, inv.balance_due) > 0 ? `${getOverdueDays(inv.due_date, inv.balance_due)} days` : 'Current'
                    ]),
                    theme: 'striped',
                    headStyles: { fillColor: [190, 24, 93], textColor: 255 },
                    styles: { fontSize: 8.5, cellPadding: 3, lineColor: [229, 231, 235], lineWidth: 0.1 },
                    alternateRowStyles: { fillColor: [253, 242, 248] }
                });

                autoTable(doc, {
                    startY: sectionTitle(doc, 'Top Customers'),
                    head: [['Customer', 'Sales', 'Collected', 'Outstanding']],
                    body: topCustomers.map(item => [item.customer, formatMoney(item.sales), formatMoney(item.paid), formatMoney(item.balance)]),
                    theme: 'striped',
                    headStyles: { fillColor: [8, 145, 178], textColor: 255 },
                    styles: { fontSize: 8.5, cellPadding: 3, lineColor: [229, 231, 235], lineWidth: 0.1 },
                    alternateRowStyles: { fillColor: [236, 254, 255] }
                });

                autoTable(doc, {
                    startY: sectionTitle(doc, 'Top Products'),
                    head: [['Product', 'Units Produced', 'Sales', 'Profit']],
                    body: topProducts.map(item => [item.product, Number(item.units).toLocaleString(), formatMoney(item.sales), formatMoney(item.profit)]),
                    theme: 'striped',
                    headStyles: { fillColor: [37, 99, 235], textColor: 255 },
                    styles: { fontSize: 8.5, cellPadding: 3, lineColor: [229, 231, 235], lineWidth: 0.1 },
                    alternateRowStyles: { fillColor: [239, 246, 255] }
                });

                autoTable(doc, {
                    startY: sectionTitle(doc, 'Top Vendor Payables'),
                    head: [['Vendor', 'Last Purchase', 'Payment Terms', 'Current Payable']],
                    body: topPayableVendors.map(v => [v.name, getLatestVendorPurchaseDate(v.vendor_id), v.payment_terms || '—', formatMoney(v.current_payable)]),
                    theme: 'striped',
                    headStyles: { fillColor: [217, 119, 6], textColor: 255 },
                    styles: { fontSize: 8.5, cellPadding: 3, lineColor: [229, 231, 235], lineWidth: 0.1 },
                    alternateRowStyles: { fillColor: [255, 251, 235] }
                });

                autoTable(doc, {
                    startY: sectionTitle(doc, 'Recent Vendor Purchases'),
                    head: [['Date', 'Vendor', 'Material', 'Qty', 'Unit Price', 'Amount']],
                    body: gMovements.filter(mv => mv.item_type === 'raw_material' && mv.type === 'IN').sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10).map(mv => {
                        const mat = gMaterials.find(item => item.material_id === mv.item_id);
                        const unitPrice = mv.unit_price ?? mat?.cost_per_unit ?? 0;
                        const amount = mv.total_amount ?? (Number(mv.quantity || 0) * Number(unitPrice || 0));
                        return [formatDate(mv.date), mat?.vendor_name || '—', mat?.name || mv.item_id || '—', Number(mv.quantity || 0).toLocaleString(), formatMoney(unitPrice), formatMoney(amount)];
                    }),
                    theme: 'striped',
                    headStyles: { fillColor: [101, 163, 13], textColor: 255 },
                    styles: { fontSize: 8.5, cellPadding: 3, lineColor: [229, 231, 235], lineWidth: 0.1 },
                    alternateRowStyles: { fillColor: [247, 254, 231] }
                });

                autoTable(doc, {
                    startY: sectionTitle(doc, 'Recent Profit Runs'),
                    head: [['Date', 'Shift', 'Product', 'Sale', 'Cost', 'Net Profit']],
                    body: [...gLogs].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10).map(log => {
                        const sale = Number(log.total_sale_value || 0);
                        const cost = Number(log.mat_cost || 0) + Number(log.elec_cost || 0) + Number(log.shift_expense || 0) + Number(log.other_expense || 0);
                        return [formatDate(log.date), log.shift || '—', log.product_name || '—', formatMoney(sale), formatMoney(cost), formatMoney(sale - cost)];
                    }),
                    theme: 'striped',
                    headStyles: { fillColor: [21, 128, 61], textColor: 255, fontStyle: 'bold' },
                    styles: { fontSize: 8.5, cellPadding: 3, lineColor: [229, 231, 235], lineWidth: 0.1 },
                    alternateRowStyles: { fillColor: [250, 250, 250] },
                });

                addFooter(doc);
                doc.save(`Grand_Report_${new Date().toISOString().split('T')[0]}.pdf`);
                toast.success('Grand Business Report downloaded!');
                setDownloadingId(null);
                return;
            }

            startY = addHeader(doc, title);

            if (summaryLines.length > 0) {
                doc.setFontSize(10);
                doc.setTextColor(80);
                summaryLines.forEach((line, index) => {
                    doc.text(line, 14, startY + (index * 6));
                });
                startY += (summaryLines.length * 6) + 4;
            }

            autoTable(doc, {
                startY,
                head: head,
                body: body,
                theme: 'striped',
                headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold' }, // Indigo-600
                styles: { 
                    fontSize: 9, 
                    cellPadding: 4, 
                    overflow: 'linebreak',
                    lineColor: [229, 231, 235],
                    lineWidth: 0.1
                },
                alternateRowStyles: { fillColor: [249, 250, 251] }, // Gray-50
            });

            addFooter(doc);
            doc.save(`${type}_report_${new Date().toISOString().split('T')[0]}.pdf`);
            toast.success(`${title} downloaded!`);
        } catch (err) {
            console.error(err);
            toast.error('Failed to generate report');
        } finally {
            setDownloadingId(null);
        }
    };

    const reportCards = [
        { id: 'customers', label: 'Customers List', description: 'Complete directory of customers with balances and credit limits.', color: 'bg-blue-500', icon: Users },
        { id: 'vendors', label: 'Vendors List', description: 'Contact list of all raw material and service suppliers.', color: 'bg-emerald-500', icon: ShoppingCart },
        { id: 'products', label: 'Products Catalogue', description: 'Detailed list of finished goods, pricing, and stock levels.', color: 'bg-purple-500', icon: Package },
        { id: 'materials', label: 'Raw Materials', description: 'Master list of materials, stock levels, and latest purchase costs.', color: 'bg-orange-500', icon: Warehouse },
        { id: 'sales', label: 'Sales Report', description: 'Invoice-wise sales summary within the selected date range.', color: 'bg-cyan-500', icon: BarChart3, requiresDate: true, filter: 'customer' },
        { id: 'vendorPurchases', label: 'Vendor Purchases', description: 'Raw material stock-in history.', color: 'bg-lime-600', icon: Warehouse, requiresDate: true, filter: 'vendor' },
        { id: 'pandl', label: 'Profit & Loss Statement', description: 'Official P&L statement including Revenue, COGS, and Operating Expenses.', color: 'bg-slate-900', icon: FileText, requiresDate: true },
        { id: 'grand', label: 'Grand Report', description: 'One executive PDF covering sales, receivables, payables, purchases, and profit.', color: 'bg-slate-900', icon: FileText, requiresDate: true },
    ];

    return (
        <div className="space-y-6">
            {/* ── Header & Date Filters ── */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Reports & Analytics</h1>
                    <p className="text-gray-400 text-sm mt-1">Real-time insights and professional PDF reporting</p>
                </div>
                
                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center bg-gray-50 rounded-xl p-1 border border-gray-200">
                        <div className="flex items-center pl-3 pr-2 py-1.5 text-gray-500">
                            <Calendar size={16} />
                            <span className="ml-2 text-sm font-medium">Start</span>
                        </div>
                        <input 
                            type="date" 
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="bg-white border-none rounded-lg text-sm px-3 py-1.5 focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                    </div>
                    <span className="text-gray-300 font-bold">-</span>
                    <div className="flex items-center bg-gray-50 rounded-xl p-1 border border-gray-200">
                        <div className="flex items-center pl-3 pr-2 py-1.5 text-gray-500">
                            <Calendar size={16} />
                            <span className="ml-2 text-sm font-medium">End</span>
                        </div>
                        <input 
                            type="date" 
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="bg-white border-none rounded-lg text-sm px-3 py-1.5 focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                    </div>
                </div>
            </div>

            {/* ── Dashboard KPI & Chart ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-3xl p-6 text-white shadow-lg">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <p className="text-indigo-100 text-sm font-medium">Period Revenue</p>
                                <h3 className="text-3xl font-bold mt-1">Rs {(kpis.sales/1000).toFixed(1)}k</h3>
                            </div>
                            <div className="bg-white/20 p-2 rounded-xl"><DollarSign size={24} /></div>
                        </div>
                        <div className="text-sm text-indigo-100 flex items-center gap-2">
                            <ArrowRight size={14} /> Based on selected dates
                        </div>
                    </div>
                    
                    <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <p className="text-gray-500 text-sm font-medium">Collections</p>
                                <h3 className="text-2xl font-bold text-gray-800 mt-1">Rs {(kpis.collected/1000).toFixed(1)}k</h3>
                            </div>
                            <div className="bg-emerald-100 text-emerald-600 p-2 rounded-xl"><TrendingUp size={24} /></div>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2">
                            <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, (kpis.collected / (kpis.sales || 1)) * 100)}%` }}></div>
                        </div>
                    </div>

                    <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <p className="text-gray-500 text-sm font-medium">Net Profit Margin</p>
                                <h3 className="text-2xl font-bold text-gray-800 mt-1">Rs {(kpis.profit/1000).toFixed(1)}k</h3>
                            </div>
                            <div className="bg-blue-100 text-blue-600 p-2 rounded-xl"><Activity size={24} /></div>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-2 bg-white rounded-3xl border border-gray-100 shadow-sm p-6 flex flex-col">
                    <h3 className="text-lg font-bold text-gray-800 mb-6">Production Sales vs Costs</h3>
                    <div className="flex-1 min-h-[250px]">
                        {chartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#9CA3AF', fontSize: 12}} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#9CA3AF', fontSize: 12}} tickFormatter={(v) => `Rs${v/1000}k`} />
                                    <RechartsTooltip 
                                        cursor={{fill: '#F3F4F6'}}
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }}/>
                                    <Bar dataKey="Sales" fill="#4F46E5" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                    <Bar dataKey="Cost" fill="#EF4444" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 space-y-3">
                                <BarChart3 size={48} className="opacity-20" />
                                <p>No production data for this period</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Main Reports Section ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {reportCards.map((report) => (
                    <div 
                        key={report.id}
                        className="bg-white p-6 md:p-8 rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl transition-all group flex flex-col md:flex-row items-start md:items-center gap-6"
                    >
                        <div className={`${report.color} w-16 h-16 rounded-2xl flex items-center justify-center text-white shrink-0 group-hover:scale-110 transition-transform shadow-lg`}>
                            <report.icon size={32} />
                        </div>
                        
                        <div className="flex-1 w-full">
                            <h3 className="text-xl font-bold text-gray-800 mb-1">
                                {report.label}
                            </h3>
                            <p className="text-sm text-gray-400 mb-4">{report.description}</p>
                            
                            {/* Render Custom Filters if defined */}
                            {report.filter === 'vendor' && (
                                <div className="mb-4">
                                    <select 
                                        value={selectedVendorId}
                                        onChange={(e) => setSelectedVendorId(e.target.value)}
                                        className="w-full text-sm border-gray-200 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 p-2 border outline-none bg-gray-50"
                                    >
                                        <option value="">All Vendors</option>
                                        {vendors.map(v => (
                                            <option key={v.vendor_id} value={v.vendor_id}>{v.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            
                            {report.filter === 'customer' && (
                                <div className="mb-4">
                                    <select 
                                        value={selectedCustomerId}
                                        onChange={(e) => setSelectedCustomerId(e.target.value)}
                                        className="w-full text-sm border-gray-200 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 p-2 border outline-none bg-gray-50"
                                    >
                                        <option value="">All Customers</option>
                                        {customers.map(c => (
                                            <option key={c.customer_id} value={c.customer_id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <button 
                                onClick={() => downloadPDF(report.id)}
                                disabled={downloadingId === report.id || loading}
                                className="w-full md:w-auto flex items-center justify-center gap-2 bg-gray-900 hover:bg-indigo-600 disabled:bg-gray-200 disabled:text-gray-400 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all shadow-md active:scale-95"
                            >
                                {downloadingId === report.id ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                                Download PDF
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
