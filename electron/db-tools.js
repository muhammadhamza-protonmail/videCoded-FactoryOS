const path = require('path');
const { app } = require('electron');
const { createBackupNow, restoreLatestBackup } = require('./backup');

async function run() {
    await app.whenReady();
    const userDataDir = app.getPath('userData');
    const dbPath = path.join(userDataDir, 'data', 'database.sqlite');
    const backupDir = path.join(userDataDir, 'backups');
    const action = (process.argv[2] || '').toLowerCase();

    try {
        if (action === 'backup') {
            const backupPath = createBackupNow(dbPath, backupDir);
            console.log(`Backup created: ${backupPath}`);
        } else if (action === 'restore') {
            const restoredFrom = restoreLatestBackup(dbPath, backupDir);
            console.log(`Database restored from: ${restoredFrom}`);
        } else {
            console.error('Usage: electron electron/db-tools.js <backup|restore>');
            process.exitCode = 1;
        }
    } catch (error) {
        console.error(String(error?.message || error));
        process.exitCode = 1;
    } finally {
        app.quit();
    }
}

run();
