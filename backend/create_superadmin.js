const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');

async function createSuperadmin() {
    const db = await open({
        filename: path.join(__dirname, 'database.sqlite'),
        driver: sqlite3.Database
    });

    const username = 'superadmin';
    const password = 'superadmin123'; // In a real app, use hashing (bcrypt)
    const fullName = 'System Superadmin';
    const userId = 'S001';

    try {
        // Check if exists
        const existing = await db.get('SELECT * FROM users WHERE username = ?', [username]);
        if (existing) {
            console.log(`ℹ️ User '${username}' already exists.`);
            await db.close();
            return;
        }

        // Insert superadmin
        await db.run(
            `INSERT INTO users (user_id, username, password, full_name, role, status)
             VALUES (?, ?, ?, ?, 'superadmin', 'active')`,
            [userId, username, password, fullName]
        );

        console.log('✅ Superadmin created successfully!');
        console.log(`👤 Username: ${username}`);
        console.log(`🔑 Password: ${password}`);
        console.log('---');
        console.log('You can now log in at http://localhost:3000/login');

    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        await db.close();
    }
}

createSuperadmin();
