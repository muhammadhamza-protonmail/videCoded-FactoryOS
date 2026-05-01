const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');

async function seedUsers() {
    const dbPath = path.join(__dirname, 'database.sqlite');
    const db = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });

    const users = [
        {
            id: 'S001',
            username: 'superadmin',
            password: 'superadmin123',
            fullName: 'System Superadmin',
            role: 'superadmin'
        },
        {
            id: 'A001',
            username: 'admin',
            password: 'admin123',
            fullName: 'System Admin',
            role: 'admin'
        }
    ];

    try {
        for (const user of users) {
            const existing = await db.get('SELECT * FROM users WHERE username = ?', [user.username]);
            if (existing) {
                await db.run(
                    'UPDATE users SET password = ?, role = ? WHERE username = ?',
                    [user.password, user.role, user.username]
                );
                console.log(`✅ Updated existing user: ${user.username}`);
            } else {
                await db.run(
                    `INSERT INTO users (user_id, username, password, full_name, role, status)
                     VALUES (?, ?, ?, ?, ?, 'active')`,
                    [user.id, user.username, user.password, user.fullName, user.role]
                );
                console.log(`✅ Created new user: ${user.username}`);
            }
        }
    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        await db.close();
    }
}

seedUsers();
