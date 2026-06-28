import { create } from 'zustand'
import type { AppView, Cartridge } from '@shared/types'

// ============================================================
// 主应用状态 Store
// ============================================================

type ScreenEffect = 'none' | 'on' | 'off' | 'flicker'

interface AppState {
  // --- 状态 ---
  /** 当前应用视图 */
  view: AppView
  /** 主机是否"开机" */
  powerOn: boolean
  /** 当前插入的卡带 */
  currentCartridge: Cartridge | null
  /** 菜单中当前选中的游戏索引 */
  selectedGameIndex: number
  /** 游戏菜单当前页 */
  menuPage: number
  /** 视图切换动画中 */
  isTransitioning: boolean
  /** 屏幕过渡特效 */
  screenEffect: ScreenEffect

  // --- Actions ---
  /** 切换当前视图 */
  setView: (view: AppView) => void
  /** 切换电源，触发屏幕特效 */
  powerToggle: () => void
  /** 插入卡带，播放动画，切换到菜单 */
  insertCartridge: (cartridge: Cartridge) => void
  /** 弹出卡带，回到主机视图 */
  ejectCartridge: () => void
  /** 设置选中的游戏索引 */
  selectGame: (index: number) => void
  /** 菜单下一页 */
  nextPage: () => void
  /** 菜单上一页 */
  prevPage: () => void
  /** 从菜单进入游戏视图 */
  startGame: () => void
  /** 重置主机（动画回到菜单） */
  resetConsole: () => void
}

export const useAppStore = create<AppState>((set, get) => ({
  // --- 初始状态 ---
  view: 'console',
  powerOn: false,
  currentCartridge: null,
  selectedGameIndex: 0,
  menuPage: 0,
  isTransitioning: false,
  screenEffect: 'none',

  // --- Actions ---

  setView: (view) => {
    set({ view })
  },

  powerToggle: () => {
    const { powerOn } = get()
    if (powerOn) {
      // 关机：屏幕关闭特效 → 回到主机视图
      set({ screenEffect: 'off', isTransitioning: true })
      setTimeout(() => {
        set({
          powerOn: false,
          view: 'console',
          screenEffect: 'none',
          isTransitioning: false,
          selectedGameIndex: 0,
          menuPage: 0,
        })
      }, 500)
    } else {
      // 开机：屏幕开启特效
      set({ screenEffect: 'on', isTransitioning: true })
      setTimeout(() => {
        set({
          powerOn: true,
          screenEffect: 'none',
          isTransitioning: false,
        })
      }, 500)
    }
  },

  insertCartridge: (cartridge) => {
    set({ isTransitioning: true, screenEffect: 'flicker' })
    setTimeout(() => {
      set({
        currentCartridge: cartridge,
        view: 'menu',
        selectedGameIndex: 0,
        menuPage: 0,
        powerOn: true,
        screenEffect: 'none',
        isTransitioning: false,
      })
    }, 400)
  },

  ejectCartridge: () => {
    set({ isTransitioning: true, screenEffect: 'off' })
    setTimeout(() => {
      set({
        currentCartridge: null,
        view: 'console',
        powerOn: false,
        selectedGameIndex: 0,
        menuPage: 0,
        screenEffect: 'none',
        isTransitioning: false,
      })
    }, 500)
  },

  selectGame: (index) => {
    set({ selectedGameIndex: index })
  },

  nextPage: () => {
    set((state) => ({ menuPage: state.menuPage + 1 }))
  },

  prevPage: () => {
    set((state) => ({
      menuPage: Math.max(0, state.menuPage - 1),
    }))
  },

  startGame: () => {
    const { currentCartridge } = get()
    if (!currentCartridge) return
    set({ isTransitioning: true, screenEffect: 'flicker' })
    setTimeout(() => {
      set({
        view: 'game',
        screenEffect: 'none',
        isTransitioning: false,
      })
    }, 300)
  },

  resetConsole: () => {
    set({ isTransitioning: true, screenEffect: 'flicker' })
    setTimeout(() => {
      set({
        view: 'menu',
        selectedGameIndex: 0,
        menuPage: 0,
        screenEffect: 'none',
        isTransitioning: false,
      })
    }, 400)
  },
}))
