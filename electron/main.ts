import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { readFile } from 'fs/promises'
import Store from 'electron-store'
import { IPC_CHANNELS } from '../shared/types'
import type { Cartridge, AppSettings } from '../shared/types'
import { is } from '@electron-toolkit/utils'
import defaultCartridges from '../data/default-cartridges.json'

// ============================================================
// 持久化存储
// ============================================================
const store = new Store({
  defaults: {
    cartridges: defaultCartridges as Cartridge[],
    settings: {
      audio: { masterVolume: 0.8, sfxVolume: 0.6, sfxEnabled: true },
      video: { scale: 2, scanlines: false, crtFilter: false },
      input: {
        player1Keys: {
          up: ['ArrowUp', 'KeyW'],
          down: ['ArrowDown', 'KeyS'],
          left: ['ArrowLeft', 'KeyA'],
          right: ['ArrowRight', 'KeyD'],
          a: ['KeyJ', 'KeyZ'],
          b: ['KeyK', 'KeyX'],
          start: ['Enter'],
          select: ['ShiftLeft']
        },
        player2Keys: {
          up: ['KeyI'],
          down: ['KeyK'],
          left: ['KeyJ'],
          right: ['KeyL'],
          a: ['KeyO'],
          b: ['KeyP'],
          start: ['Digit1'],
          select: ['Digit2']
        },
        gamepadConfig: {
          up: 12, down: 13, left: 14, right: 15,
          a: 0, b: 1, start: 9, select: 8
        },
        gamepadDeadzone: 0.3
      },
      general: { language: 'zh-CN', autoSaveInterval: 60, theme: 'famicom' }
    } as AppSettings
  }
})

// ============================================================
// 创建主窗口
// ============================================================
let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 768,
    title: 'FC Platform - 红白机模拟平台',
    backgroundColor: '#1a1a2e',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.setMenu(null)

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// ============================================================
// IPC 处理器
// ============================================================
function setupIPC(): void {
  // 加载卡带列表
  ipcMain.handle(IPC_CHANNELS.LOAD_CARTRIDGES, () => {
    return store.get('cartridges')
  })

  // 保存卡带列表
  ipcMain.handle(IPC_CHANNELS.SAVE_CARTRIDGES, (_event, cartridges: Cartridge[]) => {
    store.set('cartridges', cartridges)
    return true
  })

  // 获取设置
  ipcMain.handle(IPC_CHANNELS.GET_SETTINGS, () => {
    return store.get('settings')
  })

  // 保存设置
  ipcMain.handle(IPC_CHANNELS.SAVE_SETTINGS, (_event, settings: AppSettings) => {
    store.set('settings', settings)
    return true
  })

  // 选择ROM文件
  ipcMain.handle(IPC_CHANNELS.SELECT_ROM, async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: '选择ROM文件',
      filters: [
        { name: 'NES ROM', extensions: ['nes', 'fds', 'unf', 'unif'] },
        { name: '所有文件', extensions: ['*'] }
      ],
      properties: ['openFile', 'multiSelections']
    })
    if (result.canceled) return null
    return result.filePaths
  })

  // 导入卡带配置
  ipcMain.handle(IPC_CHANNELS.IMPORT_CARTRIDGE, async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: '导入卡带配置',
      filters: [{ name: 'FC卡带包', extensions: ['fcpack', 'json'] }],
      properties: ['openFile']
    })
    if (result.canceled) return null
    return result.filePaths[0]
  })

  // 导出卡带配置
  ipcMain.handle(IPC_CHANNELS.EXPORT_CARTRIDGE, async (_event, defaultName: string) => {
    const result = await dialog.showSaveDialog(mainWindow!, {
      title: '导出卡带配置',
      defaultPath: `${defaultName}.fcpack`,
      filters: [{ name: 'FC卡带包', extensions: ['fcpack'] }]
    })
    if (result.canceled) return null
    return result.filePath
  })

  // 获取应用路径
  ipcMain.handle(IPC_CHANNELS.GET_APP_PATH, () => {
    return app.getPath('userData')
  })

  // 读取 ROM 文件字节（用于 iNES 头解析）
  ipcMain.handle(IPC_CHANNELS.READ_ROM_BYTES, async (_event, filePath: string) => {
    try {
      const buffer = await readFile(filePath)
      // 只返回前 16 字节（iNES header）就足够解析
      return new Uint8Array(buffer.slice(0, 16))
    } catch (err) {
      console.error('[main] READ_ROM_BYTES failed:', err)
      return null
    }
  })
}

// ============================================================
// 应用生命周期
// ============================================================
app.whenReady().then(() => {
  setupIPC()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
