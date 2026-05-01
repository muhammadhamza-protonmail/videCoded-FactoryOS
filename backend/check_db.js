const pool = require('./config/db');

async function check() {
    try {
        const res = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
        console.log('Tables:', res.rows.map(r => r.table_name));
        
        const res2 = await pool.query("SELECT * FROM users WHERE role = 'superadmin'");
        console.log('Superadmins:', res2.rows);
        
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

check();
