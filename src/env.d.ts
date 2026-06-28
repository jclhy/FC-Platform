/// <reference types="vite/client" />

/** Electron preload 暴露的 API 类型声明 */
interface ElectronAPI {
  // 卡带管理
  loadCartridges: () => Promise<unknown[]>
  saveCartridges: (cartridges: unknown) => Promise<boolean>
  importCartridge: () => Promise<string | null>
  exportCartridge: (name: string) => Promise<string | null>

  // ROM管理
  selectROM: () => Promise<string[] | null>
  readRomBytes: (filePath: string) => Promise<Uint8Array | null>

  // 设置
  getSettings: () => Promise<unknown>
  saveSettings: (settings: unknown) => Promise<boolean>

  // 文件
  getAppPath: () => Promise<string>
}

interface Window {
  electronAPI?: ElectronAPI
}
