import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useAppStore } from '@/store/use-app-store'
import { nesSynth } from '@/audio/nes-synth'
import { useSettingsStore } from '@/store/use-settings-store'
import { inputManager } from '@/input/input-manager'

// ============================================================================
// GameListMenu -- Authentic Famicom multi-cart (多合一) game selection screen
//
// Renders INSIDE the TV screen area when a multicart cartridge is inserted and
// the console is powered on.  Recreates the look and feel of a real "64 in 1"
// or "999 in 1" pirate cartridge menu that anyone who played 黄卡 in the 90s
// would instantly recognise.
// ============================================================================

/** Number of game entries visible on one page (one "screen") */
const GAMES_PER_PAGE = 10

/**
 * Map from KeyboardEvent.code -> menu action.
 * Matches the default key-bindings shipped with the input system so that the
 * menu feels consistent with in-game controls.
 */
const MENU_KEY_MAP: Record<string, string> = {
  // Directions -- arrow keys
  ArrowUp:    'up',
  ArrowDown:  'down',
  ArrowLeft:  'left',
  ArrowRight: 'right',
  // Directions -- WASD
  KeyW: 'up',
  KeyS: 'down',
  KeyA: 'left',
  KeyD: 'right',
  // Confirm -- A button / Start / Enter
  KeyJ:   'a',
  KeyZ:   'a',
  Enter:  'start',
  // Cancel -- B button / Select
  KeyK:      'b',
  KeyX:      'b',
  ShiftLeft:  'select',
  ShiftRight: 'select',
}

// ---------------------------------------------------------------------------
// Decorative pixel border -- pure CSS, no images
// ---------------------------------------------------------------------------

const BORDER_OUTER_COLOR = '#FFFFFF'
const BORDER_INNER_COLOR = '#FFAA00'

const borderContainerStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 5,
  pointerEvents: 'none',
  zIndex: 1,
}

/** Top / bottom horizontal bar */
const hBar = (color: string, top: boolean): React.CSSProperties => ({
  position: 'absolute',
  left: 0,
  right: 0,
  height: 2,
  background: color,
  ...(top ? { top: 0 } : { bottom: 0 }),
})

/** Left / right vertical bar */
const vBar = (color: string, left: boolean): React.CSSProperties => ({
  position: 'absolute',
  top: 0,
  bottom: 0,
  width: 2,
  background: color,
  ...(left ? { left: 0 } : { right: 0 }),
})

