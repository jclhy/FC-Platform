import { create } from 'zustand'
import type { AppSettings, KeyBindings, GamepadConfig } from '@shared/types'

// ============================================================
// 设置 Store
// ============================================================

/** 默认按键绑定 — 玩家1 */
const DEFAULT_P1_KEYS: KeyBindings = {
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  a: ['KeyJ', 'KeyZ'],
  b: ['KeyK', 'KeyX'],
  start: ['Enter'],
  select: ['ShiftLeft'],
}

/** 默认按键绑定 — 玩家2 */
const DEFAULT_P2_KEYS: KeyBindings = {
  up: ['KeyI'],
  down: ['KeyK'],
  left: ['KeyJ'],
  right: ['KeyL'],
  a: ['KeyO'],
  b: ['KeyP'],
  start: ['Digit1'],
  select: ['Digit2'],
}

/** 默认手柄配置 */
const DEFAULT_GAMEPAD: GamepadConfig = {
  up: 12,
  down: 13,
  left: 14,
  right: 15,
  a: 0,
  b: 1,
  start: 9,
  select: 8,
}

/** 默认设置 */
const DEFAULT_SETTINGS: AppSettings = {
  audio: {
    masterVolume: 0.8,
    sfxVolume: 0.6,
    sfxEnabled: true,
  },
  video: {
    scale: 2,
    scanlines: true,
    crtFilter: false,
  },
  input: {
    player1Keys: DEFAULT_P1_KEYS,
    player2Keys: DEFAULT_P2_KEYS,
    gamepadConfig: DEFAULT_GAMEPAD,
    gamepadDeadzone: 0.25,
  },
  general: {
    language: 'zh-CN',
    autoSaveInterval: 60,
    theme: 'famicom',
  },
}

interface SettingsState extends AppSettings {
  /** 设置是否已从持久层加载 */
  isLoaded: boolean

  // --- Actions ---
  /** 从 IPC 加载设置 */
  loadSettings: () => Promise<void>
  /** 持久化所有设置 */
  saveSettings: () => Promise<void>
  /** 更新音频设置 */
  updateAudio: (partial: Partial<AppSettings['audio']>) => void
  /** 更新视频设置 */
  updateVideo: (partial: Partial<AppSettings['video']>) => void
  /** 更新输入设置 */
  updateInput: (partial: Partial<AppSettings['input']>) => void
  /** 更新通用设置 */
  updateGeneral: (partial: Partial<AppSettings['general']>) => void
  /** 重置所有设置为默认值 */
  resetToDefaults: () => void
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  // --- 初始状态（默认值） ---
  ...DEFAULT_SETTINGS,
  isLoaded: false,

  // --- Actions ---

  loadSettings: async () => {
    try {
      const api = (window as any).electronAPI
      const saved: Partial<AppSettings> | undefined = await api?.getSettings()
      if (saved) {
        // 深度合并：每组合并一层，缺失字段保留默认值
        set({
          audio: { ...DEFAULT_SETTINGS.audio, ...saved.audio },
          video: { ...DEFAULT_SETTINGS.video, ...saved.video },
          input: { ...DEFAULT_SETTINGS.input, ...saved.input },
          general: { ...DEFAULT_SETTINGS.general, ...saved.general },
          isLoaded: true,
        })
      } else {
        set({ isLoaded: true })
      }
    } catch (err) {
      console.warn('[settings-store] loadSettings failed, using defaults:', err)
      set({ isLoaded: true })
    }
  },

  saveSettings: async () => {
    try {
      const api = (window as any).electronAPI
      const { audio, video, input, general } = get()
      await api?.saveSettings({ audio, video, input, general })
    } catch (err) {
      console.warn('[settings-store] saveSettings failed:', err)
    }
  },

  updateAudio: (partial) => {
    set((state) => ({
      audio: { ...state.audio, ...partial },
    }))
  },

  updateVideo: (partial) => {
    set((state) => ({
      video: { ...state.video, ...partial },
    }))
  },

  updateInput: (partial) => {
    set((state) => ({
      input: { ...state.input, ...partial },
    }))
  },

  updateGeneral: (partial) => {
    set((state) => ({
      general: { ...state.general, ...partial },
    }))
  },

  resetToDefaults: () => {
    set({
      ...DEFAULT_SETTINGS,
      isLoaded: true,
    })
  },
}))
