const { app, BrowserWindow, dialog } = require('electron');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { createBackupIfDue, syncWithCloud, isCloudSyncConfigured, ensurePlaceholderFiles } = require('./backup');
const logger = require('./logger');


const BACKEND_PORT = Number(process.env.BACKEND_PORT || 5000);
const FRONTEND_PORT = Number(process.env.FRONTEND_PORT || 3000);
const APP_ICON_PATH = path.join(__dirname, 'assets', 'app.ico');
const HEALTH_CHECK_INTERVAL_MS = 15000;
const MAX_RESTARTS_PER_MINUTE = 3;

let backendProcess = null;
let frontendProcess = null;
let mainWindow = null;
let runtimeContext = null;
let healthTimer = null;
let isQuitting = false;

const restartHistory = {
    backend: [],
    frontend: []
};

const restartLocks = {
    backend: false,
    frontend: false
};

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
    app.quit();
}

function resolveRuntimePaths() {
    if (app.isPackaged) {
        return {
            backendDir: path.join(process.resourcesPath, 'backend'),
            frontendDir: path.join(process.resourcesPath, 'frontend')
        };
    }

    const rootDir = path.resolve(__dirname, '..');
    return {
        backendDir: path.join(rootDir, 'backend'),
        frontendDir: path.join(rootDir, 'frontend')
    };
}

function ensureWritableData(backendDir) {
    const userDataDir = app.getPath('userData');
    const dataDir = path.join(userDataDir, 'data');
    const uploadsDir = path.join(userDataDir, 'uploads');
    const backupDir = path.join(userDataDir, 'backups');
    const dbTargetPath = path.join(dataDir, 'database.sqlite');
    const dbSourcePath = path.join(backendDir, 'database.sqlite');

    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

    if (!fs.existsSync(dbTargetPath)) {
        if (!fs.existsSync(dbSourcePath)) {
            throw new Error(`Database seed missing at ${dbSourcePath}`);
        }
        fs.copyFileSync(dbSourcePath, dbTargetPath);
    }

    return { dbPath: dbTargetPath, uploadsDir, backupDir };
}

function validatePackagedRuntime(backendDir, frontendDir) {
    const requiredPaths = [
        path.join(backendDir, 'server.js'),
        path.join(backendDir, 'node_modules'),
        path.join(frontendDir, 'server.js'),
        path.join(frontendDir, 'node_modules'),
        path.join(frontendDir, '.next', 'static'),
        path.join(frontendDir, 'public')
    ];

    requiredPaths.forEach((requiredPath) => {
        if (!fs.existsSync(requiredPath)) {
            throw new Error(`Missing runtime resource: ${requiredPath}`);
        }
    });
}

function waitForUrl(url, timeoutMs = 90000) {
    const startedAt = Date.now();

    return new Promise((resolve, reject) => {
        const attempt = () => {
            const request = http.get(url, (response) => {
                response.resume();
                resolve();
            });

            request.on('error', () => {
                if (Date.now() - startedAt > timeoutMs) {
                    reject(new Error(`Timed out waiting for ${url}`));
                    return;
                }
                setTimeout(attempt, 500);
            });
        };

        attempt();
    });
}

function waitForUrlOrExit(url, childProcess, serviceName, timeoutMs = 90000) {
    const startedAt = Date.now();

    return new Promise((resolve, reject) => {
        let done = false;

        const finish = (fn) => (value) => {
            if (done) return;
            done = true;
            fn(value);
        };

        const onResolve = finish(resolve);
        const onReject = finish(reject);

        const attempt = () => {
            if (done) return;
            const request = http.get(url, (response) => {
                response.resume();
                onResolve();
            });

            request.on('error', () => {
                if (Date.now() - startedAt > timeoutMs) {
                    onReject(new Error(`Timed out waiting for ${url}`));
                    return;
                }
                setTimeout(attempt, 500);
            });
        };

        childProcess.once('exit', (code, signal) => {
            onReject(new Error(`${serviceName} exited before ready (code=${code}, signal=${signal})`));
        });

        attempt();
    });
}

function pingUrl(url, timeoutMs = 3000) {
    return new Promise((resolve) => {
        const request = http.get(url, (response) => {
            response.resume();
            resolve(true);
        });

        request.setTimeout(timeoutMs, () => {
            request.destroy();
            resolve(false);
        });

        request.on('error', () => resolve(false));
    });
}

