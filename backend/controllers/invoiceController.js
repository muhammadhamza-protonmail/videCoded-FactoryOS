const pool = require('../config/db');

// ── GET all invoices ───────────────────────────────────────────
const getAllInvoices = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT 
        i.*,
        c.name AS customer_name,
        c.phone AS customer_phone
       FROM invoices i
       LEFT JOIN customers c ON i.customer_id = c.customer_id
       WHERE i.factory_id = $1
       ORDER BY i.date DESC`,
            [req.user.factory_id]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ── GET single invoice with items ──────────────────────────────
const getInvoiceById = async (req, res) => {
    try {
        const { id } = req.params;
        const factory_id = req.user.factory_id;

        // Get invoice
        const invoice = await pool.query(
            `SELECT 
        i.*,
        c.name    AS customer_name,
        c.phone   AS customer_phone,
        c.address AS customer_address
       FROM invoices i
       LEFT JOIN customers c ON i.customer_id = c.customer_id
       WHERE i.invoice_id = $1 AND i.factory_id = $2`,
            [id, factory_id]
        );

        if (invoice.rows.length === 0)
            return res.status(404).json({ error: 'Invoice not found' });

        // Get invoice items
        const items = await pool.query(
            `SELECT 
        ii.*,
        p.name AS product_name,
        p.unit AS product_unit
       FROM invoice_items ii
       LEFT JOIN products p ON ii.product_id = p.product_id
       WHERE ii.invoice_id = $1 AND ii.factory_id = $2`,
            [id, factory_id]
        );

        // Get payments for this invoice
        const payments = await pool.query(
            `SELECT * FROM payments 
       WHERE invoice_id = $1 AND factory_id = $2
       ORDER BY date ASC`,
            [id, factory_id]
        );

        res.json({
            invoice: invoice.rows[0],
            items: items.rows,
            payments: payments.rows,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ── CREATE invoice ─────────────────────────────────────────────
const createInvoice = async (req, res) => {
    const client = await pool.connect();
    try {
        const { customer_id, date, due_date, items } = req.body;
        const factory_id = req.user.factory_id;

        if (!customer_id || !items || items.length === 0)
            return res.status(400).json({ error: 'customer_id and at least one item are required' });

        const customer = await client.query(
            `SELECT * FROM customers WHERE customer_id = $1 AND factory_id = $2`, 
            [customer_id, factory_id]
        );
        if (customer.rows.length === 0)
            return res.status(404).json({ error: 'Customer not found' });

        await client.query('BEGIN');

        const countRes = await client.query(`SELECT COUNT(*) as cnt FROM invoices`);
        const cnt = Number(countRes.rows[0].cnt || countRes.rows[0]['COUNT(*)'] || 0);
        const newId = 'INV' + String(cnt + 1).padStart(3, '0');
        const invoiceNo = `INV-${new Date().getFullYear()}-${String(cnt + 1).padStart(3, '0')}`;

        let totalAmount = 0;
        for (const item of items) {
            totalAmount += item.quantity * item.unit_price;
        }

        const newBalance = Number(customer.rows[0].balance_due) + totalAmount;
        if (Number(customer.rows[0].credit_limit) > 0 && newBalance > Number(customer.rows[0].credit_limit)) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: `Credit limit exceeded!` });
        }

        const invoiceDate = date || new Date().toISOString().split('T')[0];
        const invoice = await client.query(
            `INSERT INTO invoices
                (invoice_id, invoice_no, date, customer_id, due_date,
                total_amount, amount_paid, balance_due, status, factory_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *`,
            [newId, invoiceNo, invoiceDate, customer_id, due_date || null, totalAmount, 0, totalAmount, 'unpaid', factory_id]
        );

        for (const item of items) {
            await client.query(
                `INSERT INTO invoice_items
            (invoice_id, product_id, quantity, unit_price, factory_id)
            VALUES ($1, $2, $3, $4, $5)`,
                [newId, item.product_id, item.quantity, item.unit_price, factory_id]
            );
        }

        await client.query(
            `UPDATE customers SET balance_due = balance_due + $1 WHERE customer_id = $2 AND factory_id = $3`,
            [totalAmount, customer_id, factory_id]
        );

        await client.query('COMMIT');
        res.status(201).json({ message: '✅ Invoice created successfully', invoice: invoice.rows[0] });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
};

// ── UPDATE invoice ─────────────────────────────────────────────
const updateInvoice = async (req, res) => {
    try {
        const { id } = req.params;
        const { due_date, status } = req.body;

        const result = await pool.query(
            `UPDATE invoices SET
        due_date = COALESCE($1, due_date),
        status   = COALESCE($2, status)
       WHERE invoice_id = $3 AND factory_id = $4
       RETURNING *`,
            [due_date, status, id, req.user.factory_id]
        );

        if (result.rows.length === 0)
            return res.status(404).json({ error: 'Invoice not found' });

        res.json({ message: '✅ Invoice updated', invoice: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ── DELETE invoice ─────────────────────────────────────────────
const deleteInvoice = async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const factory_id = req.user.factory_id;

        const invoice = await client.query(
            `SELECT * FROM invoices WHERE invoice_id = $1 AND factory_id = $2`, [id, factory_id]
        );
        if (invoice.rows.length === 0)
            return res.status(404).json({ error: 'Invoice not found' });

        const payments = await client.query(
            `SELECT COUNT(*) as cnt FROM payments WHERE invoice_id = $1 AND factory_id = $2`, [id, factory_id]
        );
        const pCount = Number(payments.rows[0].cnt || payments.rows[0]['COUNT(*)'] || 0);
        if (pCount > 0)
            return res.status(400).json({ error: 'Cannot delete — invoice has payments recorded.' });

        await client.query('BEGIN');
        await client.query(
            `UPDATE customers SET balance_due = balance_due - $1 WHERE customer_id = $2 AND factory_id = $3`,
            [invoice.rows[0].total_amount, invoice.rows[0].customer_id, factory_id]
        );
        await client.query(`DELETE FROM invoice_items WHERE invoice_id = $1 AND factory_id = $2`, [id, factory_id]);
        await client.query(`DELETE FROM invoices WHERE invoice_id = $1 AND factory_id = $2`, [id, factory_id]);
        await client.query('COMMIT');

        res.json({ message: '✅ Invoice deleted successfully' });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
};

module.exports = {
    getAllInvoices,
    getInvoiceById,
    createInvoice,
    updateInvoice,
    deleteInvoice,
};