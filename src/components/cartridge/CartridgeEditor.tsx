import React, { useState, useCallback, useRef } from 'react'
import type { Cartridge, CartridgeType, GameEntry } from '@shared/types'
import { parseINesHeader, getMapperInfo } from '@/utils/rom-parser'
import { useCartridgeStore } from '@/store/use-cartridge-store'
import { nesSynth } from '@/audio/nes-synth'
import { useSettingsStore } from '@/store/use-settings-store'

// ============================================================
// CartridgeEditor — 从 ROM 文件创建自定义卡带的模态编辑器
// ============================================================

/** 预设卡带外壳颜色 */
const SHELL_COLORS = [
  { name: '经典黄', value: '#C8A020' },
  { name: '深蓝', value: '#2244AA' },
  { name: '红色', value: '#CC3333' },
  { name: '绿色', value: '#228844' },
  { name: '灰色', value: '#888888' },
  { name: '黑色', value: '#333333' },
  { name: '紫色', value: '#664488' },
  { name: '橙色', value: '#DD7722' },
]

/** 预设标签底色 */
const LABEL_COLORS = [
  { name: '米白', value: '#FFFFF0' },
  { name: '白色', value: '#FFFFFF' },
  { name: '浅黄', value: '#FFF8CC' },
  { name: '浅蓝', value: '#E0F0FF' },
  { name: '浅绿', value: '#E0FFE0' },
  { name: '浅粉', value: '#FFE0E8' },
]

/** 解析后的 ROM 条目 */
interface RomEntry {
  filePath: string
  fileName: string
  gameName: string
  gameNameEn: string
  mapper: number
  mapperInfo: string
  prgSize: number
  chrSize: number
  mirroring: string
  valid: boolean
}

interface CartridgeEditorProps {
  open: boolean
  onClose: () => void
  /** 编辑已有卡带时传入 */
  editCartridge?: Cartridge | null
}