function isRestartAllowed(serviceName) {
    const now = Date.now();
    restartHistory[serviceName] = restartHistory[serviceName].filter((entry) => now - entry < 60000);

    if (restartHistory[serviceName].length >= MAX_RESTARTS_PER_MINUTE) {
        return false;
    }

    restartHistory[serviceName].push(now);
    return true;
}

function stopChildProcesses() {
    if (healthTimer) {
        clearInterval(healthTimer);
        healthTimer = null;
    }

    if (frontendProcess && !frontendProcess.killed) frontendProcess.kill();
    if (backendProcess && !backendProcess.killed) backendProcess.kill();

    frontendProcess = null;
    backendProcess = null;
}

function spawnWithNodeRuntime(scriptPath, scriptArgs, cwd, extraEnv) {
    return spawn(process.execPath, [scriptPath, ...scriptArgs], {
        cwd,
        env: {
            ...process.env,
            ...extraEnv,
            ELECTRON_RUN_AS_NODE: '1'
        },
        stdio: 'inherit',
        shell: false
    });
}

function ensureFrontendBuild(frontendDir) {
    const buildIdFile = path.join(frontendDir, '.next', 'BUILD_ID');
    if (process.env.ELECTRON_START_MODE === 'dev' || fs.existsSync(buildIdFile)) {
        return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
        const nextBinPath = path.join(frontendDir, 'node_modules', 'next', 'dist', 'bin', 'next');
        const builder = spawnWithNodeRuntime(nextBinPath, ['build'], frontendDir, {});

        builder.on('exit', (code) => {
            if (code === 0) resolve();
            else reject(new Error('Frontend build failed before startup'));
        });

        builder.on('error', reject);
    });
}

function startBackend(backendDir, dbPath, uploadsDir) {
    return new Promise((resolve, reject) => {
        const env = {
            ...process.env,
            PORT: String(BACKEND_PORT),
            DB_PATH: dbPath,
            UPLOADS_DIR: uploadsDir,
            DOTENV_PATH: path.join(backendDir, '.env'),
            JWT_SECRET: process.env.JWT_SECRET || 'factory_desktop_local_secret'
        };

        logger.log(`Starting backend... DB: ${dbPath}`);
        backendProcess = spawnWithNodeRuntime(path.join(backendDir, 'server.js'), [], backendDir, env);

        backendProcess.once('error', reject);
        waitForUrlOrExit(`http://127.0.0.1:${BACKEND_PORT}/api/auth/me`, backendProcess, 'backend', 45000)
            .then(resolve)
            .catch(reject);
    });
}

function startFrontend(frontendDir) {
    return new Promise((resolve, reject) => {
        const isDevMode = process.env.ELECTRON_START_MODE === 'dev' && !app.isPackaged;
        const env = {
            ...process.env,
            NEXT_PUBLIC_API_BASE_URL: `http://127.0.0.1:${BACKEND_PORT}/api`
        };

        if (isDevMode) {
            const nextBinPath = path.join(frontendDir, 'node_modules', 'next', 'dist', 'bin', 'next');
            const args = ['dev', '-p', String(FRONTEND_PORT), '-H', '127.0.0.1'];
            frontendProcess = spawnWithNodeRuntime(nextBinPath, args, frontendDir, {
                ...env,
                NODE_OPTIONS: '--max-old-space-size=4096'
            });
        } else {
            frontendProcess = spawnWithNodeRuntime(standaloneServerPath, [], standaloneDir, {
                ...env,
                PORT: String(FRONTEND_PORT),
                HOSTNAME: '127.0.0.1'
            });
            logger.log(`Starting frontend (Production mode) on port ${FRONTEND_PORT}`);
        }

        frontendProcess.once('error', reject);
        waitForUrlOrExit(`http://127.0.0.1:${FRONTEND_PORT}`, frontendProcess, 'frontend', 150000)
            .then(resolve)
            .catch(reject);
    });
}

async function restartService(serviceName, reason) {
    if (isQuitting || restartLocks[serviceName]) return;
    if (!runtimeContext) return;

    if (!isRestartAllowed(serviceName)) {
        dialog.showErrorBox(
            'Service restart limit reached',
            `${serviceName} failed repeatedly. Last reason: ${reason}`
        );
        return;
    }

    restartLocks[serviceName] = true;
    try {
        if (serviceName === 'backend') {
            if (backendProcess && !backendProcess.killed) backendProcess.kill();
            backendProcess = null;
            await startBackend(runtimeContext.backendDir, runtimeContext.dbPath, runtimeContext.uploadsDir);
        } else {
            if (frontendProcess && !frontendProcess.killed) frontendProcess.kill();
            frontendProcess = null;
            await startFrontend(runtimeContext.frontendDir);
            if (mainWindow && !mainWindow.isDestroyed()) {
                await mainWindow.loadURL(`http://127.0.0.1:${FRONTEND_PORT}`);
            }
        }
        attachServiceWatchers();
    } catch (error) {
        dialog.showErrorBox('Service restart failed', String(error?.message || error));
    } finally {
        restartLocks[serviceName] = false;
    }
}

