const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const jwtSecret = process.env.JWT_SECRET || 'factory_desktop_local_secret';

const protect = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Not authorized - no token' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, jwtSecret);

        const userResult = await pool.query(
            `SELECT user_id, username, full_name, role, factory_id, status
             FROM users WHERE user_id = $1`,
            [decoded.user_id]
        );

        if (userResult.rows.length === 0) {
            return res.status(401).json({ error: 'Not authorized - user not found' });
        }

        const user = userResult.rows[0];
        if (user.status !== 'active') {
            return res.status(401).json({ error: 'Not authorized - inactive user' });
        }

        if (user.role !== 'superadmin' && !user.factory_id) {
            const factoryResult = await pool.query(
                `SELECT factory_id FROM factories ORDER BY created_at ASC LIMIT 1`
            );

            if (factoryResult.rows.length === 0) {
                return res.status(403).json({ error: 'No factory configured for this user' });
            }

            const fallbackFactoryId = factoryResult.rows[0].factory_id;
            await pool.query(
                `UPDATE users SET factory_id = $1 WHERE user_id = $2`,
                [fallbackFactoryId, user.user_id]
            );
            user.factory_id = fallbackFactoryId;
        }

        req.user = {
            user_id: user.user_id,
            username: user.username,
            full_name: user.full_name,
            role: user.role,
            factory_id: user.factory_id
        };

        next();
    } catch (err) {
        res.status(401).json({ error: 'Not authorized - invalid token' });
    }
};

const checkPermission = (module, action) => {
    return async (req, res, next) => {
        try {
            if (req.user.role === 'superadmin' || req.user.role === 'admin') return next();

            const result = await pool.query(
                `SELECT * FROM user_permissions
                 WHERE user_id = $1 AND module = $2`,
                [req.user.user_id, module]
            );

            if (result.rows.length === 0) {
                return res.status(403).json({ error: 'Access denied' });
            }

            const permission = result.rows[0];
            if (!permission[`can_${action}`]) {
                return res.status(403).json({
                    error: `Access denied - no ${action} permission on ${module}`
                });
            }

            next();
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    };
};

const adminOnly = (req, res, next) => {
    if (req.user.role === 'admin' || req.user.role === 'superadmin') {
        return next();
    }
    res.status(403).json({ error: 'Admin access required' });
};

module.exports = protect;
module.exports.checkPermission = checkPermission;
module.exports.adminOnly = adminOnly;
