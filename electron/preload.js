const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopApp', {
    isDesktop: true,
    send: (channel, data) => {
        const validChannels = ['google-auth-start', 'google-set-folder', 'google-set-backup-dir'];
        if (validChannels.includes(channel)) {
            ipcRenderer.send(channel, data);
        }
    },
    invoke: (channel, data) => {
        const validChannels = ['google-auth-status', 'backup-now'];
        if (validChannels.includes(channel)) {
            return ipcRenderer.invoke(channel, data);
        }
    },
    on: (channel, func) => {
        const validChannels = ['google-auth-success', 'google-config-updated', 'google-auth-failed'];
        if (validChannels.includes(channel)) {
            ipcRenderer.on(channel, (event, ...args) => func(...args));
        }
    }
});