function attachServiceWatchers() {
    if (backendProcess) {
        backendProcess.removeAllListeners('exit');
        backendProcess.on('exit', (code, signal) => {
            if (isQuitting) return;
            restartService('backend', `exit code=${code} signal=${signal}`);
        });
    }

    if (frontendProcess) {
        frontendProcess.removeAllListeners('exit');
        frontendProcess.on('exit', (code, signal) => {
            if (isQuitting) return;
            restartService('frontend', `exit code=${code} signal=${signal}`);
        });
    }
}

function startHealthMonitor() {
    if (healthTimer) clearInterval(healthTimer);

    healthTimer = setInterval(async () => {
        if (isQuitting) return;
        if (!runtimeContext) return;

        const backendOk = await pingUrl(`http://127.0.0.1:${BACKEND_PORT}/api/auth/me`);
        if (!backendOk) {
            restartService('backend', 'health check failed');
        }

        const frontendOk = await pingUrl(`http://127.0.0.1:${FRONTEND_PORT}`);
        if (!frontendOk) {
            restartService('frontend', 'health check failed');
        }
    }, HEALTH_CHECK_INTERVAL_MS);
}

async function createWindow() {
    const { backendDir, frontendDir } = resolveRuntimePaths();
    if (app.isPackaged) {
        validatePackagedRuntime(backendDir, frontendDir);
    }
    const { dbPath, uploadsDir, backupDir } = ensureWritableData(backendDir);
    const userDataDir = app.getPath('userData');
    logger.initLogger(userDataDir);
    logger.log('--- App Startup ---');
    logger.log(`Version: ${app.getVersion()}`);

    runtimeContext = { backendDir, frontendDir, dbPath, uploadsDir, backupDir };
    createBackupIfDue(dbPath, backupDir);
    
    // Attempt cloud sync on startup and then periodically
    const userDataDir = app.getPath('userData');
    ensurePlaceholderFiles(userDataDir);

    if (!isCloudSyncConfigured(userDataDir)) {
        setTimeout(() => {
            if (mainWindow && !mainWindow.isDestroyed()) {
                dialog.showMessageBox(mainWindow, {
                    type: 'info',
                    title: 'Google Drive Sync Not Configured',
                    message: 'Automatic cloud backup is currently disabled.',
                    detail: 'To enable it, please replace the placeholder service-account.json and backup-config.json files in your AppData folder with your real Google Cloud credentials.',
                    buttons: ['Got it']
                });
            }
        }, 5000); // Show after 5 seconds to not block startup
    }

    syncWithCloud(backupDir, userDataDir);
    setInterval(() => {
        syncWithCloud(backupDir, userDataDir);
    }, 15 * 60 * 1000); // Check for internet/sync every 15 minutes

    if (!app.isPackaged) {
        await ensureFrontendBuild(frontendDir);
    }
    await startBackend(backendDir, dbPath, uploadsDir);
    await startFrontend(frontendDir);

    attachServiceWatchers();
    startHealthMonitor();

    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        show: true,
        center: true,
        icon: APP_ICON_PATH,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
        dialog.showErrorBox(
            'Window load failed',
            `Failed to load ${validatedURL}\n${errorCode}: ${errorDescription}`
        );
    });

    await mainWindow.loadURL(`http://127.0.0.1:${FRONTEND_PORT}`);
    mainWindow.show();
    mainWindow.focus();
}

app.whenReady().then(async () => {
    try {
        await createWindow();
    } catch (error) {
        dialog.showErrorBox('Desktop startup failed', String(error?.message || error));
        stopChildProcesses();
        app.quit();
    }

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow().catch((error) => {
                dialog.showErrorBox('Desktop startup failed', String(error?.message || error));
            });
        }
    });
});

app.on('second-instance', () => {
    if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
    }
});

app.on('window-all-closed', () => {
    isQuitting = true;
    stopChildProcesses();
    if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
    isQuitting = true;
    stopChildProcesses();
});
