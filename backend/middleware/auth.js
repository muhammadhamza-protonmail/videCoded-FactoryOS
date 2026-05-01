const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const jwtSecret = process.env.JWT_SECRET || 'factory_desktop_local_secret';

// ── Protect route — must be logged in ─────────────────────────
const protect = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer '))
            return res.status(401).json({ error: 'Not authorized — no token' });

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, jwtSecret);
        req.user = decoded;
        next();
    } catch (err) {
        res.status(401).json({ error: 'Not authorized — invalid token' });
    }
};

// ── Check permission ───────────────────────────────────────────
const checkPermission = (module, action) => {
    return async (req, res, next) => {
        try {
            // Super admin bypasses all checks
            if (req.user.role === 'superadmin') return next();

            // Admin bypasses all checks
            if (req.user.role === 'admin') return next();

            // Check permission for user
            const result = await pool.query(
                `SELECT * FROM user_permissions
         WHERE user_id = $1 AND module = $2`,
                [req.user.user_id, module]
            );

            if (result.rows.length === 0)
                return res.status(403).json({ error: 'Access denied' });

            const perm = result.rows[0];

            if (!perm[`can_${action}`])
                return res.status(403).json({
                    error: `Access denied — no ${action} permission on ${module}`
                });

            next();
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    };
};

// ── Admin only ─────────────────────────────────────────────────
const adminOnly = (req, res, next) => {
    if (req.user.role === 'admin' || req.user.role === 'superadmin')
        return next();
    res.status(403).json({ error: 'Admin access required' });
};

module.exports = protect;
module.exports.checkPermission = checkPermission;
module.exports.adminOnly = adminOnly;
