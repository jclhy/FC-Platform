import React, { useEffect, useRef, useState } from 'react'
import { NES, Controller } from 'jsnes'
import { useAppStore } from '@/store/use-app-store'
import { inputManager } from '@/input/input-manager'
import { nesSynth } from '@/audio/nes-synth'
import { useSettingsStore } from '@/store/use-settings-store'

// ============================================================
// GameScreen — NES 模拟器游戏运行组件
//
// 在 TV 屏幕区域内渲染 JSNES 的画面输出。
// 使用 Canvas 2D + ImageData 进行像素级渲染，
// AudioWorklet 处理音频采样，
// inputManager 轮询手柄/键盘输入。
// ============================================================

const SCREEN_WIDTH = 256
const SCREEN_HEIGHT = 240

/**
 * AudioWorklet 处理器代码（内联字符串，通过 Blob URL 加载）
 * 在工作线程中接收立体声采样并通过环形缓冲区播放
 */
const AUDIO_WORKLET_CODE = `
class NESGameAudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.capacity = 8192
    this.bufferL = new Float32Array(this.capacity)
    this.bufferR = new Float32Array(this.capacity)
    this.readPos = 0
    this.writePos = 0
    this.count = 0
    this.port.onmessage = (e) => {
      if (e.data.type === 'samples') {
        const left = e.data.left
        const right = e.data.right
        const len = left.length
        if (this.count + len > this.capacity) {
          const drop = this.count + len - this.capacity
          this.readPos = (this.readPos + drop) % this.capacity
          this.count -= drop
        }
        for (let i = 0; i < len; i++) {
          this.bufferL[this.writePos] = left[i]
          this.bufferR[this.writePos] = right[i]
          this.writePos = (this.writePos + 1) % this.capacity
        }
        this.count += len
      }
    }
  }
  process(inputs, outputs) {
    const output = outputs[0]
    if (!output || output.length < 2) return true
    const outL = output[0]
    const outR = output[1]
    const size = outL.length
    if (this.count < size) {
      for (let i = 0; i < this.count; i++) {
        outL[i] = this.bufferL[this.readPos]
        outR[i] = this.bufferR[this.readPos]
        this.readPos = (this.readPos + 1) % this.capacity
      }
      for (let i = this.count; i < size; i++) {
        outL[i] = 0
        outR[i] = 0
      }
      this.count = 0
    } else {
      for (let i = 0; i < size; i++) {
        outL[i] = this.bufferL[this.readPos]
        outR[i] = this.bufferR[this.readPos]
        this.readPos = (this.readPos + 1) % this.capacity
      }
      this.count -= size
    }
    return true
  }
}
registerProcessor('nes-game-audio-processor', NESGameAudioProcessor)
`

/** 音频采样批大小（匹配 AudioWorklet 渲染量子） */
const AUDIO_BATCH_SIZE = 128

/**
 * InputAction → JSNES Controller 按钮映射
 * JSNES Controller 常量: A=0, B=1, SELECT=2, START=3, UP=4, DOWN=5, LEFT=6, RIGHT=7
 */
const ACTION_TO_BUTTON: Record<string, number> = {
  a: Controller.BUTTON_A,
  b: Controller.BUTTON_B,
  start: Controller.BUTTON_START,
  select: Controller.BUTTON_SELECT,
  up: Controller.BUTTON_UP,
  down: Controller.BUTTON_DOWN,
  left: Controller.BUTTON_LEFT,
  right: Controller.BUTTON_RIGHT,
}

