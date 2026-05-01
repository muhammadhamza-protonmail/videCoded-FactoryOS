const pool = require('../config/db');

// ── GET all movements ──────────────────────────────────────────
const getAllMovements = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT * FROM inventory_movements 
             WHERE factory_id = $1
             ORDER BY date DESC, movement_id DESC`,
            [req.user.factory_id]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ── GET single movement ────────────────────────────────────────
const getMovementById = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            `SELECT * FROM inventory_movements WHERE movement_id = $1 AND factory_id = $2`, 
            [id, req.user.factory_id]
        );
        if (result.rows.length === 0)
            return res.status(404).json({ error: 'Movement not found' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ── ADD inventory movement ─────────────────────────────────────
const addMovement = async (req, res) => {
    const client = await pool.connect();
    try {
        const {
            date, type, item_type, item_id, quantity, unit, reference, notes, new_unit_price, unit_price
        } = req.body;
        const factory_id = req.user.factory_id;

        if (!type || !item_type || !item_id || !quantity)
            return res.status(400).json({ error: 'type, item_type, item_id and quantity are required' });

        await client.query('BEGIN');

        const parsedUnitPrice = unit_price ?? new_unit_price;
        const effectiveUnitPrice = parsedUnitPrice !== undefined && parsedUnitPrice !== null && parsedUnitPrice !== ''
            ? Number(parsedUnitPrice) : null;
        const totalAmount = effectiveUnitPrice !== null ? Number(quantity) * effectiveUnitPrice : null;

        const countRes = await client.query(`SELECT COUNT(*) as cnt FROM inventory_movements`);
        const cnt = Number(countRes.rows[0].cnt || countRes.rows[0]['COUNT(*)'] || 0);
        const newId = 'IM' + String(cnt + 1).padStart(3, '0');

        const movement = await client.query(
            `INSERT INTO inventory_movements
          (movement_id, date, type, item_type, item_id, 
          quantity, unit, reference, notes, unit_price, total_amount, factory_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *`,
            [
                newId, date || new Date().toISOString().split('T')[0], type, item_type, item_id,
                quantity, unit || 'piece', reference || null, notes || null, effectiveUnitPrice, totalAmount, factory_id
            ]
        );

        if (item_type === 'raw_material') {
            const mat = await client.query(`SELECT * FROM raw_materials WHERE material_id = $1 AND factory_id = $2`, [item_id, factory_id]);
            if (mat.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'Raw material not found' });
            }
            await client.query(
                `UPDATE raw_materials SET current_stock = current_stock ${type === 'IN' ? '+' : '-'} $1, cost_per_unit = COALESCE($2, cost_per_unit)
                 WHERE material_id = $3 AND factory_id = $4`,
                [quantity, effectiveUnitPrice, item_id, factory_id]
            );
        } else if (item_type === 'product') {
            const prod = await client.query(`SELECT * FROM products WHERE product_id = $1 AND factory_id = $2`, [item_id, factory_id]);
            if (prod.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'Product not found' });
            }
            await client.query(
                `UPDATE products SET current_stock = current_stock ${type === 'IN' ? '+' : '-'} $1, sale_price = COALESCE($2, sale_price)
                 WHERE product_id = $3 AND factory_id = $4`,
                [quantity, effectiveUnitPrice, item_id, factory_id]
            );
        }

        await client.query('COMMIT');
        res.status(201).json({ message: '✅ Inventory movement recorded', movement: movement.rows[0] });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
};

// ── GET stock summary ──────────────────────────────────────────
const getStockSummary = async (req, res) => {
    try {
        const factory_id = req.user.factory_id;

        const products = await pool.query(
            `SELECT product_id, name, unit, current_stock, reorder_level, sale_price,
             current_stock * sale_price AS stock_value,
             CASE WHEN current_stock <= 0 THEN 'out_of_stock' WHEN current_stock <= reorder_level THEN 'low_stock' ELSE 'ok' END AS stock_status
             FROM products WHERE status = 'active' AND factory_id = $1 ORDER BY name ASC`,
            [factory_id]
        );

        const materials = await pool.query(
            `SELECT rm.material_id, rm.name, rm.unit, rm.current_stock, rm.reorder_level, rm.cost_per_unit,
             rm.current_stock * rm.cost_per_unit AS stock_value, v.name AS vendor_name,
             CASE WHEN rm.current_stock <= 0 THEN 'out_of_stock' WHEN rm.current_stock <= rm.reorder_level THEN 'low_stock' ELSE 'ok' END AS stock_status
             FROM raw_materials rm LEFT JOIN vendors v ON rm.vendor_id = v.vendor_id
             WHERE rm.factory_id = $1 ORDER BY rm.name ASC`,
            [factory_id]
        );

        res.json({
            summary: {
                total_products: products.rows.length,
                total_materials: materials.rows.length,
                low_stock_products: products.rows.filter(p => p.stock_status === 'low_stock').length,
                out_of_stock_products: products.rows.filter(p => p.stock_status === 'out_of_stock').length,
                low_stock_materials: materials.rows.filter(m => m.stock_status === 'low_stock').length,
                total_product_value: products.rows.reduce((sum, p) => sum + Number(p.stock_value || 0), 0),
                total_material_value: materials.rows.reduce((sum, m) => sum + Number(m.stock_value || 0), 0),
            },
            products: products.rows,
            materials: materials.rows,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ── GET movements for a specific product ──────────────────────
const getProductMovements = async (req, res) => {
    try {
        const { id } = req.params;
        const factory_id = req.user.factory_id;

        const product = await pool.query(`SELECT * FROM products WHERE product_id = $1 AND factory_id = $2`, [id, factory_id]);
        if (product.rows.length === 0) return res.status(404).json({ error: 'Product not found' });

        const movements = await pool.query(
            `SELECT * FROM inventory_movements WHERE item_type = 'product' AND item_id = $1 AND factory_id = $2 ORDER BY date DESC`,
            [id, factory_id]
        );

        res.json({ product: product.rows[0], movements: movements.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ── GET movements for a specific material ─────────────────────
const getMaterialMovements = async (req, res) => {
    try {
        const { id } = req.params;
        const factory_id = req.user.factory_id;

        const material = await pool.query(`SELECT * FROM raw_materials WHERE material_id = $1 AND factory_id = $2`, [id, factory_id]);
        if (material.rows.length === 0) return res.status(404).json({ error: 'Material not found' });

        const movements = await pool.query(
            `SELECT * FROM inventory_movements WHERE item_type = 'raw_material' AND item_id = $1 AND factory_id = $2 ORDER BY date DESC`,
            [id, factory_id]
        );

        res.json({ material: material.rows[0], movements: movements.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = { getAllMovements, getMovementById, addMovement, getStockSummary, getProductMovements, getMaterialMovements };