/** Small accent square at a corner */
const cornerAccent = (top: boolean, left: boolean): React.CSSProperties => ({
  position: 'absolute',
  width: 6,
  height: 6,
  background: BORDER_INNER_COLOR,
  ...(top ? { top: -2 } : { bottom: -2 }),
  ...(left ? { left: -2 } : { right: -2 }),
})

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const GameListMenu: React.FC = () => {
  // ---- Store selectors ----
  const currentCartridge  = useAppStore((s) => s.currentCartridge)
  const selectedGameIndex = useAppStore((s) => s.selectedGameIndex)
  const menuPage          = useAppStore((s) => s.menuPage)
  const selectGame        = useAppStore((s) => s.selectGame)
  const nextPage          = useAppStore((s) => s.nextPage)
  const prevPage          = useAppStore((s) => s.prevPage)
  const startGame         = useAppStore((s) => s.startGame)
  const ejectCartridge    = useAppStore((s) => s.ejectCartridge)

  // ---- Settings (audio gate) ----
  const sfxEnabled = useSettingsStore((s) => s.audio.sfxEnabled)
  const sfxVolume  = useSettingsStore((s) => s.audio.sfxVolume)

  // ---- Local state ----
  const [isFlickering, setIsFlickering] = useState(false)

  // Refs survive across renders without causing stale closures
  const selectedRef  = useRef(selectedGameIndex)
  const pageRef      = useRef(menuPage)
  const flickerRef   = useRef(false)
  const cartRef      = useRef(currentCartridge)

  selectedRef.current = selectedGameIndex
  pageRef.current     = menuPage
  cartRef.current     = currentCartridge

  // ---- Derived values ----
  const games      = currentCartridge?.games ?? []
  const totalGames = games.length
  const totalPages = Math.max(1, Math.ceil(totalGames / GAMES_PER_PAGE))

  const pageStart    = menuPage * GAMES_PER_PAGE
  const pageEnd      = Math.min(pageStart + GAMES_PER_PAGE, totalGames)
  const pageGames    = games.slice(pageStart, pageEnd)
  const localIndex   = selectedGameIndex - pageStart
  const cartridgeName = (currentCartridge?.name ?? '64 IN 1').toUpperCase()

  // ---- Sync SFX volume on the synth whenever settings change ----
  useEffect(() => {
    nesSynth.setSfxVolume(sfxVolume)
  }, [sfxVolume])

  // ---- Helpers: play a sound only when SFX are enabled ----
  const playSound = useCallback(
    (fn: () => void) => {
      if (sfxEnabled) fn()
    },
    [sfxEnabled],
  )

  // ---- Navigation helpers ----

  const moveUp = useCallback(() => {
    const idx = selectedRef.current
    if (idx > 0) {
      const next = idx - 1
      selectGame(next)
      if (next < pageRef.current * GAMES_PER_PAGE) {
        prevPage()
      }
      playSound(() => nesSynth.playCursorUp())
    }
  }, [selectGame, prevPage, playSound])

  const moveDown = useCallback(() => {
    const idx  = selectedRef.current
    const cart = cartRef.current
    if (!cart) return
    const max = cart.games.length - 1
    if (idx < max) {
      const next = idx + 1
      selectGame(next)
      if (next >= (pageRef.current + 1) * GAMES_PER_PAGE) {
        nextPage()
      }
      playSound(() => nesSynth.playCursorDown())
    }
  }, [selectGame, nextPage, playSound])

  const goNextPage = useCallback(() => {
    const cur  = pageRef.current
    const cart = cartRef.current
    if (!cart) return
    const maxPage = Math.ceil(cart.games.length / GAMES_PER_PAGE) - 1
    if (cur < maxPage) {
      nextPage()
      selectGame((cur + 1) * GAMES_PER_PAGE)
      playSound(() => nesSynth.playPageTurn())
    }
  }, [nextPage, selectGame, playSound])

  const goPrevPage = useCallback(() => {
    const cur = pageRef.current
    if (cur > 0) {
      prevPage()
      // Land on the last item of the previous page
      selectGame(cur * GAMES_PER_PAGE - 1)
      playSound(() => nesSynth.playPageTurn())
    }
  }, [prevPage, selectGame, playSound])

  const confirm = useCallback(() => {
    if (flickerRef.current) return
    flickerRef.current = true
    setIsFlickering(true)
    playSound(() => nesSynth.playConfirm())
    // Let the flicker animation play, then actually start the game
    setTimeout(() => {
      startGame()
      flickerRef.current = false
      setIsFlickering(false)
    }, 200)
  }, [startGame, playSound])

  const goBack = useCallback(() => {
    playSound(() => nesSynth.playCancel())
    ejectCartridge()
  }, [ejectCartridge, playSound])

  // ---- Unified input loop (keyboard + gamepad) ----
  useEffect(() => {
    let rafId: number
    let running = true

    const loop = () => {
      if (!running) return

      // inputManager.update() is already called in App.tsx's rAF loop,
      // but we also call it here as a safety net for when the component
      // mounts before App's loop starts.
      // We only need to poll the already-updated state.

      nesSynth.resume()

      // Check each action via inputManager (covers both keyboard & gamepad)
      if (inputManager.isActionJustPressed('up')) {
        moveUp()
      } else if (inputManager.isActionJustPressed('down')) {
        moveDown()
      } else if (inputManager.isActionJustPressed('left')) {
        goPrevPage()
      } else if (inputManager.isActionJustPressed('right')) {
        goNextPage()
      } else if (
        inputManager.isActionJustPressed('a') ||
        inputManager.isActionJustPressed('start')
      ) {
        confirm()
      } else if (
        inputManager.isActionJustPressed('b') ||
        inputManager.isActionJustPressed('select')
      ) {
        goBack()
      }

      rafId = requestAnimationFrame(loop)
    }

    rafId = requestAnimationFrame(loop)

    return () => {
      running = false
      cancelAnimationFrame(rafId)
    }
  }, [moveUp, moveDown, goNextPage, goPrevPage, confirm, goBack])

  // ---- Guard: nothing to render if no cartridge ----
  if (!currentCartridge || totalGames === 0) return null

  // ---- Render ----
  return (
    <div
      className="game-menu-bg"
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* ============================================================
          Pixel-art decorative border (double-line frame)
          ============================================================ */}
      <div style={borderContainerStyle}>
        {/* Outer white frame */}
        <div style={hBar(BORDER_OUTER_COLOR, true)} />
        <div style={hBar(BORDER_OUTER_COLOR, false)} />
        <div style={vBar(BORDER_OUTER_COLOR, true)} />
        <div style={vBar(BORDER_OUTER_COLOR, false)} />
        {/* Inner yellow frame (inset 4px) */}
        <div style={{ ...hBar(BORDER_INNER_COLOR, true),  top: 4,   left: 4, right: 4 }} />
        <div style={{ ...hBar(BORDER_INNER_COLOR, false), bottom: 4, left: 4, right: 4 }} />
        <div style={{ ...vBar(BORDER_INNER_COLOR, true),  left: 4,  top: 4, bottom: 4 }} />
        <div style={{ ...vBar(BORDER_INNER_COLOR, false), right: 4, top: 4, bottom: 4 }} />
        {/* Corner accent squares */}
        <div style={cornerAccent(true,  true)} />
        <div style={cornerAccent(true,  false)} />
        <div style={cornerAccent(false, true)} />
        <div style={cornerAccent(false, false)} />
      </div>

      {/* ============================================================
          Content area (padded inside the border)
          ============================================================ */}
      <div style={{
        position: 'relative',
        zIndex: 2,
        padding: '14px 18px 10px',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}>

        {/* ---- Title banner ---- */}
        <div style={{
          textAlign: 'center',
          marginBottom: 4,
          flexShrink: 0,
        }}>
          <h1
            className="game-menu-title"
            style={{
              fontSize: 20,
              letterSpacing: 3,
              lineHeight: 1.6,
              margin: 0,
            }}
          >
            {cartridgeName}
          </h1>

          {/* Decorative divider: ★═══★ */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            marginTop: 2,
          }}>
            <span style={{ color: '#FFAA00', fontSize: 11 }}>*</span>
            <div style={{
              height: 2,
              width: '55%',
              background: `linear-gradient(90deg,
                transparent, ${BORDER_INNER_COLOR} 15%, #FFF 50%,
                ${BORDER_INNER_COLOR} 85%, transparent)`,
            }} />
            <span style={{ color: '#FFAA00', fontSize: 11 }}>*</span>
          </div>
        </div>

        {/* ---- Game list ---- */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 1,
          minHeight: 0,
          overflow: 'hidden',
        }}>
          {pageGames.map((game, i) => {
            const isSelected = i === localIndex
            const globalIdx = pageStart + i

            return (
              <div
                key={game.id}
                className="game-menu-item"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: 13,
                  letterSpacing: 1,
                  lineHeight: 1.2,
                  padding: '3px 6px',
                  borderRadius: 1,
                  // Selected row: yellow highlight bar
                  background: isSelected ? '#FFAA00' : (
                    // Alternating row tint for readability
                    i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.03)'
                  ),
                  color: isSelected ? '#000000' : '#FCFCFC',
                  // Subtle pulsing glow on the selected row
                  boxShadow: isSelected
                    ? '0 0 8px rgba(255,170,0,0.45), inset 0 0 4px rgba(255,255,255,0.1)'
                    : 'none',
                  transition: 'background 0.05s, box-shadow 0.15s',
                }}
              >
                {/* Blinking cursor arrow */}
                <span
                  className={isSelected ? 'game-menu-cursor' : ''}
                  style={{
                    width: 18,
                    flexShrink: 0,
                    fontSize: 13,
                    textAlign: 'center',
                    // When not selected, render invisible placeholder to keep alignment
                    color: isSelected ? '#000000' : 'transparent',
                    // animation: blink 0.5s step-end infinite (from CSS class)
                  }}
                >
                  {'\u25B6'}
                </span>

                {/* Zero-padded game number */}
                <span style={{
                  width: 40,
                  flexShrink: 0,
                  textAlign: 'right',
                  marginRight: 14,
                  // Slightly dimmer for non-selected rows
                  opacity: isSelected ? 1 : 0.7,
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {String(globalIdx + 1).padStart(3, '0')}
                </span>

                {/* Game name (prefer English display name, fall back to name) */}
                <span style={{
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'clip',
                  whiteSpace: 'nowrap',
                  fontWeight: isSelected ? 700 : 400,
                }}>
                  {(game.nameEn ?? game.name).toUpperCase()}
                </span>
              </div>
            )
          })}
        </div>

        {/* ---- Footer: page indicator + control hints ---- */}
        <div style={{
          flexShrink: 0,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          marginTop: 4,
          paddingTop: 4,
          // Thin separator line
          borderTop: '1px solid rgba(255,255,255,0.1)',
        }}>
          {/* Control hints */}
          <div style={{
            fontSize: 10,
            color: '#7575B8',
            letterSpacing: 0.5,
            lineHeight: 1.6,
            fontFamily: "'Press Start 2P', monospace",
          }}>
            <span style={{ color: '#FFAA00' }}>{'\u2191\u2193'}</span>
            <span style={{ marginLeft: 2 }}>SELECT</span>
            <span style={{ margin: '0 4px', color: '#555' }}>|</span>
            <span style={{ color: '#FFAA00' }}>A</span>
            <span style={{ marginLeft: 2 }}>START</span>
          </div>

          {/* Page indicator */}
          <div className="game-menu-page" style={{
            fontSize: 11,
            letterSpacing: 2,
          }}>
            PAGE {menuPage + 1}/{totalPages}
          </div>
        </div>
      </div>

      {/* ============================================================
          Screen flicker overlay (plays when confirming a game)
          Rapid white flashes simulate the NES PPU resetting.
          ============================================================ */}
      {isFlickering && (
        <div
          className="game-menu-flicker"
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 50,
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  )
}

export default GameListMenu
