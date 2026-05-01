const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');

async function migrate() {
    const db = await open({
        filename: path.join(__dirname, 'database.sqlite'),
        driver: sqlite3.Database
    });

    const tables = [
        'invoices', 'customers', 'vendors', 'products', 
        'raw_materials', 'production_logs', 'payments', 
        'inventory_movements', 'invoice_items', 'machines'
    ];

    // 1. Add factory_id to all tables
    for (const table of tables) {
        try {
            await db.run(`ALTER TABLE ${table} ADD COLUMN factory_id TEXT`);
            console.log(`✅ Added factory_id to ${table}`);
        } catch (err) {
            if (err.message.includes('duplicate column name')) {
                console.log(`ℹ️ factory_id already exists in ${table}`);
            } else {
                console.error(`❌ Error adding factory_id to ${table}:`, err.message);
            }
        }
    }

    // 2. Add pricing columns to inventory_movements
    const invCols = ['unit_price', 'total_amount'];
    for (const col of invCols) {
        try {
            await db.run(`ALTER TABLE inventory_movements ADD COLUMN ${col} NUMERIC(14,2)`);
            console.log(`✅ Added ${col} to inventory_movements`);
        } catch (err) {
            if (err.message.includes('duplicate column name')) {
                console.log(`ℹ️ ${col} already exists in inventory_movements`);
            } else {
                console.error(`❌ Error adding ${col} to inventory_movements:`, err.message);
            }
        }
    }

    // 3. Set default factory_id for existing data
    for (const table of tables) {
        await db.run(`UPDATE ${table} SET factory_id = 'factory_1' WHERE factory_id IS NULL`);
    }
    console.log('✅ Default factory_id set to factory_1 for all existing data');

    await db.close();
}

migrate().catch(console.error);
