import { useEffect, useState, useCallback } from 'react'
import FamicomConsole from './components/console/FamicomConsole'
import CartridgeShelf from './components/cartridge/CartridgeShelf'
import KeyBindingsSettings from './components/settings/KeyBindingsSettings'
import GameScreen from './components/game/GameScreen'
import { useAppStore } from './store/use-app-store'
import { useCartridgeStore } from './store/use-cartridge-store'
import { useSettingsStore } from './store/use-settings-store'
import { inputManager } from './input/input-manager'
import { nesSynth } from './audio/nes-synth'

/**
 * FC Platform 主应用组件
 * 布局：左侧红白机主机 (60%) + 右侧卡带架 (40%)
 */
export default function App() {
  const view = useAppStore((s) => s.view)
  const isTransitioning = useAppStore((s) => s.isTransitioning)

  // 手柄连接状态提示
  const [gamepadToast, setGamepadToast] = useState<{
    message: string
    visible: boolean
  }>({ message: '', visible: false })

  const showToast = useCallback((message: string) => {
    setGamepadToast({ message, visible: true })
    setTimeout(() => setGamepadToast((prev) => ({ ...prev, visible: false })), 3000)
  }, [])

  // 初始化：加载数据、启动输入管理器
  useEffect(() => {
    // 加载卡带和设置
    useCartridgeStore.getState().loadCartridges()
    useSettingsStore.getState().loadSettings()

    // 启动输入管理器
    inputManager.attach()

    // 每帧更新输入状态
    let rafId: number
    const loop = (timestamp: number) => {
      inputManager.update(timestamp)
      rafId = requestAnimationFrame(loop)
    }
    rafId = requestAnimationFrame(loop)

    // 手柄连接/断开提示
    inputManager.onGamepadConnect((info) => {
      console.log('[Gamepad] Connected:', info.id)
      showToast(`手柄已连接: ${info.id.slice(0, 25)}`)
    })
    inputManager.onGamepadDisconnect((info) => {
      console.log('[Gamepad] Disconnected:', info.id)
      showToast(`手柄已断开: ${info.id.slice(0, 25)}`)
    })

    // 恢复 AudioContext（需要用户交互后才能播放）
    const resumeAudio = () => {
      nesSynth.resume()
      document.removeEventListener('click', resumeAudio)
      document.removeEventListener('keydown', resumeAudio)
      // 也尝试通过手柄按钮恢复
      document.removeEventListener('mousedown', resumeAudio)
    }
    document.addEventListener('click', resumeAudio)
    document.addEventListener('keydown', resumeAudio)
    document.addEventListener('mousedown', resumeAudio)

    return () => {
      inputManager.detach()
      cancelAnimationFrame(rafId)
      document.removeEventListener('click', resumeAudio)
      document.removeEventListener('keydown', resumeAudio)
      document.removeEventListener('mousedown', resumeAudio)
    }
  }, [showToast])

  // 当设置加载后同步音量
  const masterVolume = useSettingsStore((s) => s.audio.masterVolume)
  const sfxVolume = useSettingsStore((s) => s.audio.sfxVolume)

  useEffect(() => {
    nesSynth.setMasterVolume(masterVolume)
    nesSynth.setSfxVolume(sfxVolume)
  }, [masterVolume, sfxVolume])

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#1a1a2e]">
      {/* 游戏模式：GameScreen 直接全屏覆盖，绕过 FamicomConsole 布局链 */}
      {view === 'game' && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            zIndex: 50,
            background: '#000',
          }}
        >
          <GameScreen />
        </div>
      )}

      {/* 左侧：红白机主机 + 电视屏幕 */}
      <div
        className={`flex flex-col transition-all duration-500 ${
          view === 'game' ? 'opacity-0 pointer-events-none' : 'items-center justify-center p-6'
        }`}
        style={{ width: '60%', height: '100%' }}
      >
        <FamicomConsole />
      </div>

      {/* 右侧：卡带架 / 设置面板（游戏运行时隐藏） */}
      {view !== 'game' && (
        <div
          className={`h-full transition-all duration-500 ${
            isTransitioning ? 'opacity-0 translate-x-8' : 'opacity-100 translate-x-0'
          }`}
          style={{ width: '40%' }}
        >
          {view === 'settings' ? <KeyBindingsSettings /> : <CartridgeShelf />}
        </div>
      )}

      {/* 手柄连接/断开提示 */}
      <div
        className="fixed top-4 left-1/2 -translate-x-1/2 z-50 transition-all duration-300"
        style={{
          opacity: gamepadToast.visible ? 1 : 0,
          transform: `translateX(-50%) translateY(${gamepadToast.visible ? 0 : -20}px)`,
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            background: 'rgba(0, 0, 0, 0.85)',
            border: '2px solid #FFAA00',
            borderRadius: 4,
            padding: '10px 20px',
            fontFamily: "'Press Start 2P', monospace",
            fontSize: 11,
            color: '#FFAA00',
            whiteSpace: 'nowrap',
            boxShadow: '0 0 12px rgba(255, 170, 0, 0.3)',
          }}
        >
          🎮 {gamepadToast.message}
        </div>
      </div>
    </div>
  )
}
