const pool = require('../config/db');

const MODULES = [
    'dashboard', 'customers', 'products', 'vendors',
    'rawmaterials', 'production', 'invoices',
    'payments', 'inventory'
];

// helper: get next user ID safely
async function nextUserId() {
    const result = await pool.query(`SELECT COUNT(*) as cnt FROM users`);
    const n = Number(result.rows[0].cnt || result.rows[0]['COUNT(*)'] || 0);
    return 'U' + String(n + 1).padStart(3, '0');
}

// ── GET all users for factory ──────────────────────────────────
const getUsers = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT u.user_id, u.username, u.full_name, u.role,
              u.status, u.factory_id, u.created_at
       FROM users u
       WHERE u.factory_id = $1 AND u.role != 'superadmin'
       ORDER BY u.created_at DESC`,
            [req.user.factory_id]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ── GET user with permissions ──────────────────────────────────
const getUserById = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await pool.query(
            `SELECT user_id, username, full_name, role, status
       FROM users WHERE user_id = $1`,
            [id]
        );
        if (user.rows.length === 0)
            return res.status(404).json({ error: 'User not found' });

        const perms = await pool.query(
            `SELECT module, can_view, can_add, can_edit, can_delete
       FROM user_permissions WHERE user_id = $1`,
            [id]
        );

        const permissions = {};
        perms.rows.forEach(p => {
            permissions[p.module] = {
                view: !!p.can_view,
                add: !!p.can_add,
                edit: !!p.can_edit,
                delete: !!p.can_delete,
            };
        });

        res.json({ user: user.rows[0], permissions });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ── CREATE user ────────────────────────────────────────────────
const createUser = async (req, res) => {
    try {
        const { username, password, full_name, role, permissions } = req.body;

        if (!username || !password)
            return res.status(400).json({ error: 'Username and password required' });

        // Check duplicate username
        const existing = await pool.query(`SELECT user_id FROM users WHERE username = $1`, [username]);
        if (existing.rows.length > 0)
            return res.status(400).json({ error: 'Username already exists' });

        const newId = await nextUserId();

        // Create user with active status
        await pool.query(
            `INSERT INTO users (user_id, username, password, full_name, role, factory_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'active')`,
            [newId, username, password, full_name || username, role || 'user', req.user.factory_id]
        );

        // Insert permissions (delete old ones first for safety)
        await pool.query(`DELETE FROM user_permissions WHERE user_id = $1`, [newId]);
        for (const module of MODULES) {
            const perm = permissions?.[module] || {};
            await pool.query(
                `INSERT INTO user_permissions (user_id, module, can_view, can_add, can_edit, can_delete)
         VALUES ($1, $2, $3, $4, $5, $6)`,
                [newId, module,
                    perm.view ? 1 : 0,
                    perm.add ? 1 : 0,
                    perm.edit ? 1 : 0,
                    perm.delete ? 1 : 0]
            );
        }

        res.status(201).json({ message: '✅ User created successfully', user_id: newId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ── UPDATE user permissions ────────────────────────────────────
const updateUserPermissions = async (req, res) => {
    try {
        const { id } = req.params;
        const { permissions, full_name, status, role } = req.body;

        // Update user info
        await pool.query(
            `UPDATE users SET
        full_name = COALESCE($1, full_name),
        status    = COALESCE($2, status),
        role      = COALESCE($3, role)
       WHERE user_id = $4`,
            [full_name || null, status || null, role || null, id]
        );

        // Update permissions: DELETE + INSERT (avoids ON CONFLICT issue with SQLite)
        if (permissions) {
            await pool.query(`DELETE FROM user_permissions WHERE user_id = $1`, [id]);
            for (const module of MODULES) {
                const perm = permissions[module] || {};
                await pool.query(
                    `INSERT INTO user_permissions (user_id, module, can_view, can_add, can_edit, can_delete)
           VALUES ($1, $2, $3, $4, $5, $6)`,
                    [id, module,
                        perm.view ? 1 : 0,
                        perm.add ? 1 : 0,
                        perm.edit ? 1 : 0,
                        perm.delete ? 1 : 0]
                );
            }
        }

        res.json({ message: '✅ User updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ── DELETE user ────────────────────────────────────────────────
const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query(`DELETE FROM user_permissions WHERE user_id = $1`, [id]);
        await pool.query(`DELETE FROM users WHERE user_id = $1`, [id]);
        res.json({ message: '✅ User deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ── RESET PASSWORD (admin only) ────────────────────────────────
const resetPassword = async (req, res) => {
    try {
        const { id } = req.params;
        const { new_password } = req.body;

        if (!new_password || new_password.length < 4)
            return res.status(400).json({ error: 'Password must be at least 4 characters' });

        await pool.query(
            `UPDATE users SET password = $1 WHERE user_id = $2`,
            [new_password, id]
        );

        res.json({ message: '✅ Password reset successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = {
    getUsers, getUserById, createUser,
    updateUserPermissions, deleteUser, resetPassword
};
