const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const logger = require('./logger');

async function syncDefaultUsers(dbPath) {
    let db;
    try {
        db = await open({
            filename: dbPath,
            driver: sqlite3.Database
        });

        const users = [
            {
                username: 'superadmin',
                password: 'superadmin123',
                fullName: 'System Superadmin',
                role: 'superadmin'
            },
            {
                username: 'admin',
                password: 'admin123',
                fullName: 'System Admin',
                role: 'admin'
            }
        ];

        for (const user of users) {
            const existing = await db.get('SELECT * FROM users WHERE username = ?', [user.username]);
            if (existing) {
                // Ensure passwords match requested
                if (existing.password !== user.password) {
                    await db.run('UPDATE users SET password = ? WHERE username = ?', [user.password, user.username]);
                    logger.log(`Synced password for ${user.username}`);
                }
            } else {
                // Create if missing
                const userId = user.role === 'superadmin' ? 'S001' : 'A001';
                await db.run(
                    `INSERT INTO users (user_id, username, password, full_name, role, status)
                     VALUES (?, ?, ?, ?, ?, 'active')`,
                    [userId, user.username, user.password, user.fullName, user.role]
                );
                logger.log(`Created default user: ${user.username}`);
            }
        }
    } catch (err) {
        logger.error('Failed to sync default users', err);
    } finally {
        if (db) await db.close();
    }
}

module.exports = { syncDefaultUsers };
