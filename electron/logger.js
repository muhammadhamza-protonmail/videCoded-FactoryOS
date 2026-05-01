const fs = require('fs');
const path = require('path');

let logFilePath = null;

function initLogger(userDataDir) {
    const logDir = path.join(userDataDir, 'logs');
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
    }
    logFilePath = path.join(logDir, 'app.log');
}

function log(message, level = 'INFO') {
    if (!logFilePath) return;

    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${level}] ${message}\n`;

    console.log(logEntry.trim());
    
    try {
        fs.appendFileSync(logFilePath, logEntry, 'utf8');
    } catch (err) {
        console.error('Failed to write to log file:', err);
    }
}

function error(message, err) {
    let detail = message;
    if (err) {
        detail += ` | Error: ${err.message || err}`;
        if (err.stack) {
            detail += `\nStack: ${err.stack}`;
        }
    }
    log(detail, 'ERROR');
}

module.exports = {
    initLogger,
    log,
    error
};