const CartridgeEditor: React.FC<CartridgeEditorProps> = ({
  open,
  onClose,
  editCartridge,
}) => {
  const addCartridge = useCartridgeStore((s) => s.addCartridge)
  const updateCartridge = useCartridgeStore((s) => s.updateCartridge)
  const saveCartridges = useCartridgeStore((s) => s.saveCartridges)
  const sfxEnabled = useSettingsStore((s) => s.audio.sfxEnabled)

  // --- 编辑器状态 ---
  const [cartName, setCartName] = useState(editCartridge?.name ?? '')
  const [cartType, setCartType] = useState<CartridgeType>(editCartridge?.type ?? 'custom')
  const [shellColor, setShellColor] = useState(editCartridge?.color ?? SHELL_COLORS[0].value)
  const [labelColor, setLabelColor] = useState(editCartridge?.labelColor ?? LABEL_COLORS[0].value)
  const [romEntries, setRomEntries] = useState<RomEntry[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const overlayRef = useRef<HTMLDivElement>(null)

  const playClick = useCallback(() => {
    if (sfxEnabled) nesSynth.playCursorDown()
  }, [sfxEnabled])

  // --- 选择 ROM 文件 ---
  const handleSelectROMs = useCallback(async () => {
    const api = (window as any).electronAPI
    if (!api?.selectROM) {
      setError('当前环境不支持文件选择（需要 Electron 环境）')
      return
    }

    setIsProcessing(true)
    setError(null)

    try {
      const filePaths: string[] | null = await api.selectROM()
      if (!filePaths || filePaths.length === 0) {
        setIsProcessing(false)
        return
      }

      const newEntries: RomEntry[] = []

      for (const fp of filePaths) {
        const ext = fp.split(/[\\/]/).pop()?.split('.').pop()?.toLowerCase() || ''

        if (ext === 'zip') {
          // --- 处理压缩包：提取其中的 ROM 文件 ---
          const extracted: { name: string; filePath: string }[] | null = await api.extractZip(fp)
          if (extracted === null) {
            setError(`ZIP 解压失败，请检查压缩包是否损坏:\n${fp}`)
            continue
          }
          if (extracted.length === 0) {
            setError(`压缩包中未找到 NES ROM 文件 (支持 .nes .fds .unf .unif .bin):\n${fp}`)
            continue
          }

          for (const rom of extracted) {
            const gameName = rom.name.replace(/\.(nes|fds|unf|unif|bin)$/i, '')

            let entry: RomEntry = {
              filePath: rom.filePath,
              fileName: rom.name,
              gameName,
              gameNameEn: '',
              mapper: -1,
              mapperInfo: '未知',
              prgSize: 0,
              chrSize: 0,
              mirroring: '',
              valid: false,
            }

            try {
              const bytes: Uint8Array | null = await api.readRomBytes(rom.filePath)
              if (bytes) {
                const header = parseINesHeader(bytes)
                if (header) {
                  entry = {
                    ...entry,
                    mapper: header.mapper,
                    mapperInfo: getMapperInfo(header.mapper),
                    prgSize: header.prgRomSize,
                    chrSize: header.chrRomSize,
                    mirroring: header.mirroring,
                    valid: true,
                  }
                }
              }
            } catch (e) {
              console.warn(`[CartridgeEditor] failed to parse ROM from zip: ${rom.name}`, e)
            }

            newEntries.push(entry)
          }
        } else {
          // --- 直接选择 ROM 文件（原有逻辑） ---
          const fileName = fp.split(/[\\/]/).pop() || fp
          const gameName = fileName.replace(/\.(nes|fds|unf|unif|bin)$/i, '')

          let entry: RomEntry = {
            filePath: fp,
            fileName,
            gameName,
            gameNameEn: '',
            mapper: -1,
            mapperInfo: '未知',
            prgSize: 0,
            chrSize: 0,
            mirroring: '',
            valid: false,
          }

          try {
            const bytes: Uint8Array | null = await api.readRomBytes(fp)
            if (bytes) {
              const header = parseINesHeader(bytes)
              if (header) {
                entry = {
                  ...entry,
                  mapper: header.mapper,
                  mapperInfo: getMapperInfo(header.mapper),
                  prgSize: header.prgRomSize,
                  chrSize: header.chrRomSize,
                  mirroring: header.mirroring,
                  valid: true,
                }
              }
            }
          } catch (e) {
            console.warn(`[CartridgeEditor] failed to parse ROM: ${fileName}`, e)
          }

          newEntries.push(entry)
        }
      }

      setRomEntries((prev) => [...prev, ...newEntries])

      // 自动设置卡带名称（如果为空）
      if (!cartName && newEntries.length > 0) {
        if (newEntries.length === 1) {
          setCartName(newEntries[0].gameName)
          setCartType('single')
        } else {
          setCartName(`${newEntries.length}合1`)
          setCartType('multicart')
        }
      }

      if (sfxEnabled) nesSynth.playConfirm()
    } catch (e) {
      setError(`ROM 文件解析失败: ${e}`)
    } finally {
      setIsProcessing(false)
    }
  }, [cartName, sfxEnabled])

  // --- 更新单个游戏条目名称 ---
  const updateEntryName = useCallback((index: number, name: string) => {
    setRomEntries((prev) =>
      prev.map((e, i) => (i === index ? { ...e, gameName: name } : e))
    )
  }, [])

  const updateEntryNameEn = useCallback((index: number, name: string) => {
    setRomEntries((prev) =>
      prev.map((e, i) => (i === index ? { ...e, gameNameEn: name } : e))
    )
  }, [])

  // --- 移除条目 ---
  const removeEntry = useCallback((index: number) => {
    setRomEntries((prev) => prev.filter((_, i) => i !== index))
    playClick()
  }, [playClick])

  // --- 保存卡带 ---
  const handleSave = useCallback(async () => {
    if (!cartName.trim()) {
      setError('请输入卡带名称')
      return
    }
    if (romEntries.length === 0) {
      setError('请至少添加一个 ROM 文件')
      return
    }

    setError(null)

    const games: GameEntry[] = romEntries.map((entry, i) => ({
      id: `game-${Date.now()}-${i}`,
      name: entry.gameName || entry.fileName,
      nameEn: entry.gameNameEn || undefined,
      romPath: entry.filePath,
      romHash: undefined,
      mapper: entry.mapper >= 0 ? entry.mapper : undefined,
    }))

    if (editCartridge) {
      // 编辑模式
      updateCartridge(editCartridge.id, {
        name: cartName.trim(),
        type: cartType,
        color: shellColor,
        labelColor,
        games,
      })
    } else {
      // 新建模式
      const newCart: Cartridge = {
        id: `cart-${Date.now()}`,
        name: cartName.trim(),
        type: cartType,
        color: shellColor,
        labelColor,
        games,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      addCartridge(newCart)
    }

    await saveCartridges()

    if (sfxEnabled) nesSynth.playConfirm()
    onClose()
  }, [
    cartName, cartType, shellColor, labelColor, romEntries,
    editCartridge, addCartridge, updateCartridge, saveCartridges,
    sfxEnabled, onClose,
  ])

  // --- 点击遮罩关闭 ---
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === overlayRef.current) onClose()
    },
    [onClose]
  )

  if (!open) return null

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(4px)',
      }}
    >
      {/* 编辑器面板 */}
      <div
        style={{
          width: 680,
          maxHeight: '85vh',
          background: 'linear-gradient(145deg, #1E1E2E, #16162A)',
          borderRadius: 12,
          border: '1px solid #333',
          boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* ---- 标题栏 ---- */}
        <div
          style={{
            padding: '14px 20px',
            borderBottom: '1px solid #2a2a3e',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 16,
              fontFamily: "'Press Start 2P', monospace",
              color: '#FFAA00',
              letterSpacing: 2,
            }}
          >
            {editCartridge ? 'EDIT CARTRIDGE' : 'NEW CARTRIDGE'}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#666',
              fontSize: 22,
              cursor: 'pointer',
              padding: '0 4px',
              lineHeight: 1,
            }}
          >
            x
          </button>
        </div>

        {/* ---- 内容区域（可滚动） ---- */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px 20px',
          }}
        >
          {/* == 卡带基本信息 == */}
          <SectionTitle text="卡带信息" />

          <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
            <FieldGroup label="卡带名称" flex={1}>
              <input
                type="text"
                value={cartName}
                onChange={(e) => setCartName(e.target.value)}
                placeholder="例：超级马力欧兄弟"
                style={inputStyle}
              />
            </FieldGroup>

            <FieldGroup label="类型" flex={0}>
              <select
                value={cartType}
                onChange={(e) => setCartType(e.target.value as CartridgeType)}
                style={{ ...inputStyle, width: 110 }}
              >
                <option value="single">单卡</option>
                <option value="multicart">合集</option>
                <option value="custom">自定义</option>
              </select>
            </FieldGroup>
          </div>

          {/* 颜色选择 */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
            <FieldGroup label="外壳颜色" flex={1}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {SHELL_COLORS.map((c) => (
                  <ColorSwatch
                    key={c.value}
                    color={c.value}
                    label={c.name}
                    selected={shellColor === c.value}
                    onClick={() => {
                      setShellColor(c.value)
                      playClick()
                    }}
                  />
                ))}
              </div>
            </FieldGroup>

            <FieldGroup label="标签底色" flex={1}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {LABEL_COLORS.map((c) => (
                  <ColorSwatch
                    key={c.value}
                    color={c.value}
                    label={c.name}
                    selected={labelColor === c.value}
                    onClick={() => {
                      setLabelColor(c.value)
                      playClick()
                    }}
                  />
                ))}
              </div>
            </FieldGroup>
          </div>

          {/* 卡带预览 */}
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                display: 'inline-flex',
                flexDirection: 'column',
                alignItems: 'center',
                width: 100,
              }}
            >
              {/* Mini cartridge preview */}
              <div
                style={{
                  width: 80,
                  height: 56,
                  background: shellColor,
                  borderRadius: '4px 4px 0 0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.2)',
                }}
              >
                <div
                  style={{
                    width: 60,
                    height: 34,
                    background: labelColor,
                    borderRadius: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 8,
                    fontFamily: "'Press Start 2P', monospace",
                    color: '#222',
                    textAlign: 'center',
                    lineHeight: 1.3,
                    padding: 2,
                    overflow: 'hidden',
                  }}
                >
                  {cartName || '?'}
                </div>
              </div>
              <div
                style={{
                  width: 62,
                  height: 18,
                  background: 'linear-gradient(180deg, #6B6B6B, #4A4A4A)',
                  borderRadius: '0 0 2px 2px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 2,
                }}
              >
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    style={{
                      width: 3,
                      height: 5,
                      background: 'linear-gradient(180deg, #D4AF37, #B8962E)',
                      borderRadius: 0.5,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* == ROM 文件列表 == */}
          <SectionTitle text="ROM 文件" />

          <div style={{ marginBottom: 12 }}>
            <button
              onClick={handleSelectROMs}
              disabled={isProcessing}
              style={{
                background: 'linear-gradient(180deg, #FFAA00, #DD8800)',
                border: 'none',
                borderRadius: 6,
                padding: '8px 20px',
                color: '#000',
                fontFamily: "'Press Start 2P', monospace",
                fontSize: 12,
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                opacity: isProcessing ? 0.6 : 1,
              }}
            >
              {isProcessing ? '解析中...' : '+ 选择 ROM 文件'}
            </button>
            <span
              style={{
                marginLeft: 12,
                fontSize: 12,
                color: '#666',
              }}
            >
              支持 .nes .fds .unf .unif .bin 及 .zip 压缩包，可多选
            </span>
          </div>

          {/* ROM 列表 */}
          {romEntries.length > 0 && (
            <div
              style={{
                border: '1px solid #2a2a3e',
                borderRadius: 6,
                overflow: 'hidden',
              }}
            >
              {/* 表头 */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '32px 1fr 140px 120px 32px',
                  gap: 0,
                  padding: '6px 10px',
                  background: '#12122a',
                  fontSize: 11,
                  color: '#888',
                  fontFamily: "'Press Start 2P', monospace",
                  letterSpacing: 0.5,
                  borderBottom: '1px solid #2a2a3e',
                }}
              >
                <span>#</span>
                <span>游戏名称</span>
                <span>Mapper</span>
                <span>ROM 大小</span>
                <span />
              </div>

              {/* 条目 */}
              {romEntries.map((entry, i) => (
                <div
                  key={`${entry.filePath}-${i}`}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '32px 1fr 140px 120px 32px',
                    gap: 0,
                    padding: '6px 10px',
                    alignItems: 'center',
                    borderBottom:
                      i < romEntries.length - 1 ? '1px solid #1a1a2e' : 'none',
                    background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
                  }}
                >
                  {/* 编号 */}
                  <span
                    style={{
                      fontSize: 12,
                      color: '#666',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {String(i + 1).padStart(2, '0')}
                  </span>

                  {/* 游戏名称输入 */}
                  <input
                    type="text"
                    value={entry.gameName}
                    onChange={(e) => updateEntryName(i, e.target.value)}
                    style={{
                      ...inputStyle,
                      fontSize: 12,
                      padding: '4px 6px',
                    }}
                  />

                  {/* Mapper 信息 */}
                  <span
                    style={{
                      fontSize: 11,
                      color: entry.valid ? '#88CC88' : '#CC8888',
                      fontFamily: 'monospace',
                    }}
                  >
                    {entry.valid ? entry.mapperInfo : '无效ROM'}
                  </span>

                  {/* ROM 大小 */}
                  <span
                    style={{
                      fontSize: 11,
                      color: '#888',
                      fontFamily: 'monospace',
                    }}
                  >
                    {entry.valid
                      ? `${((entry.prgSize + entry.chrSize) / 1024).toFixed(0)}KB`
                      : '-'}
                  </span>

                  {/* 删除按钮 */}
                  <button
                    onClick={() => removeEntry(i)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#664444',
                      fontSize: 16,
                      cursor: 'pointer',
                      padding: 0,
                      lineHeight: 1,
                    }}
                    title="移除"
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
          )}

          {romEntries.length === 0 && !isProcessing && (
            <div
              style={{
                padding: '20px',
                textAlign: 'center',
                color: '#444',
                fontSize: 12,
                border: '1px dashed #2a2a3e',
                borderRadius: 6,
              }}
            >
              点击上方按钮选择 .nes ROM 文件
            </div>
          )}

          {/* == 错误信息 == */}
          {error && (
            <div
              style={{
                marginTop: 12,
                padding: '8px 12px',
                background: 'rgba(255,80,80,0.15)',
                border: '1px solid rgba(255,80,80,0.3)',
                borderRadius: 4,
                color: '#FF8888',
                fontSize: 12,
              }}
            >
              {error}
            </div>
          )}
        </div>

        {/* ---- 底部操作栏 ---- */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid #2a2a3e',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 12, color: '#555' }}>
            {romEntries.length > 0
              ? `${romEntries.length} 个游戏 | ${romEntries.filter((e) => e.valid).length} 个有效ROM`
              : '未添加 ROM'}
          </span>

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={btnSecondary}>
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={romEntries.length === 0 || !cartName.trim()}
              style={{
                ...btnPrimary,
                opacity:
                  romEntries.length === 0 || !cartName.trim() ? 0.5 : 1,
              }}
            >
              {editCartridge ? '保存修改' : '创建卡带'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// 辅助子组件
// ============================================================

const SectionTitle: React.FC<{ text: string }> = ({ text }) => (
  <div
    style={{
      fontSize: 13,
      fontFamily: "'Press Start 2P', monospace",
      color: '#7575B8',
      letterSpacing: 1.5,
      marginBottom: 10,
      marginTop: 6,
      display: 'flex',
      alignItems: 'center',
      gap: 8,
    }}
  >
    <span>{text}</span>
    <div
      style={{
        flex: 1,
        height: 1,
        background: 'linear-gradient(90deg, #2a2a3e, transparent)',
      }}
    />
  </div>
)

const FieldGroup: React.FC<{
  label: string
  flex?: number
  children: React.ReactNode
}> = ({ label, flex = 1, children }) => (
  <div style={{ flex, minWidth: 0 }}>
    <div
      style={{
        fontSize: 11,
        color: '#666',
        marginBottom: 4,
        letterSpacing: 0.5,
      }}
    >
      {label}
    </div>
    {children}
  </div>
)

const ColorSwatch: React.FC<{
  color: string
  label: string
  selected: boolean
  onClick: () => void
}> = ({ color, label, selected, onClick }) => (
  <div
    onClick={onClick}
    title={label}
    style={{
      width: 28,
      height: 28,
      borderRadius: 4,
      background: color,
      cursor: 'pointer',
      border: selected ? '2px solid #FFAA00' : '2px solid #333',
      boxShadow: selected ? '0 0 6px rgba(255,170,0,0.5)' : 'none',
      transition: 'border 0.15s, box-shadow 0.15s',
    }}
  />
)

// ============================================================
// 内联样式
// ============================================================

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: '#12122a',
  border: '1px solid #2a2a3e',
  borderRadius: 4,
  padding: '6px 10px',
  color: '#E0E0E0',
  fontSize: 13,
  outline: 'none',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
}

const btnPrimary: React.CSSProperties = {
  background: 'linear-gradient(180deg, #FFAA00, #DD8800)',
  border: 'none',
  borderRadius: 6,
  padding: '8px 24px',
  color: '#000',
  fontFamily: "'Press Start 2P', monospace",
  fontSize: 12,
  cursor: 'pointer',
  boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
}

const btnSecondary: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid #444',
  borderRadius: 6,
  padding: '8px 20px',
  color: '#888',
  fontFamily: "'Press Start 2P', monospace",
  fontSize: 12,
  cursor: 'pointer',
}

export default CartridgeEditor
