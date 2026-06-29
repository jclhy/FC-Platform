import React from 'react'
import { useAppStore } from '@/store/use-app-store'
import { useSettingsStore } from '@/store/use-settings-store'
import type { InputAction } from '@shared/types'

// ============================================================
//  KeyBindingsSettings — 键位设置 + 连发配置面板
//  显示所有 8 个 NES 动作的绑定按键和连发开关
// ============================================================

/** 动作中文名映射 */
const ACTION_LABELS: Record<InputAction, string> = {
  up: '上',
  down: '下',
  left: '左',
  right: '右',
  a: 'A',
  b: 'B',
  start: '开始',
  select: '选择',
}

/** 按键代码 → 显示名 */
function keyDisplayName(code: string): string {
  const map: Record<string, string> = {
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→',
    Enter: 'Enter',
    ShiftLeft: '左Shift',
    ShiftRight: '右Shift',
    ControlLeft: '左Ctrl',
    ControlRight: '右Ctrl',
    Space: 'Space',
    Escape: 'Esc',
    KeyA: 'A', KeyB: 'B', KeyC: 'C', KeyD: 'D', KeyE: 'E',
    KeyF: 'F', KeyG: 'G', KeyH: 'H', KeyI: 'I', KeyJ: 'J',
    KeyK: 'K', KeyL: 'L', KeyM: 'M', KeyN: 'N', KeyO: 'O',
    KeyP: 'P', KeyQ: 'Q', KeyR: 'R', KeyS: 'S', KeyT: 'T',
    KeyU: 'U', KeyV: 'V', KeyW: 'W', KeyX: 'X', KeyY: 'Y',
    KeyZ: 'Z',
    Digit1: '1', Digit2: '2', Digit3: '3', Digit4: '4',
    Digit5: '5', Digit6: '6', Digit7: '7', Digit8: '8',
    Digit9: '9', Digit0: '0',
  }
  return map[code] || code
}

const ALL_ACTIONS: InputAction[] = ['up', 'down', 'left', 'right', 'a', 'b', 'start', 'select']