const GameScreen: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const nesRef = useRef<NES | null>(null)
  const rafRef = useRef<number>(0)
  const workletNodeRef = useRef<AudioWorkletNode | null>(null)

  // 音频采样批缓冲区
  const batchLRef = useRef(new Float32Array(AUDIO_BATCH_SIZE))
  const batchRRef = useRef(new Float32Array(AUDIO_BATCH_SIZE))
  const batchPosRef = useRef(0)

  // 上帧按键状态（用于边沿检测）
  const prevButtonsRef = useRef<Record<string, boolean>>({})

  // 连发状态跟踪
  interface TurboState {
    active: boolean    // 当前 NES 按钮状态（down/up）
    frameCount: number // 帧计数器
    wasHeld: boolean   // 上一帧是否按住
  }
  const turboStatesRef = useRef<Record<string, TurboState>>({})
  const turboRef = useRef<Record<string, boolean>>({})
  const turboRateRef = useRef(3)

  // 同步连发配置到 ref（使游戏循环可读取最新值）
  turboRef.current = turbo
  turboRateRef.current = turboRate

  // Canvas 像素缓冲区
  const bufRef = useRef<ArrayBuffer | null>(null)
  const buf8Ref = useRef<Uint8ClampedArray | null>(null)
  const buf32Ref = useRef<Uint32Array | null>(null)

  const [error, setError] = useState<string | null>(null)
  const [isPaused, setIsPaused] = useState(false)
  const pausedRef = useRef(false)

  const currentCartridge = useAppStore((s) => s.currentCartridge)
  const selectedGameIndex = useAppStore((s) => s.selectedGameIndex)
  const resetConsole = useAppStore((s) => s.resetConsole)
  const masterVolume = useSettingsStore((s) => s.audio.masterVolume)
  const turbo = useSettingsStore((s) => s.input.turbo)
  const turboRate = useSettingsStore((s) => s.input.turboRate)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let destroyed = false

    // 获取当前游戏条目
    const game = currentCartridge?.games[selectedGameIndex]
    if (!game?.romPath) {
      setError('此游戏未关联 ROM 文件\n请先通过「卡带编辑器」添加 ROM')
      return
    }

    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) return

    // --- 初始化像素缓冲区 ---
    const imageData = ctx.getImageData(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT)
    const buf = new ArrayBuffer(imageData.data.length)
    const buf8 = new Uint8ClampedArray(buf)
    const buf32 = new Uint32Array(buf)
    // 预设 Alpha 通道为不透明
    for (let i = 0; i < buf32.length; i++) {
      buf32[i] = 0xff000000
    }
    bufRef.current = buf
    buf8Ref.current = buf8
    buf32Ref.current = buf32

    // 先画一帧黑色，避免白闪
    imageData.data.set(buf8)
    ctx.putImageData(imageData, 0, 0)

    // --- 音频初始化（异步，不阻塞 ROM 加载） ---
    let gainNode: GainNode | null = null

    const initAudio = async () => {
      try {
        const audioCtx = nesSynth.getAudioContext()
        if (audioCtx.state === 'suspended') {
          await audioCtx.resume()
        }

        const blob = new Blob([AUDIO_WORKLET_CODE], { type: 'application/javascript' })
        const url = URL.createObjectURL(blob)
        await audioCtx.audioWorklet.addModule(url)
        URL.revokeObjectURL(url)

        if (destroyed) return

        const node = new AudioWorkletNode(audioCtx, 'nes-game-audio-processor', {
          outputChannelCount: [2],
        })

        gainNode = audioCtx.createGain()
        gainNode.gain.value = masterVolume * 0.8

        node.connect(gainNode)
        gainNode.connect(audioCtx.destination)

        workletNodeRef.current = node
      } catch (e) {
        console.warn('[GameScreen] AudioWorklet init failed, audio disabled:', e)
      }
    }

    // 音频在后台初始化，不阻塞画面
    initAudio()

    // --- JSNES 实例 ---
    const nes = new NES({
      onFrame: (buffer: Uint32Array) => {
        if (destroyed) return
        // 将 JSNES BGR 格式像素转换为 Canvas ABGR 格式
        const b32 = buf32Ref.current
        if (!b32) return
        for (let i = 0; i < SCREEN_WIDTH * SCREEN_HEIGHT; i++) {
          b32[i] = 0xff000000 | buffer[i]
        }
        imageData.data.set(buf8Ref.current!)
        ctx.putImageData(imageData, 0, 0)
      },
      onAudioSample: (left: number, right: number) => {
        const node = workletNodeRef.current
        if (!node) return

        const bL = batchLRef.current
        const bR = batchRRef.current
        const pos = batchPosRef.current

        bL[pos] = left
        bR[pos] = right
        batchPosRef.current = pos + 1

        if (batchPosRef.current >= AUDIO_BATCH_SIZE) {
          node.port.postMessage({
            type: 'samples',
            left: bL.slice(),
            right: bR.slice(),
          })
          batchPosRef.current = 0
        }
      },
      emulateSound: true,
      sampleRate: 44100,
    })

    nesRef.current = nes

    // --- 加载 ROM，成功后才启动游戏循环 ---
    const startEmulator = async () => {
      const api = (window as any).electronAPI
      if (!api?.loadRomData) {
        if (!destroyed) setError('需要 Electron 环境才能加载 ROM')
        return
      }

      try {
        const romData: Uint8Array | null = await api.loadRomData(game.romPath!)
        if (destroyed) return

        if (!romData) {
          setError(`无法读取 ROM 文件:\n${game.romPath}`)
          return
        }

        nes.loadROM(romData)
        if (destroyed) return
      } catch (e) {
        if (!destroyed) {
          setError(`ROM 加载失败:\n${e instanceof Error ? e.message : String(e)}`)
        }
        return
      }

      // ROM 加载成功，启动游戏主循环
      // 限频 60fps 以保证音频采样率正确，不受显示器刷新率影响
      const FRAME_INTERVAL = 1000 / 60
      const lastFrameTimeRef = { current: 0 }
      const accumulatorRef = { current: 0 }

      const gameLoop = (timestamp: number) => {
        if (destroyed) return

        if (!pausedRef.current) {
          // 用 delta time 累积器将 rAF 节流到 60fps
          // 注意：accumulator 必须跨帧持久累积，否则高刷新率 (120Hz+) 下
          // delta < FRAME_INTERVAL 会导致 while 循环永不执行，nes.frame() 不会被调用
          if (lastFrameTimeRef.current === 0) {
            lastFrameTimeRef.current = timestamp
            accumulatorRef.current = 0
          }
          const delta = timestamp - lastFrameTimeRef.current
          lastFrameTimeRef.current = timestamp

          // 累积时间，按固定间隔执行帧
          accumulatorRef.current += delta
          while (accumulatorRef.current >= FRAME_INTERVAL) {
            accumulatorRef.current -= FRAME_INTERVAL

            // 轮询输入（支持连发模式）
            const actions = Object.keys(ACTION_TO_BUTTON)
            for (const action of actions) {
              const btn = ACTION_TO_BUTTON[action]
              const pressed = inputManager.isAction(action as any, 1)

              if (turboRef.current[action]) {
                // --- 连发模式：按住时快速 toggle ---
                if (!turboStatesRef.current[action]) {
                  turboStatesRef.current[action] = { active: false, frameCount: 0, wasHeld: false }
                }
                const ts = turboStatesRef.current[action]

                if (pressed) {
                  ts.frameCount++
                  if (ts.frameCount >= turboRateRef.current) {
                    ts.frameCount = 0
                    ts.active = !ts.active
                    if (ts.active) {
                      nes.buttonDown(1, btn as any)
                    } else {
                      nes.buttonUp(1, btn as any)
                    }
                  }
                  ts.wasHeld = true
                } else {
                  // 松开连发键：释放 NES 按钮，重置状态
                  if (ts.wasHeld) {
                    nes.buttonUp(1, btn as any)
                    ts.active = false
                    ts.frameCount = 0
                    ts.wasHeld = false
                  }
                }
              } else {
                // --- 普通模式：原有边沿检测逻辑 ---
                const wasPressed = prevButtonsRef.current[action] || false
                if (pressed && !wasPressed) {
                  nes.buttonDown(1, btn as any)
                } else if (!pressed && wasPressed) {
                  nes.buttonUp(1, btn as any)
                }
                prevButtonsRef.current[action] = pressed
              }
            }

            // 运行一帧
            try {
              nes.frame()
            } catch (e) {
              console.error('[GameScreen] NES frame error:', e)
            }
          }
        }

        rafRef.current = requestAnimationFrame(gameLoop)
      }

      rafRef.current = requestAnimationFrame(gameLoop)
    }

    startEmulator()

    // --- Escape 键返回菜单 ---
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        e.preventDefault()
        for (const action of Object.keys(ACTION_TO_BUTTON)) {
          nes.buttonUp(1, ACTION_TO_BUTTON[action] as any)
        }
        resetConsole()
      }
      if (e.code === 'KeyP' && !e.repeat) {
        pausedRef.current = !pausedRef.current
        setIsPaused(pausedRef.current)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    // --- 清理 ---
    return () => {
      destroyed = true
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('keydown', handleKeyDown)

      if (nesRef.current) {
        for (const action of Object.keys(ACTION_TO_BUTTON)) {
          nesRef.current.buttonUp(1, ACTION_TO_BUTTON[action] as any)
        }
      }

      if (workletNodeRef.current) {
        workletNodeRef.current.disconnect()
        workletNodeRef.current = null
      }
      if (gainNode) {
        gainNode.disconnect()
      }

      nesRef.current = null
    }
  }, [currentCartridge, selectedGameIndex, resetConsole, masterVolume])

  // --- 渲染 ---
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        background: '#000',
      }}
    >
      {/* NES 画面 Canvas */}
      <canvas
        ref={canvasRef}
        width={SCREEN_WIDTH}
        height={SCREEN_HEIGHT}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          imageRendering: 'pixelated',
          display: error ? 'none' : 'block',
        }}
      />

      {/* 错误提示 */}
      {error && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            style={{
              fontFamily: "'Press Start 2P', monospace",
              fontSize: 14,
              color: '#FF6666',
              textAlign: 'center',
              lineHeight: 2.2,
              whiteSpace: 'pre-line',
            }}
          >
            {error}
          </div>
          <div
            style={{
              marginTop: 20,
              fontFamily: "'Press Start 2P', monospace",
              fontSize: 11,
              color: '#555',
            }}
          >
            ESC 返回菜单
          </div>
        </div>
      )}

      {/* 暂停遮罩 */}
      {isPaused && !error && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
          }}
        >
          <div
            style={{
              fontFamily: "'Press Start 2P', monospace",
              fontSize: 24,
              color: '#FFAA00',
              letterSpacing: 6,
              textShadow: '0 0 12px rgba(255,170,0,0.5)',
              animation: 'blink 1s step-end infinite',
            }}
          >
            PAUSE
          </div>
        </div>
      )}
    </div>
  )
}

export default GameScreen
