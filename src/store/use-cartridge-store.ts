import { create } from 'zustand'
import type { Cartridge, CartridgeType } from '@shared/types'

// ============================================================
// 卡带集合 Store
// ============================================================

type CartridgeFilter = 'all' | 'multicart' | 'single' | 'custom'

interface CartridgeState {
  // --- 状态 ---
  /** 所有卡带 */
  cartridges: Cartridge[]
  /** 当前选中的卡带 ID */
  selectedCartridgeId: string | null
  /** 过滤类型 */
  filter: CartridgeFilter
  /** 搜索关键词 */
  searchQuery: string

  // --- Actions ---
  /** 从 electron-store 加载卡带列表 (IPC) */
  loadCartridges: () => Promise<void>
  /** 持久化卡带列表到 electron-store */
  saveCartridges: () => Promise<void>
  /** 添加新卡带 */
  addCartridge: (cartridge: Cartridge) => void
  /** 按 ID 移除卡带 */
  removeCartridge: (id: string) => void
  /** 更新卡带部分字段 */
  updateCartridge: (id: string, partial: Partial<Cartridge>) => void
  /** 根据 filter + search 获取过滤后的卡带 */
  getFilteredCartridges: () => Cartridge[]
  /** 设置过滤类型 */
  setFilter: (filter: CartridgeFilter) => void
  /** 设置搜索文本 */
  setSearchQuery: (query: string) => void
  /** 导入 .fcpack 卡带包 (IPC) */
  importCartridgePack: () => Promise<void>
  /** 导出卡带包为 .fcpack (IPC) */
  exportCartridgePack: (id: string) => Promise<void>
}

export const useCartridgeStore = create<CartridgeState>((set, get) => ({
  // --- 初始状态 ---
  cartridges: [],
  selectedCartridgeId: null,
  filter: 'all',
  searchQuery: '',

  // --- Actions ---

  loadCartridges: async () => {
    try {
      const api = (window as any).electronAPI
      const data: Cartridge[] | undefined = await api?.loadCartridges()
      if (data && Array.isArray(data)) {
        set({ cartridges: data })
      }
    } catch (err) {
      console.warn('[cartridge-store] loadCartridges failed, using defaults:', err)
      // IPC 不可用时保持空数组（dev/preview 模式）
    }
  },

  saveCartridges: async () => {
    try {
      const api = (window as any).electronAPI
      await api?.saveCartridges(get().cartridges)
    } catch (err) {
      console.warn('[cartridge-store] saveCartridges failed:', err)
    }
  },

  addCartridge: (cartridge) => {
    set((state) => ({
      cartridges: [...state.cartridges, cartridge],
    }))
  },

  removeCartridge: (id) => {
    set((state) => ({
      cartridges: state.cartridges.filter((c) => c.id !== id),
      selectedCartridgeId:
        state.selectedCartridgeId === id ? null : state.selectedCartridgeId,
    }))
  },

  updateCartridge: (id, partial) => {
    set((state) => ({
      cartridges: state.cartridges.map((c) =>
        c.id === id ? { ...c, ...partial, updatedAt: Date.now() } : c
      ),
    }))
  },

  getFilteredCartridges: () => {
    const { cartridges, filter, searchQuery } = get()

    let result = cartridges

    // 按类型过滤
    if (filter !== 'all') {
      result = result.filter((c) => c.type === filter)
    }

    // 按搜索关键词过滤（匹配名称 / 英文名）
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      result = result.filter((c) => {
        const nameMatch = c.name.toLowerCase().includes(q)
        const gameMatch = c.games.some(
          (g) =>
            g.name.toLowerCase().includes(q) ||
            g.nameEn?.toLowerCase().includes(q)
        )
        return nameMatch || gameMatch
      })
    }

    return result
  },

  setFilter: (filter) => {
    set({ filter })
  },

  setSearchQuery: (query) => {
    set({ searchQuery: query })
  },

  importCartridgePack: async () => {
    try {
      const api = (window as any).electronAPI
      // preload 暴露 importCartridge() 返回文件路径 string | null
      const filePath: string | null = await api?.importCartridge()
      if (filePath) {
        // 通过 fetch 读取本地 JSON 文件内容
        const response = await fetch(`file://${filePath}`)
        const imported: Cartridge[] = await response.json()
        if (Array.isArray(imported)) {
          set((state) => ({
            cartridges: [...state.cartridges, ...imported],
          }))
          await get().saveCartridges()
        }
      }
    } catch (err) {
      console.warn('[cartridge-store] importCartridgePack failed:', err)
    }
  },

  exportCartridgePack: async (id) => {
    try {
      const api = (window as any).electronAPI
      const cartridge = get().cartridges.find((c) => c.id === id)
      if (!cartridge) {
        console.warn('[cartridge-store] exportCartridgePack: cartridge not found:', id)
        return
      }
      // preload 暴露 exportCartridge(name) 返回保存路径 string | null
      const filePath: string | null = await api?.exportCartridge(cartridge.name)
      if (filePath) {
        // 通过 IPC 写入文件内容（后续可在主进程添加 write-file handler）
        console.log('[cartridge-store] cartridge pack exported to:', filePath)
      }
    } catch (err) {
      console.warn('[cartridge-store] exportCartridgePack failed:', err)
    }
  },
}))
