const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');

let dbPromise;

async function getDb() {
    if (!dbPromise) {
        const dbPath = process.env.DB_PATH || path.join(__dirname, '../database.sqlite');
        dbPromise = open({
            filename: dbPath,
            driver: sqlite3.Database
        });
    }
    return dbPromise;
}

function processQuery(text) {
    // Replace $1, $2, etc with ?1, ?2 (SQLite named parameters)
    let processed = text.replace(/\$(\d+)/g, '?$1');
    
    // Replace ILIKE with LIKE
    processed = processed.replace(/\bILIKE\b/gi, 'LIKE');
    
    // SQLite doesn't natively support NOW() easily without datetime('now')
    // and sometimes PostgreSQL CURRENT_TIMESTAMP is used.
    // Replace NOW() with CURRENT_TIMESTAMP for simple usage,
    // though datetime('now', 'localtime') is safer.
    processed = processed.replace(/\bNOW\(\)/gi, "datetime('now', 'localtime')");
    
    return processed;
}

const pool = {
    query: async (text, params) => {
        const db = await getDb();
        const processedText = processQuery(text);
        
        try {
            // Determine if query is meant to return rows
            const isSelect = processedText.trim().match(/^(SELECT|WITH|PRAGMA)/i) !== null;
            const hasReturning = processedText.match(/\bRETURNING\b/i) !== null;
            
            if (isSelect || hasReturning) {
                const rows = await db.all(processedText, params || []);
                return { rows, rowCount: rows.length };
            } else {
                const result = await db.run(processedText, params || []);
                return { rows: [], rowCount: result.changes, lastID: result.lastID };
            }
        } catch (error) {
            console.error('Database Query Error:', error.message);
            console.error('Query:', processedText);
            console.error('Params:', params);
            throw error;
        }
    },
    connect: async () => {
        const db = await getDb();
        return {
            query: async (text, params) => pool.query(text, params),
            release: () => {} // SQLite handles connections differently, no-op release
        };
    }
};

module.exports = pool;
