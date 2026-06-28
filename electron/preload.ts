import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '../shared/types'

// 暴露安全的 IPC API 给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 卡带管理
  loadCartridges: () => ipcRenderer.invoke(IPC_CHANNELS.LOAD_CARTRIDGES),
  saveCartridges: (cartridges: unknown) =>
    ipcRenderer.invoke(IPC_CHANNELS.SAVE_CARTRIDGES, cartridges),
  importCartridge: () => ipcRenderer.invoke(IPC_CHANNELS.IMPORT_CARTRIDGE),
  exportCartridge: (name: string) => ipcRenderer.invoke(IPC_CHANNELS.EXPORT_CARTRIDGE, name),

  // ROM管理
  selectROM: () => ipcRenderer.invoke(IPC_CHANNELS.SELECT_ROM),
  readRomBytes: (filePath: string) => ipcRenderer.invoke(IPC_CHANNELS.READ_ROM_BYTES, filePath),

  // 设置
  getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.GET_SETTINGS),
  saveSettings: (settings: unknown) => ipcRenderer.invoke(IPC_CHANNELS.SAVE_SETTINGS, settings),

  // 文件
  getAppPath: () => ipcRenderer.invoke(IPC_CHANNELS.GET_APP_PATH)
})
