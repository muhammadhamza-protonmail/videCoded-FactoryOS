const pool = require('../config/db');

// ── GET all customers ──────────────────────────────────────────
const getAllCustomers = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT * FROM customers WHERE factory_id = $1 ORDER BY name ASC`,
            [req.user.factory_id]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ── GET single customer by ID ──────────────────────────────────
const getCustomerById = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            `SELECT * FROM customers WHERE customer_id = $1 AND factory_id = $2`, 
            [id, req.user.factory_id]
        );
        if (result.rows.length === 0)
            return res.status(404).json({ error: 'Customer not found' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ── CREATE new customer ────────────────────────────────────────
const createCustomer = async (req, res) => {
    try {
        const { name, phone, address, credit_limit, remarks } = req.body;

        if (!name) return res.status(400).json({ error: 'Name is required' });

        // Auto generate customer_id
        const countRes = await pool.query(`SELECT COUNT(*) as cnt FROM customers`);
        const cnt = Number(countRes.rows[0].cnt || countRes.rows[0]['COUNT(*)'] || 0);
        const newId = 'C' + String(cnt + 1).padStart(3, '0');

        const result = await pool.query(
            `INSERT INTO customers 
        (customer_id, name, phone, address, credit_limit, balance_due, status, remarks, factory_id)
       VALUES ($1, $2, $3, $4, $5, 0, 'active', $6, $7)
       RETURNING *`,
            [newId, name, phone || null, address || null, credit_limit || 0, remarks || null, req.user.factory_id]
        );

        res.status(201).json({
            message: '✅ Customer created successfully',
            customer: result.rows[0]
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ── UPDATE customer ────────────────────────────────────────────
const updateCustomer = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, phone, address, credit_limit, status, remarks } = req.body;

        const result = await pool.query(
            `UPDATE customers SET
        name         = COALESCE($1, name),
        phone        = COALESCE($2, phone),
        address      = COALESCE($3, address),
        credit_limit = COALESCE($4, credit_limit),
        status       = COALESCE($5, status),
        remarks      = COALESCE($6, remarks)
       WHERE customer_id = $7 AND factory_id = $8
       RETURNING *`,
            [name, phone, address, credit_limit, status, remarks, id, req.user.factory_id]
        );

        if (result.rows.length === 0)
            return res.status(404).json({ error: 'Customer not found' });

        res.json({
            message: '✅ Customer updated',
            customer: result.rows[0]
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ── GET customer ledger ────────────────────────────────────────
const getCustomerLedger = async (req, res) => {
    try {
        const { id } = req.params;
        const factory_id = req.user.factory_id;

        // Check customer exists
        const customer = await pool.query(
            `SELECT * FROM customers WHERE customer_id = $1 AND factory_id = $2`, 
            [id, factory_id]
        );
        if (customer.rows.length === 0)
            return res.status(404).json({ error: 'Customer not found' });

        // Get all invoices for this customer
        const invoices = await pool.query(
            `SELECT invoice_id, invoice_no, date, total_amount, amount_paid, balance_due, status
       FROM invoices 
       WHERE customer_id = $1 AND factory_id = $2
       ORDER BY date ASC`,
            [id, factory_id]
        );

        // Get all payments for this customer
        const payments = await pool.query(
            `SELECT payment_id, invoice_id, date, amount, method, receipt_no, notes
       FROM payments 
       WHERE customer_id = $1 AND factory_id = $2
       ORDER BY date ASC`,
            [id, factory_id]
        );

        const ledgerEntries = [];
        invoices.rows.forEach(inv => {
            ledgerEntries.push({
                date: inv.date,
                type: 'invoice',
                description: `Invoice ${inv.invoice_no}`,
                debit: inv.total_amount,
                credit: 0,
                reference: inv.invoice_id,
                status: inv.status,
            });
        });

        payments.rows.forEach(pay => {
            ledgerEntries.push({
                date: pay.date,
                type: 'payment',
                description: `Payment - ${pay.method} (${pay.receipt_no})`,
                debit: 0,
                credit: pay.amount,
                reference: pay.payment_id,
                notes: pay.notes,
            });
        });

        ledgerEntries.sort((a, b) => new Date(a.date) - new Date(b.date));

        let runningBalance = 0;
        ledgerEntries.forEach(entry => {
            runningBalance += Number(entry.debit) - Number(entry.credit);
            entry.running_balance = runningBalance;
        });

        res.json({
            customer: customer.rows[0],
            total_invoices: invoices.rows.length,
            total_payments: payments.rows.length,
            balance_due: customer.rows[0].balance_due,
            ledger: ledgerEntries,
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = {
    getAllCustomers,
    getCustomerById,
    createCustomer,
    updateCustomer,
    getCustomerLedger,
};