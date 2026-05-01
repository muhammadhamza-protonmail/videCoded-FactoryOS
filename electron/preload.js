const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopApp', {
    isDesktop: true,
    send: (channel, data) => {
        const validChannels = ['google-auth-start', 'google-set-folder'];
        if (validChannels.includes(channel)) {
            ipcRenderer.send(channel, data);
        }
    },
    invoke: (channel, data) => {
        const validChannels = ['google-auth-status'];
        if (validChannels.includes(channel)) {
            return ipcRenderer.invoke(channel, data);
        }
    },
    on: (channel, func) => {
        const validChannels = ['google-auth-success', 'google-config-updated'];
        if (validChannels.includes(channel)) {
            ipcRenderer.on(channel, (event, ...args) => func(...args));
        }
    }
});
