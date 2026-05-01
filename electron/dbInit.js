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

        // 1. Ensure at least one factory exists
        let factory = await db.get('SELECT * FROM factories LIMIT 1');
        if (!factory) {
            const factoryId = 'F001';
            await db.run(
                `INSERT INTO factories (factory_id, name, address) 
                 VALUES (?, ?, ?)`,
                [factoryId, 'My Factory', 'System Default Address']
            );
            factory = { factory_id: factoryId };
            logger.log('Created default factory profile: F001');
        }

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
                // Ensure password and factory_id match
                if (existing.password !== user.password || !existing.factory_id) {
                    await db.run(
                        'UPDATE users SET password = ?, factory_id = ? WHERE username = ?', 
                        [user.password, factory.factory_id, user.username]
                    );
                    logger.log(`Synced account for ${user.username} with factory ${factory.factory_id}`);
                }
            } else {
                // Create if missing
                const userId = user.role === 'superadmin' ? 'S001' : 'A001';
                await db.run(
                    `INSERT INTO users (user_id, username, password, full_name, role, factory_id, status)
                     VALUES (?, ?, ?, ?, ?, ?, 'active')`,
                    [userId, user.username, user.password, user.fullName, user.role, factory.factory_id]
                );
                logger.log(`Created default user: ${user.username} with factory ${factory.factory_id}`);
            }
        }
    } catch (err) {
        logger.error('Failed to sync default users', err);
    } finally {
        if (db) await db.close();
    }
}

module.exports = { syncDefaultUsers };
