import React, { useCallback, useState, useRef, useEffect } from 'react'
import type { Cartridge } from '@shared/types'
import { useCartridgeStore } from '@/store/use-cartridge-store'

// ============================================================
//  CartridgeCard -- a miniature Famicom cartridge (黄卡 style)
//  ~120px wide x 160px tall, draggable, selectable, insertable
// ============================================================

interface CartridgeCardProps {
  cartridge: Cartridge
  isSelected: boolean
  onSelect: () => void
  onInsert: () => void
  onEdit: () => void
  onDragStart: (e: React.DragEvent) => void
}

const CartridgeCard: React.FC<CartridgeCardProps> = ({
  cartridge,
  isSelected,
  onSelect,
  onInsert,
  onEdit,
  onDragStart,
}) => {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return
    const handleClick = () => setContextMenu(null)
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [contextMenu])

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }, [])

  const handleDoubleClick = useCallback(() => {
    onInsert()
  }, [onInsert])

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      // Pack the full cartridge JSON so the console drop-zone can parse it
      e.dataTransfer.setData('application/json', JSON.stringify(cartridge))
      e.dataTransfer.setData('text/plain', cartridge.id)
      e.dataTransfer.effectAllowed = 'copy'
      onDragStart(e)
    },
    [cartridge, onDragStart],
  )

  const isMulticart = cartridge.type === 'multicart'
  const gameCount = cartridge.games.length

  // Darken the shell colour slightly for the bottom edge gradient
  const shellColor = cartridge.color || '#C8A020'
  const labelBg = cartridge.labelColor || '#FFFFF0'

  return (
    <>
      <div
        className="cartridge-card relative flex flex-col items-center select-none"
        draggable
        onClick={onSelect}
        onDoubleClick={handleDoubleClick}
        onDragStart={handleDragStart}
        onContextMenu={handleContextMenu}
        style={{
          width: 120,
          height: 160,
          outline: isSelected ? '2px solid #FFD700' : '2px solid transparent',
          boxShadow: isSelected
            ? '0 0 12px rgba(255,215,0,0.5), 0 3px 8px rgba(0,0,0,0.3)'
            : undefined,
        }}
        title={`${cartridge.name}${isMulticart ? ` (${gameCount} games)` : ''}`}
      >
        {/* ---- SHELL TOP (colored) ---- */}
        <div
          className="relative w-full flex-shrink-0"
          style={{
            height: 100,
            background: `linear-gradient(180deg, ${shellColor} 0%, ${shellColor} 85%, ${adjustBrightness(shellColor, -20)} 100%)`,
            borderRadius: '4px 4px 0 0',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25)',
          }}
        >
          {/* Shell notch / grip indent at very top */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 40,
              height: 6,
              background: adjustBrightness(shellColor, -15),
              borderRadius: '0 0 3px 3px',
              boxShadow: 'inset 0 -1px 2px rgba(0,0,0,0.2)',
            }}
          />

          {/* Side grooves (left) */}
          {[0, 1, 2].map((i) => (
            <div
              key={`gl-${i}`}
              style={{
                position: 'absolute',
                left: 4,
                top: 14 + i * 5,
                width: 2,
                height: 3,
                background: adjustBrightness(shellColor, -25),
                borderRadius: 1,
              }}
            />
          ))}
          {/* Side grooves (right) */}
          {[0, 1, 2].map((i) => (
            <div
              key={`gr-${i}`}
              style={{
                position: 'absolute',
                right: 4,
                top: 14 + i * 5,
                width: 2,
                height: 3,
                background: adjustBrightness(shellColor, -25),
                borderRadius: 1,
              }}
            />
          ))}

          {/* ---- LABEL AREA (cream/white sticker) ---- */}
          <div
            className="label absolute flex flex-col items-center justify-center overflow-hidden"
            style={{
              top: 12,
              left: 8,
              right: 8,
              bottom: 8,
              background: labelBg,
              borderRadius: 2,
              boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
              padding: '4px 4px',
            }}
          >
            {/* Multicart badge */}
            {isMulticart && (
              <div
                style={{
                  fontFamily: "'Press Start 2P', monospace",
                  fontSize: 18,
                  fontWeight: 700,
                  color: '#CC2200',
                  lineHeight: 1,
                  marginBottom: 4,
                  textShadow: '1px 1px 0 rgba(0,0,0,0.08)',
                  letterSpacing: -0.5,
                }}
              >
                {gameCount}
              </div>
            )}
            {isMulticart && (
              <div
                style={{
                  fontFamily: "'Press Start 2P', monospace",
                  fontSize: 11,
                  color: '#CC2200',
                  lineHeight: 1,
                  marginBottom: 6,
                  letterSpacing: 0.5,
                }}
              >
                IN 1
              </div>
            )}

            {/* Game title */}
            <div
              style={{
                fontFamily: "'Press Start 2P', 'Zpix', monospace",
                fontSize: isMulticart ? 10 : 12,
                color: '#222',
                textAlign: 'center',
                lineHeight: 1.5,
                wordBreak: 'break-all',
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: isMulticart ? 2 : 3,
                WebkitBoxOrient: 'vertical',
                maxWidth: '100%',
                padding: '0 2px',
              }}
            >
              {cartridge.name}
            </div>

            {/* Type badge for custom carts */}
            {cartridge.type === 'custom' && (
              <div
                style={{
                  marginTop: 4,
                  fontSize: 9,
                  fontFamily: "'Press Start 2P', monospace",
                  color: '#888',
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                }}
              >
                CUSTOM
              </div>
            )}
          </div>
        </div>

        {/* ---- CONNECTOR PINS (narrower bottom) ---- */}
        <div
          className="flex-shrink-0 flex flex-col items-center"
          style={{
            width: '78%',
            height: 32,
          }}
        >
          {/* Transition bevel from shell to connector */}
          <div
            style={{
              width: '100%',
              height: 4,
              background: `linear-gradient(180deg, ${adjustBrightness(shellColor, -20)}, #555)`,
              borderRadius: '0 0 1px 1px',
            }}
          />

          {/* PCB / connector body */}
          <div
            className="flex-1 w-full flex flex-col items-center justify-center gap-[2px]"
            style={{
              background: 'linear-gradient(180deg, #6B6B6B 0%, #555 50%, #4A4A4A 100%)',
              borderRadius: '0 0 2px 2px',
              boxShadow: 'inset 0 -1px 2px rgba(0,0,0,0.3)',
              padding: '3px 6px',
            }}
          >
            {/* Gold pin rows */}
            {[0, 1].map((row) => (
              <div key={`pinrow-${row}`} className="flex w-full justify-between">
                {[...Array(8)].map((_, i) => (
                  <div
                    key={`pin-${row}-${i}`}
                    style={{
                      width: 3,
                      height: 6,
                      background: 'linear-gradient(180deg, #D4AF37, #B8962E)',
                      borderRadius: 0.5,
                      boxShadow: '0 0.5px 0 rgba(0,0,0,0.3)',
                    }}
                  />
                ))}
              </div>
            ))}
          </div>

          {/* Bottom edge of connector */}
          <div
            style={{
              width: '100%',
              height: 2,
              background: '#3A3A3A',
              borderRadius: '0 0 2px 2px',
            }}
          />
        </div>

        {/* ---- INSERT HINT (visible on hover via CSS) ---- */}
        <div
          className="insert-hint absolute inset-0 flex items-center justify-center opacity-0 pointer-events-none"
          style={{
            background: 'rgba(0,0,0,0.55)',
            borderRadius: 4,
            transition: 'opacity 0.15s ease',
          }}
        >
          <div
            style={{
              fontFamily: "'Press Start 2P', monospace",
              fontSize: 11,
              color: '#FFD700',
              textAlign: 'center',
              lineHeight: 1.8,
              textShadow: '0 1px 3px rgba(0,0,0,0.8)',
            }}
          >
            INSERT
            <br />
            <span style={{ fontSize: 9, color: '#ccc' }}>double-click</span>
          </div>
        </div>
      </div>

      {/* ---- CONTEXT MENU ---- */}
      {contextMenu && (
        <div
          ref={menuRef}
          className="fixed z-50"
          style={{
            top: contextMenu.y,
            left: contextMenu.x,
            minWidth: 130,
            background: '#1E1E2E',
            border: '1px solid #444',
            borderRadius: 4,
            boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
            padding: '4px 0',
            fontFamily: "'Press Start 2P', monospace",
            fontSize: 11,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <ContextMenuItem
            label="插入卡带"
            onClick={() => {
              setContextMenu(null)
              onInsert()
            }}
          />
          <ContextMenuItem
            label="编辑卡带"
            onClick={() => {
              setContextMenu(null)
              onEdit()
            }}
          />
          <div style={{ height: 1, background: '#333', margin: '4px 8px' }} />
          <ContextMenuItem
            label="导出 .fcpack"
            onClick={() => {
              setContextMenu(null)
              // 通过 store 方法导出（store 内部调用正确的 preload API）
              useCartridgeStore.getState().exportCartridgePack(cartridge.id)
              console.log('[CartridgeCard] export', cartridge.id)
            }}
          />
          <ContextMenuItem
            label="删除卡带"
            danger
            onClick={() => {
              setContextMenu(null)
              setConfirmDelete(true)
            }}
          />
        </div>
      )}

      {/* Scoped hover style for the insert overlay */}
      <style>{`
        .cartridge-card:hover .insert-hint {
          opacity: 1 !important;
        }
      `}</style>

      {/* ---- 确认删除对话框 ---- */}
      {confirmDelete && (
        <div
          className="fixed z-50 flex items-center justify-center"
          style={{
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(2px)',
          }}
          onClick={() => setConfirmDelete(false)}
        >
          <div
            style={{
              background: '#1E1E2E',
              border: '1px solid rgba(255,80,80,0.3)',
              borderRadius: 8,
              padding: '20px 24px',
              maxWidth: 320,
              fontFamily: "'Press Start 2P', monospace",
              textAlign: 'center',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 13, color: '#FF5555', marginBottom: 12 }}>
              确认删除
            </div>
            <div style={{ fontSize: 11, color: '#AAA', lineHeight: 1.8, marginBottom: 16 }}>
              确定要删除「{cartridge.name}」吗？
              <br />
              此操作不可恢复。
            </div>
            <div className="flex justify-center gap-3">
              <button
                style={{
                  padding: '6px 14px',
                  fontSize: 10,
                  fontFamily: "'Press Start 2P', monospace",
                  color: '#888',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid #444',
                  borderRadius: 4,
                  cursor: 'pointer',
                }}
                onClick={() => setConfirmDelete(false)}
              >
                取消
              </button>
              <button
                style={{
                  padding: '6px 14px',
                  fontSize: 10,
                  fontFamily: "'Press Start 2P', monospace",
                  color: '#FFF',
                  background: 'rgba(255,80,80,0.25)',
                  border: '1px solid rgba(255,80,80,0.5)',
                  borderRadius: 4,
                  cursor: 'pointer',
                }}
                onClick={() => {
                  useCartridgeStore.getState().removeCartridge(cartridge.id)
                  useCartridgeStore.getState().saveCartridges()
                  setConfirmDelete(false)
                }}
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ============================================================
//  Context menu item sub-component
// ============================================================

interface ContextMenuItemProps {
  label: string
  danger?: boolean
  onClick: () => void
}

const ContextMenuItem: React.FC<ContextMenuItemProps> = ({ label, danger, onClick }) => {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      style={{
        padding: '6px 12px',
        color: danger ? '#FF5555' : '#E0E0E0',
        background: hovered ? (danger ? 'rgba(255,85,85,0.15)' : 'rgba(255,255,255,0.08)') : 'transparent',
        cursor: 'pointer',
        transition: 'background 0.1s',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
    >
      {label}
    </div>
  )
}

// ============================================================
//  Colour utility -- darken / lighten a hex colour
// ============================================================

function adjustBrightness(hex: string, amount: number): string {
  let color = hex.replace('#', '')
  if (color.length === 3) {
    color = color[0] + color[0] + color[1] + color[1] + color[2] + color[2]
  }
  const num = parseInt(color, 16)
  const r = Math.max(0, Math.min(255, ((num >> 16) & 0xff) + amount))
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + amount))
  const b = Math.max(0, Math.min(255, (num & 0xff) + amount))
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

export default CartridgeCard
