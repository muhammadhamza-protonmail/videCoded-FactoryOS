const pool = require('./config/db');

async function test() {
    try {
        const req = { user: { factory_id: 'factory_1' } };
        const result = await pool.query(
            `SELECT * FROM inventory_movements 
             WHERE factory_id = $1
             ORDER BY date DESC, movement_id DESC`,
            [req.user.factory_id]
        );
        console.log('✅ Inventory Movements:', result.rows.length);
        
        const materials = await pool.query(
            `SELECT rm.*, v.name as vendor_name 
       FROM raw_materials rm
       LEFT JOIN vendors v ON rm.vendor_id = v.vendor_id
       WHERE rm.factory_id = $1
       ORDER BY rm.name ASC`,
            [req.user.factory_id]
        );
        console.log('✅ Raw Materials:', materials.rows.length);
        
    } catch (err) {
        console.error('❌ Test failed:', err.message);
    }
}

test();
