import { useEffect } from 'react'
import FamicomConsole from './components/console/FamicomConsole'
import CartridgeShelf from './components/cartridge/CartridgeShelf'
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

    // 恢复 AudioContext（需要用户交互后才能播放）
    const resumeAudio = () => {
      nesSynth.resume()
      document.removeEventListener('click', resumeAudio)
      document.removeEventListener('keydown', resumeAudio)
    }
    document.addEventListener('click', resumeAudio)
    document.addEventListener('keydown', resumeAudio)

    return () => {
      inputManager.detach()
      cancelAnimationFrame(rafId)
      document.removeEventListener('click', resumeAudio)
      document.removeEventListener('keydown', resumeAudio)
    }
  }, [])

  // 当设置加载后同步音量
  const masterVolume = useSettingsStore((s) => s.audio.masterVolume)
  const sfxVolume = useSettingsStore((s) => s.audio.sfxVolume)

  useEffect(() => {
    nesSynth.setMasterVolume(masterVolume)
    nesSynth.setSfxVolume(sfxVolume)
  }, [masterVolume, sfxVolume])

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#1a1a2e]">
      {/* 左侧：红白机主机 + 电视屏幕 */}
      <div
        className="flex flex-col items-center justify-center p-6 transition-all duration-500"
        style={{ width: view === 'game' ? '100%' : '60%' }}
      >
        <FamicomConsole />
      </div>

      {/* 右侧：卡带架（游戏运行时隐藏） */}
      {view !== 'game' && (
        <div
          className={`h-full transition-all duration-500 ${
            isTransitioning ? 'opacity-0 translate-x-8' : 'opacity-100 translate-x-0'
          }`}
          style={{ width: '40%' }}
        >
          <CartridgeShelf />
        </div>
      )}
    </div>
  )
}
