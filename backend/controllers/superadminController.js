const pool = require('../config/db');

const getDashboardStats = async (req, res) => {
    try {
        const factoryCount = await pool.query(`SELECT COUNT(*) as cnt FROM factories`);
        const userCount = await pool.query(`SELECT COUNT(*) as cnt FROM users WHERE role != 'superadmin'`);
        const customerCount = await pool.query(`SELECT COUNT(*) as cnt FROM customers`);
        const invoiceCount = await pool.query(`SELECT COUNT(*) as cnt FROM invoices`);
        const revenue = await pool.query(`SELECT SUM(total_amount) as total FROM invoices`);

        res.json({
            factories: Number(factoryCount.rows[0].cnt || factoryCount.rows[0]['COUNT(*)'] || 0),
            users: Number(userCount.rows[0].cnt || userCount.rows[0]['COUNT(*)'] || 0),
            customers: Number(customerCount.rows[0].cnt || customerCount.rows[0]['COUNT(*)'] || 0),
            invoices: Number(invoiceCount.rows[0].cnt || invoiceCount.rows[0]['COUNT(*)'] || 0),
            total_revenue: Number(revenue.rows[0].total || revenue.rows[0]['SUM(total_amount)'] || 0)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const getFactories = async (req, res) => {
    try {
        const factories = await pool.query(`
            SELECT f.*, 
                   (SELECT COUNT(*) FROM users u WHERE u.factory_id = f.factory_id) as user_count
            FROM factories f
        `);
        res.json(factories.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const getGlobalSettings = async (req, res) => {
    try {
        const result = await pool.query(`SELECT * FROM global_settings LIMIT 1`);
        res.json(result.rows[0] || { app_name: 'Factory Management System', logo_url: '' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const updateGlobalSettings = async (req, res) => {
    try {
        const { app_name, logo_url } = req.body;
        // Check if global_settings row exists, if not create it
        const exists = await pool.query(`SELECT id FROM global_settings LIMIT 1`);
        if (exists.rows.length === 0) {
            await pool.query(`INSERT INTO global_settings (app_name, logo_url) VALUES ($1, $2)`, [app_name || 'Factory Management System', logo_url || '']);
        } else {
            await pool.query(
                `UPDATE global_settings SET app_name = COALESCE($1, app_name), logo_url = COALESCE($2, logo_url)`,
                [app_name, logo_url]
            );
        }
        res.json({ message: 'Global settings updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const getAllUsers = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT u.user_id, u.username, u.full_name, u.role, u.status, u.factory_id, f.name as factory_name
            FROM users u
            LEFT JOIN factories f ON u.factory_id = f.factory_id
            ORDER BY u.created_at DESC
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const createFactory = async (req, res) => {
    try {
        const { name, address } = req.body;
        if (!name) return res.status(400).json({ error: 'Factory name is required' });
        const count = await pool.query(`SELECT COUNT(*) as cnt FROM factories`);
        const n = Number(count.rows[0].cnt || count.rows[0]['COUNT(*)'] || 0);
        const factory_id = 'factory_' + (n + 1);
        await pool.query(
            `INSERT INTO factories (factory_id, name, address, status) VALUES ($1, $2, $3, 'active')`,
            [factory_id, name, address || null]
        );
        res.status(201).json({ message: 'Factory created', factory_id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const createUserBySuperadmin = async (req, res) => {
    try {
        const { username, password, full_name, role, factory_id } = req.body;
        if (!username || !password || !factory_id)
            return res.status(400).json({ error: 'Username, password, and factory_id required' });
        const existing = await pool.query(`SELECT user_id FROM users WHERE username = $1`, [username]);
        if (existing.rows.length > 0)
            return res.status(400).json({ error: 'Username already exists' });
        const count = await pool.query(`SELECT COUNT(*) as cnt FROM users`);
        const n = Number(count.rows[0].cnt || count.rows[0]['COUNT(*)'] || 0);
        const newId = 'U' + String(n + 1).padStart(3, '0');
        await pool.query(
            `INSERT INTO users (user_id, username, password, full_name, role, factory_id, status) VALUES ($1,$2,$3,$4,$5,$6,'active')`,
            [newId, username, password, full_name || username, role || 'admin', factory_id]
        );
        res.status(201).json({ message: 'User created', user_id: newId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = {
    getDashboardStats,
    getFactories,
    getGlobalSettings,
    updateGlobalSettings,
    getAllUsers,
    createFactory,
    createUserBySuperadmin
};
