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
            `SELECT p.*, i.invoice_no
             FROM payments p
             LEFT JOIN invoices i ON p.invoice_id = i.invoice_id
             WHERE p.customer_id = $1 AND p.factory_id = $2
             ORDER BY p.date DESC`,
            [customerId, req.user.factory_id]
        );
        res.json({
            payments: result.rows,
            payment_count: result.rows.length,
            total_paid: result.rows.reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
        });
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
        const paymentAmount = Number(amount);

        if (!customer_id || !Number.isFinite(paymentAmount) || paymentAmount <= 0)
            return res.status(400).json({ error: 'customer_id and amount are required' });

        await client.query('BEGIN');

        const customer = await client.query(
            `SELECT * FROM customers WHERE customer_id = $1 AND factory_id = $2`,
            [customer_id, factory_id]
        );
        if (customer.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Customer not found' });
        }

        const countRes = await client.query(`SELECT COUNT(*) as cnt FROM payments`);
        const cnt = Number(countRes.rows[0].cnt || countRes.rows[0]['COUNT(*)'] || 0);
        const newId = 'PAY' + String(cnt + 1).padStart(3, '0');

        const result = await client.query(
            `INSERT INTO payments 
        (payment_id, invoice_id, customer_id, date, amount, method, receipt_no, notes, factory_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
            [newId, invoice_id || null, customer_id, date || new Date().toISOString().split('T')[0], paymentAmount, method || 'Cash', receipt_no || null, notes || null, factory_id]
        );

        await client.query(
            `UPDATE customers SET balance_due = COALESCE(balance_due, 0) - $1 WHERE customer_id = $2 AND factory_id = $3`,
            [paymentAmount, customer_id, factory_id]
        );

        if (invoice_id) {
            const invoice = await client.query(
                `SELECT * FROM invoices WHERE invoice_id = $1 AND customer_id = $2 AND factory_id = $3`,
                [invoice_id, customer_id, factory_id]
            );
            if (invoice.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'Invoice not found for this customer' });
            }

            const invoiceRow = invoice.rows[0];
            const amountPaid = Math.min(
                Number(invoiceRow.total_amount || 0),
                Number(invoiceRow.amount_paid || 0) + paymentAmount
            );
            const balanceDue = Math.max(Number(invoiceRow.total_amount || 0) - amountPaid, 0);
            const status = balanceDue <= 0 ? 'paid' : 'partial';

            await client.query(
                `UPDATE invoices SET 
          amount_paid = $1,
          balance_due = $2,
          status = $3
         WHERE invoice_id = $4 AND factory_id = $5`,
                [amountPaid, balanceDue, status, invoice_id, factory_id]
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
    const client = await pool.connect();
    try {
        const { payment_id, invoice_id } = req.body;
        const factory_id = req.user.factory_id;

        if (!payment_id || !invoice_id)
            return res.status(400).json({ error: 'payment_id and invoice_id are required' });

        await client.query('BEGIN');

        const payment = await client.query(
            `SELECT * FROM payments WHERE payment_id = $1 AND factory_id = $2`,
            [payment_id, factory_id]
        );
        if (payment.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Payment not found' });
        }
        if (payment.rows[0].invoice_id) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Payment is already allocated to an invoice' });
        }

        const invoice = await client.query(
            `SELECT * FROM invoices WHERE invoice_id = $1 AND customer_id = $2 AND factory_id = $3`,
            [invoice_id, payment.rows[0].customer_id, factory_id]
        );
        if (invoice.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Invoice not found for this payment customer' });
        }

        const paymentAmount = Number(payment.rows[0].amount || 0);
        const invoiceRow = invoice.rows[0];
        const amountPaid = Math.min(
            Number(invoiceRow.total_amount || 0),
            Number(invoiceRow.amount_paid || 0) + paymentAmount
        );
        const balanceDue = Math.max(Number(invoiceRow.total_amount || 0) - amountPaid, 0);
        const status = balanceDue <= 0 ? 'paid' : 'partial';

        await client.query(
            `UPDATE invoices SET amount_paid = $1, balance_due = $2, status = $3
             WHERE invoice_id = $4 AND factory_id = $5`,
            [amountPaid, balanceDue, status, invoice_id, factory_id]
        );
        await client.query(
            `UPDATE payments SET invoice_id = $1 WHERE payment_id = $2 AND factory_id = $3`,
            [invoice_id, payment_id, factory_id]
        );

        await client.query('COMMIT');
        res.json({ message: 'âœ… Payment allocated to invoice' });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
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
            const invoice = await client.query(
                `SELECT * FROM invoices WHERE invoice_id = $1 AND factory_id = $2`,
                [payment.rows[0].invoice_id, factory_id]
            );
            if (invoice.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'Linked invoice not found' });
            }

            const invoiceRow = invoice.rows[0];
            const amountPaid = Math.max(
                Number(invoiceRow.amount_paid || 0) - Math.min(Number(payment.rows[0].amount || 0), Number(invoiceRow.amount_paid || 0)),
                0
            );
            const balanceDue = Math.max(Number(invoiceRow.total_amount || 0) - amountPaid, 0);
            const status = amountPaid <= 0 ? 'unpaid' : balanceDue <= 0 ? 'paid' : 'partial';

            await client.query(
                `UPDATE invoices SET 
          amount_paid = $1,
          balance_due = $2,
          status = $3
         WHERE invoice_id = $4 AND factory_id = $5`,
                [amountPaid, balanceDue, status, payment.rows[0].invoice_id, factory_id]
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
