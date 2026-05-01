const pool = require('../config/db');

// ── GET all products ───────────────────────────────────────────
const getAllProducts = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT * FROM products WHERE factory_id = $1 ORDER BY name ASC`,
            [req.user.factory_id]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ── GET single product by ID ───────────────────────────────────
const getProductById = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            `SELECT * FROM products WHERE product_id = $1 AND factory_id = $2`,
            [id, req.user.factory_id]
        );
        if (result.rows.length === 0)
            return res.status(404).json({ error: 'Product not found' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ── CREATE new product ─────────────────────────────────────────
const createProduct = async (req, res) => {
    try {
        const { 
            name, unit, sale_price, current_stock, reorder_level, 
            material_id, units_per_bag, rm_ratio_qty, product_ratio_qty, remarks 
        } = req.body;

        if (!name) return res.status(400).json({ error: 'Name is required' });

        // Auto generate product_id
        const countRes = await pool.query(`SELECT COUNT(*) as cnt FROM products`);
        const cnt = Number(countRes.rows[0].cnt || countRes.rows[0]['COUNT(*)'] || 0);
        const newId = 'P' + String(cnt + 1).padStart(3, '0');

        const result = await pool.query(
            `INSERT INTO products 
        (product_id, name, unit, sale_price, current_stock, reorder_level, status, 
        material_id, units_per_bag, rm_ratio_qty, product_ratio_qty, remarks, factory_id)
       VALUES ($1, $2, $3, $4, $5, $6, 'active', $7, $8, $9, $10, $11, $12)
       RETURNING *`,
            [
                newId, name, unit || 'piece', sale_price || 0, current_stock || 0, 
                reorder_level || 0, material_id || null, units_per_bag || 0, 
                rm_ratio_qty || 0, product_ratio_qty || 0, remarks || null, req.user.factory_id
            ]
        );

        res.status(201).json({
            message: '✅ Product created successfully',
            product: result.rows[0]
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ── UPDATE product ─────────────────────────────────────────────
const updateProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const { 
            name, unit, sale_price, current_stock, reorder_level, status, 
            material_id, units_per_bag, rm_ratio_qty, product_ratio_qty, remarks 
        } = req.body;

        const result = await pool.query(
            `UPDATE products SET
        name              = COALESCE($1, name),
        unit              = COALESCE($2, unit),
        sale_price        = COALESCE($3, sale_price),
        current_stock     = COALESCE($4, current_stock),
        reorder_level     = COALESCE($5, reorder_level),
        status            = COALESCE($6, status),
        material_id       = COALESCE($7, material_id),
        units_per_bag     = COALESCE($8, units_per_bag),
        rm_ratio_qty      = COALESCE($9, rm_ratio_qty),
        product_ratio_qty = COALESCE($10, product_ratio_qty),
        remarks           = COALESCE($11, remarks)
       WHERE product_id = $12 AND factory_id = $13
       RETURNING *`,
            [
                name, unit, sale_price, current_stock, reorder_level, status, 
                material_id, units_per_bag, rm_ratio_qty, product_ratio_qty, remarks, id, req.user.factory_id
            ]
        );

        if (result.rows.length === 0)
            return res.status(404).json({ error: 'Product not found' });

        res.json({
            message: '✅ Product updated',
            product: result.rows[0]
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ── GET low stock products ────────────────────────────────────
const getLowStockProducts = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT * FROM products 
             WHERE current_stock <= reorder_level 
             AND status = 'active'
             AND factory_id = $1 
             ORDER BY name ASC`,
            [req.user.factory_id]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = {
    getAllProducts,
    getProductById,
    createProduct,
    updateProduct,
    getLowStockProducts,
};