import React, { useCallback, useState } from 'react'
import { useAppStore } from '@/store/use-app-store'
import { useSettingsStore } from '@/store/use-settings-store'
import { useCartridgeStore } from '@/store/use-cartridge-store'
import GameListMenu from '../menu/GameListMenu'
import type { Cartridge } from '@shared/types'

// ============================================================
//  FamicomConsole — the visual centrepiece of the app
//  A faithful CSS-art recreation of the Nintendo HVC-001
// ============================================================

const FamicomConsole: React.FC = () => {
  // --- stores ---
  const {
    view,
    powerOn,
    currentCartridge,
    screenEffect,
    ejectCartridge,
    powerToggle,
    resetConsole,
    insertCartridge,
  } = useAppStore()

  const scanlines = useSettingsStore((s) => s.video.scanlines)
  const crtFilter = useSettingsStore((s) => s.video.crtFilter)

  // --- local UI state ---
  const [ejectPressed, setEjectPressed] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  // --- handlers ---

  const handleEject = useCallback(() => {
    if (!currentCartridge) return
    setEjectPressed(true)
    // Let the lever animation play before actually ejecting
    setTimeout(() => {
      ejectCartridge()
      setEjectPressed(false)
    }, 350)
  }, [currentCartridge, ejectCartridge])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => setDragOver(false), [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      try {
        const raw = e.dataTransfer.getData('application/json')
        if (raw) {
          const cart: Cartridge = JSON.parse(raw)
          if (cart?.id) insertCartridge(cart)
          return
        }
      } catch { /* fall through */ }

      // Fallback: look up by ID from cartridge store
      const id = e.dataTransfer.getData('text/plain')
      if (id) {
        const cart = useCartridgeStore.getState().cartridges.find((c) => c.id === id)
        if (cart) insertCartridge(cart)
      }
    },
    [insertCartridge],
  )

  // --- derived flags ---
  const showScreen = powerOn && currentCartridge && (view === 'menu' || view === 'game')
  const isScreenOn = powerOn && currentCartridge
  const screenAnimClass =
    screenEffect === 'on' ? 'animate-screen-on' :
    screenEffect === 'off' ? 'animate-screen-off' : ''

  return (
    <div className="famicom-wrapper flex flex-col items-center justify-end h-full w-full px-4 pb-8 pt-4 relative">

      {/* ========================================================
          TV SCREEN AREA
          ======================================================== */}
      <div className="tv-bezel relative mb-6 flex-shrink-0"
        style={{
          width: '100%',
          maxWidth: 520,
          aspectRatio: '4 / 3',
          background: 'linear-gradient(145deg, #2a2a2a, #1a1a1a)',
          borderRadius: 16,
          padding: 14,
          boxShadow: `
            0 8px 32px rgba(0,0,0,0.6),
            inset 0 2px 0 rgba(255,255,255,0.05),
            inset 0 -2px 0 rgba(0,0,0,0.4)
          `,
        }}
      >
        {/* Inner bezel ring */}
        <div style={{
          position: 'absolute',
          inset: 8,
          borderRadius: 12,
          border: '2px solid #333',
          pointerEvents: 'none',
          zIndex: 2,
        }} />

        {/* Screen glass */}
        <div
          className={`tv-screen relative overflow-hidden ${screenAnimClass}`}
          style={{
            width: '100%',
            height: '100%',
            borderRadius: 10,
            background: isScreenOn ? '#0000AA' : '#0a0a0a',
            boxShadow: isScreenOn
              ? 'inset 0 0 40px rgba(0,0,170,0.4), 0 0 20px rgba(0,0,170,0.15)'
              : 'inset 0 0 30px rgba(0,0,0,0.9)',
            transition: 'background 0.3s, box-shadow 0.3s',
          }}
        >
          {/* CRT curvature overlay */}
          {crtFilter && (
            <div style={{
              position: 'absolute',
              inset: 0,
              borderRadius: 10,
              background: 'radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.35) 100%)',
              pointerEvents: 'none',
              zIndex: 20,
            }} />
          )}

          {/* Scanlines */}
          {scanlines && (
            <div className="crt-overlay" style={{
              position: 'absolute',
              inset: 0,
              zIndex: 15,
              borderRadius: 10,
            }} />
          )}

          {/* Screen content */}
          {showScreen ? (
            <div style={{ position: 'relative', zIndex: 10, width: '100%', height: '100%' }}>
              <GameListMenu />
            </div>
          ) : (
            <div className="flex items-center justify-center w-full h-full">
              {/* Static noise when powering on with no cart */}
              {powerOn && !currentCartridge && (
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  opacity: 0.15,
                  background: `repeating-conic-gradient(#fff 0% 25%, transparent 0% 50%) 0 0 / 4px 4px`,
                  animation: 'none',
                }} />
              )}
              <span style={{
                color: '#333',
                fontSize: 14,
                fontFamily: "'Press Start 2P', monospace",
                letterSpacing: 2,
                textAlign: 'center',
                lineHeight: 1.8,
              }}>
                {powerOn && !currentCartridge ? 'NO CARTRIDGE' : ''}
              </span>
            </div>
          )}

          {/* Screen reflection glare */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '40%',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, transparent 100%)',
            borderRadius: '10px 10px 0 0',
            pointerEvents: 'none',
            zIndex: 25,
          }} />
        </div>

        {/* TV brand label */}
        <div style={{
          position: 'absolute',
          bottom: 2,
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: 11,
          color: '#444',
          fontFamily: 'Arial, sans-serif',
          letterSpacing: 3,
          textTransform: 'uppercase',
        }}>
          FAMILY COMPUTER
        </div>
      </div>

      {/* ========================================================
          FAMICOM CONSOLE BODY
          ======================================================== */}
      <div
        className="famicom-console relative flex-shrink-0"
        style={{ width: '100%', maxWidth: 520 }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* ---- RED TOP COVER ---- */}
        <div className="famicom-top-cover relative" style={{ padding: '0 0 0 0' }}>

          {/* Top surface */}
          <div style={{
            position: 'relative',
            height: 68,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            padding: '0 24px 6px',
          }}>
            {/* Cartridge slot (recessed) */}
            <div
              className="famicom-cartridge-slot relative"
              style={{
                width: '58%',
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 2,
              }}
            >
              {/* Slot inner shadow / connector pins */}
              <div style={{
                width: '85%',
                height: 6,
                background: 'linear-gradient(180deg, #1a1a1a, #333 40%, #444 60%, #333)',
                borderRadius: 2,
                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.6)',
              }} />

              {/* Cartridge sticking out */}
              {currentCartridge && (
                <div
                  className={ejectPressed ? '' : 'animate-cartridge-insert'}
                  style={{
                    position: 'absolute',
                    bottom: '55%',
                    left: '50%',
                    transform: `translateX(-50%) ${ejectPressed ? 'translateY(-100%)' : ''}`,
                    width: '75%',
                    height: 56,
                    background: `linear-gradient(180deg, ${currentCartridge.color || '#C8A020'} 0%, ${currentCartridge.color || '#C8A020'} 90%, rgba(0,0,0,0.15) 100%)`,
                    borderRadius: '5px 5px 0 0',
                    boxShadow: `
                      inset 0 2px 0 rgba(255,255,255,0.25),
                      inset 0 -2px 4px rgba(0,0,0,0.1),
                      0 -3px 8px rgba(0,0,0,0.35)
                    `,
                    transition: ejectPressed ? 'transform 0.35s ease-in' : 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 3,
                    padding: '4px 6px',
                  }}
                >
                  {/* Top grip notch */}
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 30,
                    height: 4,
                    background: 'rgba(0,0,0,0.12)',
                    borderRadius: '0 0 3px 3px',
                  }} />

                  {/* Cartridge label sticker */}
                  <div style={{
                    width: '82%',
                    height: '72%',
                    background: currentCartridge.labelColor || '#FFFFF0',
                    borderRadius: 2,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
                    padding: '2px 4px',
                    overflow: 'hidden',
                  }}>
                    {/* Multicart badge */}
                    {currentCartridge.type === 'multicart' && (
                      <div style={{
                        fontFamily: "'Press Start 2P', monospace",
                        fontSize: 12,
                        fontWeight: 700,
                        color: '#CC2200',
                        lineHeight: 1,
                        marginBottom: 2,
                      }}>
                        {currentCartridge.games.length} IN 1
                      </div>
                    )}
                    {/* Cartridge name */}
                    <div style={{
                      fontFamily: "'Press Start 2P', 'Zpix', monospace",
                      fontSize: currentCartridge.type === 'multicart' ? 10 : 12,
                      color: '#222',
                      textAlign: 'center',
                      lineHeight: 1.4,
                      letterSpacing: 0.5,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: '100%',
                    }}>
                      {currentCartridge.name}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Drag-over highlight */}
            {dragOver && !currentCartridge && (
              <div style={{
                position: 'absolute',
                bottom: 10,
                left: '50%',
                transform: 'translateX(-50%)',
                width: '59%',
                height: 56,
                border: '2px dashed #FFD700',
                borderRadius: 6,
                background: 'rgba(255,215,0,0.1)',
                zIndex: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <span style={{
                  fontSize: 12,
                  color: '#FFD700',
                  fontFamily: "'Press Start 2P', monospace",
                }}>DROP HERE</span>
              </div>
            )}

            {/* Ventilation lines on each side of slot */}
            {[...Array(5)].map((_, i) => (
              <div key={`vent-l-${i}`} style={{
                position: 'absolute',
                left: 20 + i * 8,
                top: 10,
                width: 4,
                height: 28,
                background: 'rgba(0,0,0,0.15)',
                borderRadius: 1,
              }} />
            ))}
            {[...Array(5)].map((_, i) => (
              <div key={`vent-r-${i}`} style={{
                position: 'absolute',
                right: 20 + i * 8,
                top: 10,
                width: 4,
                height: 28,
                borderRadius: 1,
                background: 'rgba(0,0,0,0.15)',
              }} />
            ))}
          </div>

          {/* Eject lever track */}
          <div style={{
            position: 'relative',
            height: 16,
            display: 'flex',
            alignItems: 'center',
            padding: '0 24px',
          }}>
            {/* Track groove */}
            <div style={{
              width: 100,
              height: 6,
              background: 'linear-gradient(180deg, #6B1010, #5A0E0E)',
              borderRadius: 3,
              boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.5)',
              position: 'relative',
              marginLeft: '20%',
            }}>
              {/* Lever knob */}
              <div
                className="famicom-eject-lever"
                onClick={handleEject}
                style={{
                  position: 'absolute',
                  top: -4,
                  left: 0,
                  width: 28,
                  height: 14,
                  transform: ejectPressed ? 'translateX(60px)' : 'translateX(0)',
                  zIndex: 4,
                }}
              >
                {/* Grip lines */}
                <div style={{
                  position: 'absolute',
                  top: 3,
                  left: 5,
                  width: 18,
                  height: 1.5,
                  background: 'rgba(255,255,255,0.15)',
                  borderRadius: 1,
                }} />
                <div style={{
                  position: 'absolute',
                  top: 6,
                  left: 5,
                  width: 18,
                  height: 1.5,
                  background: 'rgba(255,255,255,0.15)',
                  borderRadius: 1,
                }} />
                <div style={{
                  position: 'absolute',
                  top: 9,
                  left: 5,
                  width: 18,
                  height: 1.5,
                  background: 'rgba(255,255,255,0.15)',
                  borderRadius: 1,
                }} />
              </div>

              {/* EJECT label */}
              <span style={{
                position: 'absolute',
                left: 110,
                top: -4,
                fontSize: 10,
                color: 'rgba(255,255,255,0.4)',
                fontFamily: 'Arial, sans-serif',
                fontWeight: 700,
                letterSpacing: 2,
              }}>EJECT</span>
            </div>
          </div>
        </div>

        {/* ---- CREAM MAIN BODY ---- */}
        <div className="famicom-body" style={{ position: 'relative' }}>

          {/* Gold stripe divider between red top and cream body */}
          <div style={{
            height: 3,
            background: 'linear-gradient(90deg, #B8962E, #D4AF37, #B8962E)',
            boxShadow: '0 1px 0 rgba(0,0,0,0.2)',
          }} />

          {/* Upper body section with front panel controls */}
          <div style={{
            padding: '12px 24px 8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            {/* Left: Controller cradle 1 */}
            <ControllerCradle label="1P" />

            {/* Center: FAMILY COMPUTER embossed text */}
            <div style={{
              flex: 1,
              textAlign: 'center',
              padding: '0 8px',
            }}>
              <div style={{
                fontSize: 11,
                letterSpacing: 4,
                fontFamily: 'Arial, sans-serif',
                fontWeight: 700,
                color: 'rgba(0,0,0,0.18)',
                textShadow: '0 1px 0 rgba(255,255,255,0.4)',
                textTransform: 'uppercase',
              }}>
                FAMILY COMPUTER
              </div>
            </div>

            {/* Right: Controller cradle 2 */}
            <ControllerCradle label="2P" />
          </div>

          {/* Front panel strip with controls */}
          <div style={{
            padding: '4px 24px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
          }}>
            {/* Power switch */}
            <div className="flex flex-col items-center gap-1">
              <span style={{
                fontSize: 9,
                letterSpacing: 1.5,
                color: 'rgba(0,0,0,0.35)',
                fontFamily: 'Arial, sans-serif',
                fontWeight: 700,
              }}>POWER</span>

              <div
                className={`famicom-power-switch ${powerOn ? 'on' : ''}`}
                onClick={powerToggle}
                style={{
                  width: 40,
                  height: 14,
                  display: 'flex',
                  alignItems: 'center',
                  padding: 2,
                }}
              >
                {/* Knob */}
                <div className="knob" style={{
                  width: 18,
                  height: 10,
                  boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
                }} />
              </div>

              {/* Power labels */}
              <div className="flex justify-between w-full" style={{
                fontSize: 8,
                color: 'rgba(0,0,0,0.25)',
                fontFamily: 'Arial, sans-serif',
              }}>
                <span>OFF</span>
                <span>ON</span>
              </div>
            </div>

            {/* LED indicator */}
            <div className="flex flex-col items-center gap-1">
              <div className={`led-indicator ${powerOn ? 'on' : ''}`} />
              <span style={{
                fontSize: 8,
                color: 'rgba(0,0,0,0.25)',
                fontFamily: 'Arial, sans-serif',
              }}>
                {powerOn ? 'ON' : 'OFF'}
              </span>
            </div>

            {/* Spacer */}
            <div style={{ flex: 1 }} />

            {/* Reset button */}
            <div className="flex flex-col items-center gap-1">
              <div
                className="famicom-reset-btn"
                onClick={resetConsole}
                style={{ width: 22, height: 22 }}
              />
              <span style={{
                fontSize: 9,
                letterSpacing: 1,
                color: 'rgba(0,0,0,0.35)',
                fontFamily: 'Arial, sans-serif',
                fontWeight: 700,
              }}>RESET</span>
            </div>
          </div>

          {/* Bottom ventilation / expansion port area */}
          <div style={{
            height: 10,
            background: 'linear-gradient(180deg, transparent, rgba(0,0,0,0.05))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 3,
            paddingBottom: 2,
          }}>
            {[...Array(20)].map((_, i) => (
              <div key={`bvent-${i}`} style={{
                width: 12,
                height: 2,
                background: 'rgba(0,0,0,0.06)',
                borderRadius: 1,
              }} />
            ))}
          </div>
        </div>

        {/* ---- BOTTOM SHADOW / BASE ---- */}
        <div style={{
          height: 6,
          background: 'linear-gradient(180deg, #D4C4AD, #BFB09A)',
          borderRadius: '0 0 4px 4px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
        }}>
          {/* Rubber feet (visual) */}
          <div className="flex justify-between px-6" style={{ paddingTop: 2 }}>
            <div style={{
              width: 18,
              height: 3,
              background: '#2a2a2a',
              borderRadius: 2,
            }} />
            <div style={{
              width: 18,
              height: 3,
              background: '#2a2a2a',
              borderRadius: 2,
            }} />
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================
//  Controller Cradle sub-component
// ============================================================
interface ControllerCradleProps {
  label: string
}

const ControllerCradle: React.FC<ControllerCradleProps> = ({ label }) => (
  <div style={{
    width: 64,
    height: 26,
    background: 'linear-gradient(180deg, #C8B89E, #BEB09A)',
    borderRadius: 3,
    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2), inset 0 -1px 0 rgba(255,255,255,0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  }}>
    {/* Connector pin holes */}
    <div className="flex gap-1 items-center">
      {[...Array(5)].map((_, i) => (
        <div key={i} style={{
          width: 2,
          height: 2,
          borderRadius: '50%',
          background: 'rgba(0,0,0,0.25)',
        }} />
      ))}
    </div>
    {/* Label */}
    <span style={{
      position: 'absolute',
      bottom: -8,
      fontSize: 9,
      color: 'rgba(0,0,0,0.25)',
      fontFamily: 'Arial, sans-serif',
      fontWeight: 700,
      letterSpacing: 1,
    }}>
      {label}
    </span>
  </div>
)

export default FamicomConsole
