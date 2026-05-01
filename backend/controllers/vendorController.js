const pool = require('../config/db');

// ── GET all vendors ────────────────────────────────────────────
const getAllVendors = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT * FROM vendors WHERE factory_id = $1 ORDER BY name ASC`,
            [req.user.factory_id]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ── GET single vendor by ID ────────────────────────────────────
const getVendorById = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            `SELECT * FROM vendors WHERE vendor_id = $1 AND factory_id = $2`,
            [id, req.user.factory_id]
        );
        if (result.rows.length === 0)
            return res.status(404).json({ error: 'Vendor not found' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ── CREATE new vendor ──────────────────────────────────────────
const createVendor = async (req, res) => {
    try {
        const { name, phone, email, address, payment_terms, remarks } = req.body;

        if (!name) return res.status(400).json({ error: 'Name is required' });

        // Auto generate vendor_id
        const countRes = await pool.query(`SELECT COUNT(*) as cnt FROM vendors`);
        const cnt = Number(countRes.rows[0].cnt || countRes.rows[0]['COUNT(*)'] || 0);
        const newId = 'V' + String(cnt + 1).padStart(3, '0');

        const result = await pool.query(
            `INSERT INTO vendors 
        (vendor_id, name, phone, email, address, payment_terms, current_payable, remarks, factory_id)
       VALUES ($1, $2, $3, $4, $5, $6, 0, $7, $8)
       RETURNING *`,
            [newId, name, phone || null, email || null, address || null, payment_terms || null, remarks || null, req.user.factory_id]
        );

        res.status(201).json({
            message: '✅ Vendor created successfully',
            vendor: result.rows[0]
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ── UPDATE vendor ──────────────────────────────────────────────
const updateVendor = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, phone, email, address, payment_terms, remarks } = req.body;

        const result = await pool.query(
            `UPDATE vendors SET
        name          = COALESCE($1, name),
        phone         = COALESCE($2, phone),
        email         = COALESCE($3, email),
        address       = COALESCE($4, address),
        payment_terms = COALESCE($5, payment_terms),
        remarks       = COALESCE($6, remarks)
       WHERE vendor_id = $7 AND factory_id = $8
       RETURNING *`,
            [name, phone, email, address, payment_terms, remarks, id, req.user.factory_id]
        );

        if (result.rows.length === 0)
            return res.status(404).json({ error: 'Vendor not found' });

        res.json({
            message: '✅ Vendor updated',
            vendor: result.rows[0]
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ── DELETE vendor ──────────────────────────────────────────────
const deleteVendor = async (req, res) => {
    try {
        const { id } = req.params;
        const factory_id = req.user.factory_id;

        // Check if vendor has materials
        const materials = await pool.query(
            `SELECT COUNT(*) as cnt FROM raw_materials WHERE vendor_id = $1 AND factory_id = $2`,
            [id, factory_id]
        );
        const count = Number(materials.rows[0].cnt || materials.rows[0]['COUNT(*)'] || 0);

        if (count > 0) {
            return res.status(400).json({ error: 'Cannot delete vendor with associated raw materials' });
        }

        const result = await pool.query(
            `DELETE FROM vendors WHERE vendor_id = $1 AND factory_id = $2`,
            [id, factory_id]
        );

        res.json({ message: '✅ Vendor deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = {
    getAllVendors,
    getVendorById,
    createVendor,
    updateVendor,
    deleteVendor,
};