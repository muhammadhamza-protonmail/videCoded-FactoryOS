const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const logger = require('./logger');

const BACKUP_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
const MAX_BACKUP_FILES = 14;
const LAST_BACKUP_FILE = 'last-backup.json';
const CLOUD_SYNC_FILE = 'cloud-sync.json';
const SERVICE_ACCOUNT_FILE = 'service-account.json';
const BACKUP_CONFIG_FILE = 'backup-config.json';
const GOOGLE_AUTH_FILE = 'google-auth.json';

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
        logger.log(`Pruned old backup: ${backup.name}`);
    });

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
        logger.error(`Backup failed: Database not found at ${dbPath}`);
        throw new Error(`Database not found at ${dbPath}`);
    }

    const backupPath = buildBackupPath(backupDir);
    fs.copyFileSync(dbPath, backupPath);
    
    const fileName = path.basename(backupPath);
    writeLastBackupAt(backupDir, Date.now());
    
    const syncStatus = readCloudSyncStatus(backupDir);
    syncStatus[fileName] = { status: 'pending', createdAt: Date.now() };
    writeCloudSyncStatus(backupDir, syncStatus);

    logger.log(`Created new local backup: ${fileName}`);
    pruneOldBackups(backupDir);
    return backupPath;
}

function createBackupIfDue(dbPath, backupDir) {
    const lastBackupAt = readLastBackupAt(backupDir);
    const isDue = Date.now() - lastBackupAt >= BACKUP_INTERVAL_MS;
    if (!isDue) return null;
    return createBackupNow(dbPath, backupDir);
}

function isCloudSyncConfigured(userDataDir) {
    const authPath = path.join(userDataDir, GOOGLE_AUTH_FILE);
    const serviceAccountPath = path.join(userDataDir, SERVICE_ACCOUNT_FILE);
    const configPath = path.join(userDataDir, BACKUP_CONFIG_FILE);

    // Prefer OAuth2
    if (fs.existsSync(authPath)) return true;

    // Fallback to Service Account
    if (fs.existsSync(serviceAccountPath)) {
        try {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            if (config.googleDriveFolderId && config.googleDriveFolderId !== "PASTE_YOUR_FOLDER_ID_HERE") {
                const sa = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
                if (sa.client_email && !sa.client_email.includes("YOUR_SERVICE_ACCOUNT_EMAIL")) {
                    return true;
                }
            }
        } catch {}
    }

    return false;
}

function ensurePlaceholderFiles(userDataDir) {
    const configPath = path.join(userDataDir, BACKUP_CONFIG_FILE);
    if (!fs.existsSync(configPath)) {
        const configPlaceholder = {
            "googleDriveFolderId": "PASTE_YOUR_FOLDER_ID_HERE"
        };
        fs.writeFileSync(configPath, JSON.stringify(configPlaceholder, null, 2), 'utf8');
        logger.log('Created placeholder backup-config.json');
    }
}

async function syncWithCloud(backupDir, userDataDir) {
    ensureDirectory(backupDir);
    const authPath = path.join(userDataDir, GOOGLE_AUTH_FILE);
    const serviceAccountPath = path.join(userDataDir, SERVICE_ACCOUNT_FILE);
    const configPath = path.join(userDataDir, BACKUP_CONFIG_FILE);

    let auth = null;
    let folderId = '';

    // Try OAuth2 First
    if (fs.existsSync(authPath)) {
        try {
            const authData = JSON.parse(fs.readFileSync(authPath, 'utf8'));
            const oauth2Client = new google.auth.OAuth2(
                authData.clientId,
                authData.clientSecret,
                'http://127.0.0.1:42813'
            );
            oauth2Client.setCredentials(authData.tokens);
            auth = oauth2Client;
            
            // Re-read config for folderId
            if (fs.existsSync(configPath)) {
                const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                folderId = config.googleDriveFolderId;
            }
            logger.log('Using Google OAuth2 for cloud sync');
        } catch (err) {
            logger.error('Failed to load OAuth2 credentials', err);
        }
    }

    // Fallback to Service Account
    if (!auth && fs.existsSync(serviceAccountPath)) {
        try {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            folderId = config.googleDriveFolderId;
            if (folderId && folderId !== "PASTE_YOUR_FOLDER_ID_HERE") {
                auth = new google.auth.GoogleAuth({
                    keyFile: serviceAccountPath,
                    scopes: ['https://www.googleapis.com/auth/drive.file'],
                });
                logger.log('Using Service Account for cloud sync');
            }
        } catch (err) {
            logger.error('Failed to load Service Account', err);
        }
    }

    if (!auth || !folderId) {
        logger.log('Cloud sync skipped: No valid authentication or folder ID found.');
        return;
    }

    const syncStatus = readCloudSyncStatus(backupDir);
    const filesInDir = fs.readdirSync(backupDir).filter(name => name.endsWith('.sqlite'));
    let hasNewPending = false;
    
    filesInDir.forEach(name => {
        if (!syncStatus[name]) {
            syncStatus[name] = { status: 'pending', createdAt: fs.statSync(path.join(backupDir, name)).mtimeMs };
            hasNewPending = true;
        }
    });
    
    if (hasNewPending) writeCloudSyncStatus(backupDir, syncStatus);

    const pendingFiles = Object.keys(syncStatus)
        .filter(name => syncStatus[name].status === 'pending')
        .sort((a, b) => syncStatus[b].createdAt - syncStatus[a].createdAt);

    if (pendingFiles.length === 0) return;

    try {
        const drive = google.drive({ version: 'v3', auth });

        for (const fileName of pendingFiles) {
            const filePath = path.join(backupDir, fileName);
            if (!fs.existsSync(filePath)) continue;

            logger.log(`Uploading ${fileName} to Google Drive folder: ${folderId}`);
            
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
                logger.log(`Successfully uploaded: ${fileName}`);
            } catch (err) {
                logger.error(`Upload failed for ${fileName}`, err);
            }
        }
    } catch (error) {
        logger.error('Cloud Sync Connection Error', error);
    }
}

module.exports = {
    createBackupNow,
    createBackupIfDue,
    syncWithCloud,
    isCloudSyncConfigured,
    ensurePlaceholderFiles
};
