import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('hsos', {});
