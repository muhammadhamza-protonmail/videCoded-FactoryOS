const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const BACKUP_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
const MAX_BACKUP_FILES = 14;
const LAST_BACKUP_FILE = 'last-backup.json';
const CLOUD_SYNC_FILE = 'cloud-sync.json';
const SERVICE_ACCOUNT_FILE = 'service-account.json';
const BACKUP_CONFIG_FILE = 'backup-config.json';

function ensureDirectory(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

function buildBackupPath(backupDir) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return path.join(backupDir, `database-${timestamp}.sqlite`);
}

function pruneOldBackups(backupDir) {
    const backups = fs.readdirSync(backupDir)
        .filter((name) => name.endsWith('.sqlite'))
        .map((name) => ({
            name,
            fullPath: path.join(backupDir, name),
            mtime: fs.statSync(path.join(backupDir, name)).mtimeMs
        }))
        .sort((a, b) => b.mtime - a.mtime);

    backups.slice(MAX_BACKUP_FILES).forEach((backup) => {
        fs.unlinkSync(backup.fullPath);
    });

    // Cleanup sync status for deleted files
    const syncStatus = readCloudSyncStatus(backupDir);
    const updatedStatus = {};
    const remainingFileNames = backups.slice(0, MAX_BACKUP_FILES).map(b => b.name);
    
    remainingFileNames.forEach(name => {
        if (syncStatus[name]) updatedStatus[name] = syncStatus[name];
    });
    writeCloudSyncStatus(backupDir, updatedStatus);
}

function readLastBackupAt(backupDir) {
    const markerPath = path.join(backupDir, LAST_BACKUP_FILE);
    if (!fs.existsSync(markerPath)) return 0;

    try {
        const content = JSON.parse(fs.readFileSync(markerPath, 'utf8'));
        return Number(content.lastBackupAt || 0);
    } catch {
        return 0;
    }
}

function writeLastBackupAt(backupDir, timestamp) {
    const markerPath = path.join(backupDir, LAST_BACKUP_FILE);
    fs.writeFileSync(markerPath, JSON.stringify({ lastBackupAt: timestamp }, null, 2), 'utf8');
}

function readCloudSyncStatus(backupDir) {
    const statusPath = path.join(backupDir, CLOUD_SYNC_FILE);
    if (!fs.existsSync(statusPath)) return {};
    try {
        return JSON.parse(fs.readFileSync(statusPath, 'utf8'));
    } catch {
        return {};
    }
}

function writeCloudSyncStatus(backupDir, status) {
    const statusPath = path.join(backupDir, CLOUD_SYNC_FILE);
    fs.writeFileSync(statusPath, JSON.stringify(status, null, 2), 'utf8');
}

function createBackupNow(dbPath, backupDir) {
    ensureDirectory(backupDir);
    if (!fs.existsSync(dbPath)) {
        throw new Error(`Database not found at ${dbPath}`);
    }

    const backupPath = buildBackupPath(backupDir);
    fs.copyFileSync(dbPath, backupPath);
    
    const fileName = path.basename(backupPath);
    writeLastBackupAt(backupDir, Date.now());
    
    // Mark as pending for cloud sync
    const syncStatus = readCloudSyncStatus(backupDir);
    syncStatus[fileName] = { status: 'pending', createdAt: Date.now() };
    writeCloudSyncStatus(backupDir, syncStatus);

    pruneOldBackups(backupDir);
    return backupPath;
}

function createBackupIfDue(dbPath, backupDir) {
    const lastBackupAt = readLastBackupAt(backupDir);
    const isDue = Date.now() - lastBackupAt >= BACKUP_INTERVAL_MS;
    if (!isDue) return null;
    return createBackupNow(dbPath, backupDir);
}

async function syncWithCloud(backupDir, userDataDir) {
    ensureDirectory(backupDir);
    const serviceAccountPath = path.join(userDataDir, SERVICE_ACCOUNT_FILE);
    const configPath = path.join(userDataDir, BACKUP_CONFIG_FILE);

    if (!fs.existsSync(serviceAccountPath)) {
        console.log('Cloud sync skipped: service-account.json missing in userData');
        return;
    }

    let folderId = '';
    if (fs.existsSync(configPath)) {
        try {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            folderId = config.googleDriveFolderId;
        } catch (err) {
            console.error('Error reading backup-config.json:', err);
        }
    }

    if (!folderId || folderId === "PASTE_YOUR_FOLDER_ID_HERE") {
        console.log('Cloud sync skipped: googleDriveFolderId not configured');
        if (!fs.existsSync(configPath)) {
            fs.writeFileSync(configPath, JSON.stringify({ googleDriveFolderId: "PASTE_YOUR_FOLDER_ID_HERE" }, null, 2));
        }
        return;
    }

    // NEW: Scan for existing backups that aren't in the sync status yet
    const syncStatus = readCloudSyncStatus(backupDir);
    const filesInDir = fs.readdirSync(backupDir).filter(name => name.endsWith('.sqlite'));
    let hasNewPending = false;
    
    filesInDir.forEach(name => {
        if (!syncStatus[name]) {
            syncStatus[name] = { status: 'pending', createdAt: fs.statSync(path.join(backupDir, name)).mtimeMs };
            hasNewPending = true;
        }
    });
    
    if (hasNewPending) {
        writeCloudSyncStatus(backupDir, syncStatus);
    }

    const pendingFiles = Object.keys(syncStatus)
        .filter(name => syncStatus[name].status === 'pending')
        .sort((a, b) => syncStatus[b].createdAt - syncStatus[a].createdAt);

    if (pendingFiles.length === 0) return;

    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: serviceAccountPath,
            scopes: ['https://www.googleapis.com/auth/drive.file'],
        });

        const drive = google.drive({ version: 'v3', auth });

        for (const fileName of pendingFiles) {
            const filePath = path.join(backupDir, fileName);
            if (!fs.existsSync(filePath)) continue;

            console.log(`Syncing ${fileName} to Google Drive...`);
            
            try {
                await drive.files.create({
                    requestBody: {
                        name: fileName,
                        parents: [folderId],
                    },
                    media: {
                        mimeType: 'application/x-sqlite3',
                        body: fs.createReadStream(filePath),
                    },
                });

                syncStatus[fileName].status = 'synced';
                syncStatus[fileName].syncedAt = Date.now();
                writeCloudSyncStatus(backupDir, syncStatus);
                console.log(`Successfully synced ${fileName}`);
            } catch (err) {
                console.error(`Failed to upload ${fileName}:`, err.message);
                // Continue to next file if one fails
            }
        }
    } catch (error) {
        console.error('Cloud Sync Connection Failed:', error.message);
    }
}

module.exports = {
    createBackupNow,
    createBackupIfDue,
    syncWithCloud
};
