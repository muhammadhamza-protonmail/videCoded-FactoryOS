const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');

async function migrate() {
    const db = await open({
        filename: path.join(__dirname, 'database.sqlite'),
        driver: sqlite3.Database
    });

    console.log("Starting Database Migration...");

    // 1. Create global settings table
    await db.exec(`
        CREATE TABLE IF NOT EXISTS global_settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            app_name TEXT DEFAULT 'Factory Management System',
            logo_url TEXT DEFAULT '/uploads/logo.png',
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // Insert default settings if empty
    const settingsCount = await db.get(`SELECT COUNT(*) as count FROM global_settings`);
    if (settingsCount.count === 0) {
        await db.run(`INSERT INTO global_settings (app_name) VALUES ('Factory Management System')`);
        console.log("Inserted default global settings.");
    }

    // 2. Create Factory 1 if not exists
    let factoryId = 'factory_1';
    const factory = await db.get(`SELECT factory_id FROM factories WHERE factory_id = ?`, [factoryId]);
    if (!factory) {
        await db.run(`INSERT INTO factories (factory_id, name, status) VALUES (?, ?, ?)`, [factoryId, 'Default Factory 1', 'active']);
        console.log("Created Default Factory 1.");
    }

    // 3. Add factory_id column to tables
    const tablesToUpdate = [
        'invoices', 'customers', 'vendors', 'products', 'raw_materials', 
        'production_logs', 'payments', 'inventory_movements', 'machines', 'customer_ledger'
    ];

    for (const table of tablesToUpdate) {
        try {
            await db.exec(`ALTER TABLE ${table} ADD COLUMN factory_id TEXT DEFAULT 'factory_1'`);
            console.log(`Added factory_id to ${table}`);
        } catch (err) {
            if (err.message.includes("duplicate column name")) {
                console.log(`Column factory_id already exists in ${table}`);
            } else {
                console.error(`Error adding to ${table}:`, err.message);
            }
        }
        
        // Backfill existing data
        await db.run(`UPDATE ${table} SET factory_id = ? WHERE factory_id IS NULL OR factory_id = ''`, [factoryId]);
    }

    // 4. Update existing users to belong to Factory 1 (except superadmin)
    await db.run(`UPDATE users SET factory_id = ? WHERE role != 'superadmin' AND (factory_id IS NULL OR factory_id = '')`, [factoryId]);
    console.log("Assigned existing non-superadmin users to Factory 1.");

    console.log("Migration Complete!");
    await db.close();
}

migrate().catch(console.error);