const KeyBindingsSettings: React.FC = () => {
  const setView = useAppStore((s) => s.setView)
  const p1Keys = useSettingsStore((s) => s.input.player1Keys)
  const turbo = useSettingsStore((s) => s.input.turbo)
  const turboRate = useSettingsStore((s) => s.input.turboRate)
  const toggleTurbo = useSettingsStore((s) => s.toggleTurbo)
  const setTurboRate = useSettingsStore((s) => s.setTurboRate)

  const handleBack = () => {
    setView('console')
  }

  return (
    <div className="flex flex-col h-full w-full overflow-hidden" style={{ background: '#1a1a2e' }}>
      {/* 标题栏 */}
      <div className="flex-shrink-0 px-4 pt-4 pb-2">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={handleBack}
            style={{
              background: 'none',
              border: '2px solid #FFD700',
              borderRadius: 4,
              color: '#FFD700',
              fontFamily: "'Press Start 2P', 'Zpix', monospace",
              fontSize: 11,
              padding: '6px 12px',
              cursor: 'pointer',
            }}
          >
            ← 返回
          </button>
          <h2
            style={{
              fontFamily: "'Press Start 2P', 'Zpix', monospace",
              fontSize: 14,
              color: '#FFD700',
              textShadow: '0 2px 4px rgba(0,0,0,0.5)',
              margin: 0,
            }}
          >
            键位设置
          </h2>
          <div style={{ width: 80 }} />
        </div>
      </div>

      {/* 按键列表 */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div
          style={{
            background: 'rgba(255,255,255,0.04)',
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.08)',
            overflow: 'hidden',
          }}
        >
          {/* 表头 */}
          <div
            style={{
              display: 'flex',
              padding: '8px 12px',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              fontFamily: "'Press Start 2P', 'Zpix', monospace",
              fontSize: 10,
              color: '#888',
            }}
          >
            <div style={{ width: 60 }}>动作</div>
            <div style={{ flex: 1 }}>绑定按键</div>
            <div style={{ width: 70, textAlign: 'center' }}>连发</div>
          </div>

          {/* 动作行 */}
          {ALL_ACTIONS.map((action, index) => (
            <div
              key={action}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '10px 12px',
                borderBottom: index < ALL_ACTIONS.length - 1
                  ? '1px solid rgba(255,255,255,0.06)'
                  : 'none',
                fontFamily: "'Press Start 2P', 'Zpix', monospace",
                fontSize: 11,
                color: '#FCFCFC',
              }}
            >
              {/* 动作名 */}
              <div style={{ width: 60, color: '#FFD700' }}>
                {ACTION_LABELS[action]}
              </div>

              {/* 绑定按键 */}
              <div style={{ flex: 1, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {(p1Keys[action] as string[] | undefined)?.map((key) => (
                  <span
                    key={key}
                    style={{
                      background: 'rgba(255,255,255,0.1)',
                      borderRadius: 3,
                      padding: '2px 6px',
                      fontSize: 10,
                      color: '#AAA',
                      border: '1px solid rgba(255,255,255,0.12)',
                    }}
                  >
                    {keyDisplayName(key)}
                  </span>
                ))}
              </div>

              {/* 连发开关 */}
              <div style={{ width: 70, textAlign: 'center' }}>
                <div
                  onClick={() => toggleTurbo(action)}
                  style={{
                    display: 'inline-flex',
                    width: 36,
                    height: 18,
                    borderRadius: 10,
                    background: turbo[action] ? '#FFAA00' : 'rgba(255,255,255,0.15)',
                    cursor: 'pointer',
                    transition: 'background 0.2s',
                    position: 'relative',
                    boxShadow: turbo[action]
                      ? '0 0 6px rgba(255,170,0,0.4)'
                      : 'none',
                  }}
                >
                  <div
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      background: '#FFF',
                      position: 'absolute',
                      top: 2,
                      left: turbo[action] ? 20 : 2,
                      transition: 'left 0.2s',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 连发频率设置 */}
        <div
          style={{
            marginTop: 16,
            background: 'rgba(255,255,255,0.04)',
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.08)',
            padding: '12px 16px',
          }}
        >
          <div
            style={{
              fontFamily: "'Press Start 2P', 'Zpix', monospace",
              fontSize: 11,
              color: '#FFD700',
              marginBottom: 10,
            }}
          >
            连发频率
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            {/* 频率滑条 */}
            <input
              type="range"
              min={1}
              max={8}
              value={turboRate}
              onChange={(e) => setTurboRate(Number(e.target.value))}
              style={{
                flex: 1,
                accentColor: '#FFAA00',
                height: 4,
              }}
            />
            <span
              style={{
                fontFamily: "'Press Start 2P', 'Zpix', monospace",
                fontSize: 11,
                color: '#FCFCFC',
                minWidth: 60,
              }}
            >
              {turboRate}帧
              <span style={{ color: '#888', fontSize: 9, marginLeft: 4 }}>
                (≈{Math.round(60 / turboRate)}Hz)
              </span>
            </span>
          </div>
          <div
            style={{
              fontFamily: "'Press Start 2P', 'Zpix', monospace",
              fontSize: 9,
              color: '#666',
              marginTop: 8,
              lineHeight: 1.6,
            }}
          >
            数值越小连发越快 ({turboRate}帧 = 每{turboRate}帧toggle一次)
          </div>
        </div>

        {/* 使用说明 */}
        <div
          style={{
            marginTop: 16,
            padding: '12px 16px',
            fontFamily: "'Press Start 2P', 'Zpix', monospace",
            fontSize: 9,
            color: '#666',
            lineHeight: 2,
            background: 'rgba(255,255,255,0.02)',
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          连发开启后，按住对应按钮会以设定频率快速自动连按。
          适合用于射击游戏（连发）和平台跳跃游戏（连跳）。
        </div>
      </div>
    </div>
  )
}

export default KeyBindingsSettings
