import React, { useCallback, useMemo, useRef, useEffect, useState } from 'react'
import { useCartridgeStore } from '@/store/use-cartridge-store'
import { useAppStore } from '@/store/use-app-store'
import type { Cartridge } from '@shared/types'
import CartridgeCard from './CartridgeCard'
import CartridgeEditor from './CartridgeEditor'

// ============================================================
//  CartridgeShelf -- right-side panel (~40% width)
//  The "bookshelf" where users browse and pick cartridges
// ============================================================

type CartridgeFilter = 'all' | 'multicart' | 'single' | 'custom'

interface FilterTab {
  key: CartridgeFilter
  label: string
}

const FILTER_TABS: FilterTab[] = [
  { key: 'all', label: '全部' },
  { key: 'multicart', label: '合集' },
  { key: 'single', label: '单卡' },
  { key: 'custom', label: '自定义' },
]

const CartridgeShelf: React.FC = () => {
  // --- stores ---
  const cartridges = useCartridgeStore((s) => s.cartridges)
  const filter = useCartridgeStore((s) => s.filter)
  const setFilter = useCartridgeStore((s) => s.setFilter)
  const searchQuery = useCartridgeStore((s) => s.searchQuery)
  const setSearchQuery = useCartridgeStore((s) => s.setSearchQuery)
  const getFilteredCartridges = useCartridgeStore((s) => s.getFilteredCartridges)
  const selectedCartridgeId = useCartridgeStore((s) => s.selectedCartridgeId)
  const importCartridgePack = useCartridgeStore((s) => s.importCartridgePack)
  const exportCartridgePack = useCartridgeStore((s) => s.exportCartridgePack)

  const insertCartridge = useAppStore((s) => s.insertCartridge)

  // --- editor state ---
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingCartridge, setEditingCartridge] = useState<Cartridge | null>(null)

  // --- local refs ---
  const searchInputRef = useRef<HTMLInputElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)

  // Load cartridges on mount (IPC / electron-store)
  useEffect(() => {
    useCartridgeStore.getState().loadCartridges()
  }, [])

  // --- derived ---
  const filteredCartridges = useMemo(() => getFilteredCartridges(), [
    getFilteredCartridges,
    cartridges,
    filter,
    searchQuery,
  ])

  const totalCount = cartridges.length

  // --- handlers ---

  const handleSelect = useCallback(
    (cart: Cartridge) => {
      useCartridgeStore.setState({ selectedCartridgeId: cart.id })
    },
    [],
  )

  const handleInsert = useCallback(
    (cart: Cartridge) => {
      insertCartridge(cart)
    },
    [insertCartridge],
  )

  const handleEdit = useCallback(
    (cart: Cartridge) => {
      setEditingCartridge(cart)
      setEditorOpen(true)
    },
    [],
  )

  const handleDragStart = useCallback(
    (_e: React.DragEvent, _cart: Cartridge) => {
      // Data is already set in CartridgeCard's own handler
      // Visual feedback could be added here in the future
    },
    [],
  )

  const handleAddCartridge = useCallback(() => {
    // 打开卡带编辑器，从 ROM 文件创建新卡带
    setEditingCartridge(null)
    setEditorOpen(true)
  }, [])

  const handleImportAll = useCallback(async () => {
    await importCartridgePack()
  }, [importCartridgePack])

  const handleExportAll = useCallback(async () => {
    if (!selectedCartridgeId) {
      console.log('[CartridgeShelf] no cartridge selected for export')
      return
    }
    await exportCartridgePack(selectedCartridgeId)
  }, [selectedCartridgeId, exportCartridgePack])

  return (
    <div className="cartridge-shelf flex flex-col h-full w-full overflow-hidden">

      {/* ========================================================
          HEADER
          ======================================================== */}
      <div className="flex-shrink-0 px-4 pt-4 pb-2">
        {/* Title row */}
        <div className="flex items-center justify-between mb-3">
          <h2
            style={{
              fontFamily: "'Press Start 2P', 'Zpix', monospace",
              fontSize: 16,
              color: '#FFD700',
              letterSpacing: 1,
              textShadow: '0 2px 4px rgba(0,0,0,0.5)',
              margin: 0,
            }}
          >
            卡带收藏
          </h2>

          {/* Add button */}
          <button
            onClick={handleAddCartridge}
            className="shelf-add-btn flex items-center justify-center"
            title="创建 / 导入卡带"
            style={{
              width: 30,
              height: 30,
              background: 'linear-gradient(180deg, #FFD700, #DAA520)',
              border: 'none',
              borderRadius: 4,
              color: '#1a1a2e',
              fontSize: 22,
              fontWeight: 700,
              fontFamily: 'Arial, sans-serif',
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.3)',
              transition: 'transform 0.1s ease, box-shadow 0.1s ease',
              lineHeight: 1,
            }}
          >
            +
          </button>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 mb-3">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className="shelf-filter-tab"
              style={{
                flex: 1,
                padding: '5px 0',
                fontFamily: "'Press Start 2P', 'Zpix', monospace",
                fontSize: 11,
                color: filter === tab.key ? '#1a1a2e' : '#AAA',
                background: filter === tab.key
                  ? 'linear-gradient(180deg, #FFD700, #DAA520)'
                  : 'rgba(255,255,255,0.06)',
                border: filter === tab.key
                  ? '1px solid #DAA520'
                  : '1px solid rgba(255,255,255,0.1)',
                borderRadius: 3,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                letterSpacing: 0.5,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search input */}
        <div className="relative">
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索卡带..."
            className="shelf-search-input w-full"
            style={{
              fontFamily: "'Press Start 2P', 'Zpix', monospace",
              fontSize: 12,
              padding: '7px 10px 7px 28px',
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 4,
              color: '#E0E0E0',
              outline: 'none',
              transition: 'border-color 0.15s ease, background 0.15s ease',
            }}
          />
          {/* Search icon (pixel magnifier) */}
          <div
            style={{
              position: 'absolute',
              left: 9,
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: 15,
              color: '#666',
              pointerEvents: 'none',
              lineHeight: 1,
            }}
          >
            &#x1F50D;
          </div>
        </div>
      </div>

      {/* ========================================================
          CARTRIDGE GRID
          ======================================================== */}
      <div
        ref={gridRef}
        className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-2"
        style={{
          scrollbarGutter: 'stable',
        }}
      >
        {filteredCartridges.length > 0 ? (
          <div
            className="shelf-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
              gap: '16px 12px',
              justifyItems: 'center',
              paddingBottom: 16,
            }}
          >
            {filteredCartridges.map((cart) => (
              <CartridgeCard
                key={cart.id}
                cartridge={cart}
                isSelected={selectedCartridgeId === cart.id}
                onSelect={() => handleSelect(cart)}
                onInsert={() => handleInsert(cart)}
                onEdit={() => handleEdit(cart)}
                onDragStart={(e) => handleDragStart(e, cart)}
              />
            ))}
          </div>
        ) : (
          /* ---- Empty state ---- */
          <div
            className="flex flex-col items-center justify-center h-full"
            style={{ minHeight: 200 }}
          >
            {/* Simple cartridge outline illustration */}
            <div
              style={{
                width: 64,
                height: 80,
                border: '2px dashed #444',
                borderRadius: '4px 4px 2px 2px',
                marginBottom: 16,
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span
                style={{
                  fontSize: 28,
                  color: '#444',
                  fontFamily: 'Arial, sans-serif',
                  lineHeight: 1,
                }}
              >
                ?
              </span>
              {/* Connector stub */}
              <div
                style={{
                  position: 'absolute',
                  bottom: -10,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: '60%',
                  height: 8,
                  border: '2px dashed #444',
                  borderTop: 'none',
                  borderRadius: '0 0 2px 2px',
                }}
              />
            </div>

            <p
              style={{
                fontFamily: "'Press Start 2P', 'Zpix', monospace",
                fontSize: 12,
                color: '#666',
                textAlign: 'center',
                lineHeight: 2,
                maxWidth: 180,
              }}
            >
              暂无卡带
              <br />
              点击 + 创建或导入
            </p>
          </div>
        )}
      </div>

      {/* ========================================================
          FOOTER
          ======================================================== */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-4 py-3"
        style={{
          borderTop: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(0,0,0,0.2)',
        }}
      >
        {/* Cartridge count */}
        <span
          style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: 11,
            color: '#888',
            letterSpacing: 0.5,
          }}
        >
          {filteredCartridges.length === totalCount
            ? `${totalCount} 盒卡带`
            : `${filteredCartridges.length} / ${totalCount}`}
        </span>

        {/* Import / Export / Create buttons */}
        <div className="flex gap-2">
          <button
            onClick={handleAddCartridge}
            className="shelf-footer-btn"
            title="从 ROM 文件创建新卡带"
            style={{
              fontFamily: "'Press Start 2P', monospace",
              fontSize: 10,
              color: '#FFAA00',
              background: 'rgba(255,170,0,0.08)',
              border: '1px solid rgba(255,170,0,0.25)',
              borderRadius: 3,
              padding: '4px 8px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            创建
          </button>
          <button
            onClick={handleImportAll}
            className="shelf-footer-btn"
            title="导入卡带包 (.fcpack)"
            style={{
              fontFamily: "'Press Start 2P', monospace",
              fontSize: 10,
              color: '#AAA',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 3,
              padding: '4px 8px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            导入
          </button>
          <button
            onClick={handleExportAll}
            className="shelf-footer-btn"
            title="导出选中卡带为 .fcpack"
            style={{
              fontFamily: "'Press Start 2P', monospace",
              fontSize: 10,
              color: '#AAA',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 3,
              padding: '4px 8px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            导出
          </button>
        </div>
      </div>

      {/* ========================================================
          CARTRIDGE EDITOR MODAL
          ======================================================== */}
      <CartridgeEditor
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        editCartridge={editingCartridge}
      />

      {/* ========================================================
          SCOPED STYLES
          ======================================================== */}
      <style>{`
        /* Shelf container background */
        .cartridge-shelf {
          background: linear-gradient(180deg, #12121E 0%, #16162A 40%, #1a1a2e 100%);
          border-left: 2px solid rgba(255, 215, 0, 0.15);
        }

        /* Shelf "cabinet" texture overlay */
        .cartridge-shelf::before {
          content: '';
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            repeating-linear-gradient(
              0deg,
              transparent,
              transparent 60px,
              rgba(255,255,255,0.015) 60px,
              rgba(255,255,255,0.015) 61px
            );
          z-index: 0;
        }

        .cartridge-shelf > * {
          position: relative;
          z-index: 1;
        }

        /* Add button hover */
        .shelf-add-btn:hover {
          transform: scale(1.1);
          box-shadow: 0 4px 12px rgba(255,215,0,0.4), inset 0 1px 0 rgba(255,255,255,0.3) !important;
        }
        .shelf-add-btn:active {
          transform: scale(0.95);
        }

        /* Filter tab hover */
        .shelf-filter-tab:hover {
          background: rgba(255,215,0,0.12) !important;
          color: #FFD700 !important;
        }

        /* Search input focus */
        .shelf-search-input:focus {
          border-color: rgba(255,215,0,0.4) !important;
          background: rgba(255,255,255,0.1) !important;
        }
        .shelf-search-input::placeholder {
          color: #555;
        }

        /* Footer button hover */
        .shelf-footer-btn:hover {
          background: rgba(255,255,255,0.12) !important;
          color: #FFD700 !important;
          border-color: rgba(255,215,0,0.3) !important;
        }
      `}</style>
    </div>
  )
}

export default CartridgeShelf
