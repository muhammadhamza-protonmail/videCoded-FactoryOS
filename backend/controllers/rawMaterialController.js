const pool = require('../config/db');

// ── GET all raw materials ──────────────────────────────────────
const getAllMaterials = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT rm.*, v.name as vendor_name 
       FROM raw_materials rm
       LEFT JOIN vendors v ON rm.vendor_id = v.vendor_id
       WHERE rm.factory_id = $1
       ORDER BY rm.name ASC`,
            [req.user.factory_id]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ── GET single raw material ────────────────────────────────────
const getMaterialById = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            `SELECT rm.*, v.name as vendor_name 
       FROM raw_materials rm
       LEFT JOIN vendors v ON rm.vendor_id = v.vendor_id
       WHERE rm.material_id = $1 AND rm.factory_id = $2`,
            [id, req.user.factory_id]
        );
        if (result.rows.length === 0)
            return res.status(404).json({ error: 'Raw material not found' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ── CREATE raw material ────────────────────────────────────────
const createMaterial = async (req, res) => {
    try {
        const { name, vendor_id, unit, current_stock, reorder_level, cost_per_unit, remarks } = req.body;

        if (!name) return res.status(400).json({ error: 'Name is required' });

        const countRes = await pool.query(`SELECT COUNT(*) as cnt FROM raw_materials`);
        const cnt = Number(countRes.rows[0].cnt || countRes.rows[0]['COUNT(*)'] || 0);
        const newId = 'RM' + String(cnt + 1).padStart(3, '0');

        const result = await pool.query(
            `INSERT INTO raw_materials 
        (material_id, name, vendor_id, unit, current_stock, reorder_level, cost_per_unit, remarks, factory_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
            [newId, name, vendor_id || null, unit || 'kg', current_stock || 0, reorder_level || 0, cost_per_unit || 0, remarks || null, req.user.factory_id]
        );

        res.status(201).json({ message: '✅ Raw material created successfully', material: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ── UPDATE raw material ────────────────────────────────────────
const updateMaterial = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, vendor_id, unit, current_stock, reorder_level, cost_per_unit, remarks } = req.body;

        const result = await pool.query(
            `UPDATE raw_materials SET
        name          = COALESCE($1, name),
        vendor_id     = COALESCE($2, vendor_id),
        unit          = COALESCE($3, unit),
        current_stock = COALESCE($4, current_stock),
        reorder_level = COALESCE($5, reorder_level),
        cost_per_unit = COALESCE($6, cost_per_unit),
        remarks       = COALESCE($7, remarks)
       WHERE material_id = $8 AND factory_id = $9
       RETURNING *`,
            [name, vendor_id, unit, current_stock, reorder_level, cost_per_unit, remarks, id, req.user.factory_id]
        );

        if (result.rows.length === 0) return res.status(404).json({ error: 'Raw material not found' });
        res.json({ message: '✅ Raw material updated', material: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ── DELETE raw material ────────────────────────────────────────
const deleteMaterial = async (req, res) => {
    try {
        const { id } = req.params;
        const factory_id = req.user.factory_id;

        // Block if used in production logs
        const logs = await pool.query(`SELECT COUNT(*) as cnt FROM production_logs WHERE material_id = $1 AND factory_id = $2`, [id, factory_id]);
        const count = Number(logs.rows[0].cnt || logs.rows[0]['COUNT(*)'] || 0);
        if (count > 0) return res.status(400).json({ error: 'Cannot delete material used in production logs' });

        await pool.query(`DELETE FROM raw_materials WHERE material_id = $1 AND factory_id = $2`, [id, factory_id]);
        res.json({ message: '✅ Raw material deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ── GET low stock materials ────────────────────────────────────
const getLowStockMaterials = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT * FROM raw_materials WHERE current_stock <= reorder_level AND factory_id = $1 ORDER BY name ASC`,
            [req.user.factory_id]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = {
    getAllMaterials,
    getMaterialById,
    createMaterial,
    updateMaterial,
    deleteMaterial,
    getLowStockMaterials,
};