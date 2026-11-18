import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('hsos', {});

/** Hands a service's message port from main to the page (card 005, §2.2). */
ipcRenderer.on('hsos-port', (event) => window.postMessage('hsos-port', '*', event.ports));
