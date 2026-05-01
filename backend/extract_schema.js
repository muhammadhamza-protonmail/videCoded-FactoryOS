const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
});

async function extract() {
    try {
        const tablesRes = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
        const tables = tablesRes.rows.map(r => r.table_name);
        
        for (const table of tables) {
            const colsRes = await pool.query(`
                SELECT column_name, data_type, character_maximum_length, is_nullable, column_default
                FROM information_schema.columns 
                WHERE table_name = $1
                ORDER BY ordinal_position
            `, [table]);
            
            let createStmt = `CREATE TABLE ${table} (\n`;
            const cols = colsRes.rows.map(col => {
                let type = 'TEXT';
                if (col.data_type.includes('int')) type = 'INTEGER';
                if (col.data_type.includes('num') || col.data_type.includes('dec')) type = 'REAL';
                if (col.data_type.includes('bool')) type = 'INTEGER';
                if (col.data_type.includes('time') || col.data_type.includes('date')) type = 'TEXT';
                
                let def = '';
                if (col.column_default) {
                    if (col.column_default.includes('nextval')) {
                        type = 'INTEGER PRIMARY KEY AUTOINCREMENT';
                    } else if (col.column_default.includes('now()')) {
                        def = " DEFAULT CURRENT_TIMESTAMP";
                    } else {
                        // ignore other defaults for now or parse
                        // def = ` DEFAULT ${col.column_default}`;
                    }
                }
                
                let nullStr = col.is_nullable === 'NO' ? ' NOT NULL' : '';
                return `  ${col.column_name} ${type}${nullStr}${def}`;
            });
            createStmt += cols.join(',\n') + '\n);\n';
            console.log(createStmt);
        }
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
extract();
