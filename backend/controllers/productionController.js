const pool = require('../config/db');

// ── GET all production logs ────────────────────────────────────
const getAllLogs = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT pl.*, p.name as product_name, m.name as material_name
       FROM production_logs pl
       LEFT JOIN products p ON pl.product_id = p.product_id
       LEFT JOIN raw_materials m ON pl.material_id = m.material_id
       WHERE pl.factory_id = $1
       ORDER BY pl.date DESC, pl.created_at DESC`,
            [req.user.factory_id]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ── GET single log ─────────────────────────────────────────────
const getLogById = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            `SELECT pl.*, p.name as product_name, m.name as material_name
             FROM production_logs pl
             LEFT JOIN products p ON pl.product_id = p.product_id
             LEFT JOIN raw_materials m ON pl.material_id = m.material_id
             WHERE pl.log_id = $1 AND pl.factory_id = $2`,
            [id, req.user.factory_id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Log not found' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ── CREATE production log ──────────────────────────────────────
const createLog = async (req, res) => {
    const client = await pool.connect();
    try {
        const {
            date, shift, machine_id, product_id, material_id,
            bags_consumed, mat_cost, units_produced, elec_units, elec_cost,
            shift_expense, other_expense, total_sale_value, remarks
        } = req.body;
        const factory_id = req.user.factory_id;

        if (!product_id || !material_id || !units_produced)
            return res.status(400).json({ error: 'product_id, material_id and units_produced are required' });

        await client.query('BEGIN');

        const countRes = await client.query(`SELECT COUNT(*) as cnt FROM production_logs`);
        const cnt = Number(countRes.rows[0].cnt || countRes.rows[0]['COUNT(*)'] || 0);
        const newId = 'PL' + String(cnt + 1).padStart(3, '0');

        const net_profit = Number(total_sale_value || 0) - (
            Number(mat_cost || 0) + Number(elec_cost || 0) + 
            Number(shift_expense || 0) + Number(other_expense || 0)
        );

        const result = await client.query(
            `INSERT INTO production_logs
          (log_id, date, shift, machine_id, product_id, material_id,
          bags_consumed, mat_cost, units_produced, elec_units, elec_cost,
          shift_expense, other_expense, total_sale_value, net_profit, remarks, factory_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        RETURNING *`,
            [
                newId, date || new Date().toISOString().split('T')[0], shift || 'day', 
                machine_id || null, product_id, material_id, bags_consumed || 0, 
                mat_cost || 0, units_produced, elec_units || 0, elec_cost || 0, 
                shift_expense || 0, other_expense || 0, total_sale_value || 0, 
                net_profit, remarks || null, factory_id
            ]
        );

        await client.query(
            `UPDATE raw_materials SET current_stock = current_stock - $1 WHERE material_id = $2 AND factory_id = $3`,
            [bags_consumed || 0, material_id, factory_id]
        );
        await client.query(
            `UPDATE products SET current_stock = current_stock + $1 WHERE product_id = $2 AND factory_id = $3`,
            [units_produced, product_id, factory_id]
        );

        const imCountRes = await client.query(`SELECT COUNT(*) as cnt FROM inventory_movements`);
        const imCnt = Number(imCountRes.rows[0].cnt || imCountRes.rows[0]['COUNT(*)'] || 0);
        
        await client.query(
            `INSERT INTO inventory_movements (movement_id, date, type, item_type, item_id, quantity, notes, factory_id)
             VALUES ($1, $2, 'OUT', 'raw_material', $3, $4, $5, $6)`,
            ['IM' + String(imCnt + 1).padStart(3, '0'), date, material_id, bags_consumed, `Production Log ${newId}`, factory_id]
        );
        await client.query(
            `INSERT INTO inventory_movements (movement_id, date, type, item_type, item_id, quantity, notes, factory_id)
             VALUES ($1, $2, 'IN', 'product', $3, $4, $5, $6)`,
            ['IM' + String(imCnt + 2).padStart(3, '0'), date, product_id, units_produced, `Production Log ${newId}`, factory_id]
        );

        await client.query('COMMIT');
        res.status(201).json({ message: '✅ Production log saved & stock updated', log: result.rows[0] });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
};

// ── UPDATE production log ──────────────────────────────────────
const updateLog = async (req, res) => {
    try {
        const { id } = req.params;
        const { remarks } = req.body;
        const result = await pool.query(
            `UPDATE production_logs SET remarks = COALESCE($1, remarks) 
             WHERE log_id = $2 AND factory_id = $3 
             RETURNING *`,
            [remarks, id, req.user.factory_id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Log not found' });
        res.json({ message: '✅ Log updated', log: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ── DELETE log ─────────────────────────────────────────────────
const deleteLog = async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const factory_id = req.user.factory_id;

        const log = await client.query(`SELECT * FROM production_logs WHERE log_id = $1 AND factory_id = $2`, [id, factory_id]);
        if (log.rows.length === 0) return res.status(404).json({ error: 'Log not found' });

        await client.query('BEGIN');
        await client.query(
            `UPDATE raw_materials SET current_stock = current_stock + $1 WHERE material_id = $2 AND factory_id = $3`,
            [log.rows[0].bags_consumed, log.rows[0].material_id, factory_id]
        );
        await client.query(
            `UPDATE products SET current_stock = current_stock - $1 WHERE product_id = $2 AND factory_id = $3`,
            [log.rows[0].units_produced, log.rows[0].product_id, factory_id]
        );
        await client.query(`DELETE FROM production_logs WHERE log_id = $1 AND factory_id = $2`, [id, factory_id]);
        await client.query('COMMIT');

        res.json({ message: '✅ Production log deleted & stock reversed' });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
};

// ── GET daily summary ──────────────────────────────────────────
const getDailySummary = async (req, res) => {
    try {
        const { date } = req.query;
        const d = date || new Date().toISOString().split('T')[0];
        const result = await pool.query(
            `SELECT 
                COUNT(*) as logs_count,
                SUM(units_produced) as total_units,
                SUM(total_sale_value) as total_sales,
                SUM(net_profit) as total_profit
             FROM production_logs 
             WHERE date = $1 AND factory_id = $2`,
            [d, req.user.factory_id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = { getAllLogs, getLogById, createLog, updateLog, deleteLog, getDailySummary };