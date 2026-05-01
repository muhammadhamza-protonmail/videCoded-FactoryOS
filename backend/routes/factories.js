const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const protect = require('../middleware/auth');

// Get Factory Profile (Admin Only)
router.get('/profile', protect, async (req, res) => {
    try {
        if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
            return res.status(403).json({ error: 'Admin access required' });
        }
        
        const result = await pool.query(
            `SELECT * FROM factories WHERE factory_id = $1`,
            [req.user.factory_id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update Factory Profile (Admin Only)
router.put('/profile', protect, async (req, res) => {
    try {
        if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
            return res.status(403).json({ error: 'Admin access required' });
        }
        
        const { name, address } = req.body;
        const result = await pool.query(
            `UPDATE factories SET name = COALESCE($1, name), address = COALESCE($2, address) WHERE factory_id = $3 RETURNING *`,
            [name, address, req.user.factory_id]
        );
        res.json({ message: 'Factory profile updated', factory: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
