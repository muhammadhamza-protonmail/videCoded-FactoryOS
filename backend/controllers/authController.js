const pool = require('../config/db');
const jwt = require('jsonwebtoken');
const jwtSecret = process.env.JWT_SECRET || 'factory_desktop_local_secret';

// ── Generate Token ─────────────────────────────────────────────
const generateToken = (user) => jwt.sign(
    {
        user_id: user.user_id,
        username: user.username,
        full_name: user.full_name,
        role: user.role,
        factory_id: user.factory_id,
    },
    jwtSecret,
    { expiresIn: '7d' }
);

// ── LOGIN ──────────────────────────────────────────────────────
const login = async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password)
            return res.status(400).json({ error: 'Username and password required' });

        const result = await pool.query(
            `SELECT * FROM users WHERE username = $1 AND status = 'active'`,
            [username]
        );

        if (result.rows.length === 0)
            return res.status(401).json({ error: 'Invalid username or password' });

        const user = result.rows[0];

        if (user.password !== password)
            return res.status(401).json({ error: 'Invalid username or password' });

        // Get permissions
        const perms = await pool.query(
            `SELECT module, can_view, can_add, can_edit, can_delete
       FROM user_permissions WHERE user_id = $1`,
            [user.user_id]
        );

        // Build permissions object
        const permissions = {};
        perms.rows.forEach(p => {
            permissions[p.module] = {
                view: p.can_view,
                add: p.can_add,
                edit: p.can_edit,
                delete: p.can_delete,
            };
        });

        // Admin and superadmin get all permissions
        if (user.role === 'admin' || user.role === 'superadmin') {
            const modules = [
                'dashboard', 'customers', 'products', 'vendors',
                'rawmaterials', 'production', 'invoices',
                'payments', 'inventory', 'users'
            ];
            modules.forEach(m => {
                permissions[m] = { view: true, add: true, edit: true, delete: true };
            });
        }

        const token = generateToken(user);

        res.json({
            message: '✅ Login successful',
            token,
            user: {
                user_id: user.user_id,
                username: user.username,
                full_name: user.full_name,
                role: user.role,
                factory_id: user.factory_id,
            },
            permissions,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ── GET ME ─────────────────────────────────────────────────────
const getMe = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT user_id, username, full_name, role, factory_id
       FROM users WHERE user_id = $1`,
            [req.user.user_id]
        );
        if (result.rows.length === 0)
            return res.status(404).json({ error: 'User not found' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ── LOGOUT ─────────────────────────────────────────────────────
const logout = (req, res) => {
    res.json({ message: '✅ Logged out' });
};

module.exports = { login, getMe, logout };
