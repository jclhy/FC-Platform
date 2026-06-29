// ============================================================
// 共享类型定义
// ============================================================

/** 卡带类型 */
export type CartridgeType = 'multicart' | 'single' | 'custom'

/** 卡带中单个游戏条目 */
export interface GameEntry {
  id: string
  name: string
  nameEn?: string
  romPath?: string       // ROM文件路径（用户导入后填充）
  romHash?: string       // ROM hash（用于匹配）
  mapper?: number        // NES mapper编号
  icon?: string          // 游戏图标（可选）
}

/** 卡带定义 */
export interface Cartridge {
  id: string
  name: string           // 卡带名称（如 "64合1"）
  type: CartridgeType
  color: string          // 卡带外壳颜色
  labelColor: string     // 标签颜色
  games: GameEntry[]     // 游戏列表
  coverImage?: string    // 封面图路径
  createdAt: number
  updatedAt: number
}

/** 应用视图状态 */
export type AppView = 'console' | 'menu' | 'game' | 'settings'

/** 输入动作（统一抽象） */
export type InputAction =
  | 'up' | 'down' | 'left' | 'right'
  | 'a' | 'b'
  | 'start' | 'select'

/** 按键绑定配置 */
export interface KeyBindings {
  [action: string]: string[]  // 一个动作可绑定多个键
}

/** 手柄配置 */
export interface GamepadConfig {
  [action: string]: number   // 动作 → 手柄按键索引
}

/** 连发配置：动作 → 是否启用连发 */
export interface TurboConfig {
  [action: string]: boolean
}

/** 应用设置 */
export interface AppSettings {
  audio: {
    masterVolume: number
    sfxVolume: number
    sfxEnabled: boolean
  }
  video: {
    scale: number
    scanlines: boolean
    crtFilter: boolean
  }
  input: {
    player1Keys: KeyBindings
    player2Keys: KeyBindings
    gamepadConfig: GamepadConfig
    gamepadDeadzone: number
    turbo: TurboConfig
    turboRate: number             // 连发频率（帧数/次，3=每3帧toggle一次 ≈ 20Hz@60fps）
  }
  general: {
    language: 'zh-CN' | 'en'
    autoSaveInterval: number
    theme: 'famicom' | 'av-famicom' | 'nes'
  }
}

/** IPC 通道定义 */
export const IPC_CHANNELS = {
  // ROM管理
  SELECT_ROM: 'rom:select',
  SCAN_ROM: 'rom:scan',
  GET_ROM_INFO: 'rom:info',
  READ_ROM_BYTES: 'rom:read-bytes',
  LOAD_ROM_DATA: 'rom:load-data',
  // 卡带管理
  LOAD_CARTRIDGES: 'cartridge:load',
  SAVE_CARTRIDGES: 'cartridge:save',
  IMPORT_CARTRIDGE: 'cartridge:import',
  EXPORT_CARTRIDGE: 'cartridge:export',
  // 配置
  GET_SETTINGS: 'settings:get',
  SAVE_SETTINGS: 'settings:save',
  // 文件
  GET_APP_PATH: 'app:path',
  OPEN_FILE_DIALOG: 'file:dialog'
} as const
