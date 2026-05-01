const pool = require('../config/db');

// ── GET all payments ───────────────────────────────────────────
const getAllPayments = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT p.*, c.name as customer_name, i.invoice_no
       FROM payments p
       LEFT JOIN customers c ON p.customer_id = c.customer_id
       LEFT JOIN invoices i ON p.invoice_id = i.invoice_id
       WHERE p.factory_id = $1
       ORDER BY p.date DESC`,
            [req.user.factory_id]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ── GET single payment ─────────────────────────────────────────
const getPaymentById = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            `SELECT p.*, c.name as customer_name, i.invoice_no
             FROM payments p
             LEFT JOIN customers c ON p.customer_id = c.customer_id
             LEFT JOIN invoices i ON p.invoice_id = i.invoice_id
             WHERE p.payment_id = $1 AND p.factory_id = $2`,
            [id, req.user.factory_id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Payment not found' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ── GET payments by invoice ────────────────────────────────────
const getPaymentsByInvoice = async (req, res) => {
    try {
        const { invoiceId } = req.params;
        const result = await pool.query(
            `SELECT * FROM payments WHERE invoice_id = $1 AND factory_id = $2 ORDER BY date DESC`,
            [invoiceId, req.user.factory_id]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ── GET payments by customer ───────────────────────────────────
const getPaymentsByCustomer = async (req, res) => {
    try {
        const { customerId } = req.params;
        const result = await pool.query(
            `SELECT * FROM payments WHERE customer_id = $1 AND factory_id = $2 ORDER BY date DESC`,
            [customerId, req.user.factory_id]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ── CREATE payment ─────────────────────────────────────────────
const createPayment = async (req, res) => {
    const client = await pool.connect();
    try {
        const { invoice_id, customer_id, date, amount, method, receipt_no, notes } = req.body;
        const factory_id = req.user.factory_id;

        if (!customer_id || !amount)
            return res.status(400).json({ error: 'customer_id and amount are required' });

        await client.query('BEGIN');

        const countRes = await client.query(`SELECT COUNT(*) as cnt FROM payments`);
        const cnt = Number(countRes.rows[0].cnt || countRes.rows[0]['COUNT(*)'] || 0);
        const newId = 'PAY' + String(cnt + 1).padStart(3, '0');

        const result = await client.query(
            `INSERT INTO payments 
        (payment_id, invoice_id, customer_id, date, amount, method, receipt_no, notes, factory_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
            [newId, invoice_id || null, customer_id, date || new Date().toISOString().split('T')[0], amount, method || 'Cash', receipt_no || null, notes || null, factory_id]
        );

        await client.query(
            `UPDATE customers SET balance_due = balance_due - $1 WHERE customer_id = $2 AND factory_id = $3`,
            [amount, customer_id, factory_id]
        );

        if (invoice_id) {
            await client.query(
                `UPDATE invoices SET 
          amount_paid = amount_paid + $1,
          balance_due = balance_due - $1,
          status = CASE WHEN (balance_due - $1) <= 0 THEN 'paid' ELSE 'partial' END
         WHERE invoice_id = $2 AND factory_id = $3`,
                [amount, invoice_id, factory_id]
            );
        }

        await client.query('COMMIT');
        res.status(201).json({ message: '✅ Payment recorded successfully', payment: result.rows[0] });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
};

// ── ALLOCATE payment (simplified) ──────────────────────────────
const allocatePayment = async (req, res) => {
    // This is often a complex operation, but we'll provide a basic implementation
    res.status(501).json({ error: 'Auto-allocation not implemented yet. Please create payment against specific invoices.' });
};

// ── DELETE payment ─────────────────────────────────────────────
const deletePayment = async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const factory_id = req.user.factory_id;

        const payment = await client.query(`SELECT * FROM payments WHERE payment_id = $1 AND factory_id = $2`, [id, factory_id]);
        if (payment.rows.length === 0) return res.status(404).json({ error: 'Payment not found' });

        await client.query('BEGIN');
        await client.query(
            `UPDATE customers SET balance_due = balance_due + $1 WHERE customer_id = $2 AND factory_id = $3`,
            [payment.rows[0].amount, payment.rows[0].customer_id, factory_id]
        );

        if (payment.rows[0].invoice_id) {
            await client.query(
                `UPDATE invoices SET 
          amount_paid = amount_paid - $1,
          balance_due = balance_due + $1,
          status = CASE WHEN amount_paid - $1 <= 0 THEN 'unpaid' ELSE 'partial' END
         WHERE invoice_id = $2 AND factory_id = $3`,
                [payment.rows[0].amount, payment.rows[0].invoice_id, factory_id]
            );
        }

        await client.query(`DELETE FROM payments WHERE payment_id = $1 AND factory_id = $2`, [id, factory_id]);
        await client.query('COMMIT');

        res.json({ message: '✅ Payment deleted & balances restored' });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
};

module.exports = { 
    getAllPayments, 
    getPaymentById, 
    getPaymentsByInvoice, 
    getPaymentsByCustomer, 
    createPayment, 
    allocatePayment, 
    deletePayment 
};