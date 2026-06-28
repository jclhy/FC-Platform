// ============================================================================
// gamepad-handler.ts
// Gamepad input handler with analog stick support and auto-repeat.
// ============================================================================

import {
  InputAction,
  GamepadBindings,
  DEFAULT_GAMEPAD_BINDINGS,
  GAMEPAD_AXIS,
  buttonToAction,
} from './key-bindings';

/** Timing constants — identical to keyboard for a consistent feel. */
const REPEAT_INITIAL_DELAY_MS = 300;
const REPEAT_INTERVAL_MS = 80;

/** Metadata stored about a connected gamepad. */
export interface GamepadInfo {
  id: string;
  index: number;
}

/** Configuration options for the GamepadHandler. */
export interface GamepadHandlerConfig {
  /** Button mapping.  Defaults to standard gamepad layout. */
  bindings?: GamepadBindings;
  /** Analog stick dead zone in the range [0, 1].  Default 0.3. */
  deadZone?: number;
}

/** Per-action hold timing for auto-repeat. */
interface HoldState {
  pressedAt: number;
  lastRepeatAt: number;
  initialFired: boolean;
}

/** Callback signatures for connection events. */
export type GamepadConnectCallback = (info: GamepadInfo) => void;
export type GamepadDisconnectCallback = (info: GamepadInfo) => void;

/**
 * GamepadHandler
 *
 * Detects gamepad connection, polls button/axis state each frame, and
 * exposes the same isPressed / isJustPressed API as KeyboardHandler.
 *
 * Lifecycle:
 *   1. Construct (optionally with custom config).
 *   2. Call `attach()` to start listening for gamepad events.
 *   3. Call `update(timestamp)` once per frame.
 *   4. Call `detach()` when done.
 */
export class GamepadHandler {
  // -- Configuration --------------------------------------------------------
  private bindings: GamepadBindings;
  private deadZone: number;

  // -- Connection state -----------------------------------------------------
  private connectedGamepads: Map<number, GamepadInfo> = new Map();

  // -- Action state (rebuilt every frame) -----------------------------------
  /** Actions that are considered "held" this frame. */
  private heldActions: Set<InputAction> = new Set();
  /** Actions that just activated this frame (initial press or repeat pulse). */
  private justPressedActions: Set<InputAction> = new Set();

  /** Per-action hold timing for auto-repeat. */
  private holdStates: Map<InputAction, HoldState> = new Map();

  /** Whether event listeners are currently attached. */
  private attached = false;

  // -- Bound listener references --------------------------------------------
  private readonly onGamepadConnected: (e: GamepadEvent) => void;
  private readonly onGamepadDisconnected: (e: GamepadEvent) => void;

  // -- User callbacks -------------------------------------------------------
  private connectCallbacks: GamepadConnectCallback[] = [];
  private disconnectCallbacks: GamepadDisconnectCallback[] = [];

  // =========================================================================
  constructor(config: GamepadHandlerConfig = {}) {
    this.bindings = config.bindings
      ? { ...config.bindings }
      : { ...DEFAULT_GAMEPAD_BINDINGS };
    this.deadZone = config.deadZone ?? 0.3;

    this.onGamepadConnected = this.handleConnect.bind(this);
    this.onGamepadDisconnected = this.handleDisconnect.bind(this);
  }

  // -- Lifecycle ------------------------------------------------------------

  attach(): void {
    if (this.attached) return;
    window.addEventListener('gamepadconnected', this.onGamepadConnected);
    window.addEventListener('gamepaddisconnected', this.onGamepadDisconnected);
    this.attached = true;
  }

  detach(): void {
    if (!this.attached) return;
    window.removeEventListener('gamepadconnected', this.onGamepadConnected);
    window.removeEventListener('gamepaddisconnected', this.onGamepadDisconnected);
    this.attached = false;
    this.reset();
  }

  reset(): void {
    this.heldActions.clear();
    this.justPressedActions.clear();
    this.holdStates.clear();
    this.connectedGamepads.clear();
  }

  // -- Connection event callbacks -------------------------------------------

  onConnect(cb: GamepadConnectCallback): void {
    this.connectCallbacks.push(cb);
  }

  onDisconnect(cb: GamepadDisconnectCallback): void {
    this.disconnectCallbacks.push(cb);
  }

  // -- Per-frame update -----------------------------------------------------

  /**
   * Must be called once per frame.
   *
   * 1. Clears just-pressed state from the previous frame.
   * 2. Polls `navigator.getGamepads()` and evaluates all connected pads.
   * 3. Merges button presses and analog stick deflections into a single set
   *    of "raw" active actions.
   * 4. Runs auto-repeat logic identical to KeyboardHandler.
   */
  update(timestamp: number = performance.now()): void {
    this.justPressedActions.clear();
    this.heldActions.clear();

    // Collect raw active actions from all connected gamepads.
    const rawActions = new Set<InputAction>();
    const gamepads = navigator.getGamepads();

    for (const pad of gamepads) {
      if (!pad) continue;

      // -- Buttons ----------------------------------------------------------
      for (let i = 0; i < pad.buttons.length; i++) {
        if (pad.buttons[i].pressed) {
          const action = buttonToAction(i, this.bindings);
          if (action) rawActions.add(action);
        }
      }

      // -- Analog stick (left stick by default) -----------------------------
      const axisX = pad.axes[GAMEPAD_AXIS.LEFT_X] ?? 0;
      const axisY = pad.axes[GAMEPAD_AXIS.LEFT_Y] ?? 0;

      if (axisX < -this.deadZone) rawActions.add('left');
      if (axisX > this.deadZone) rawActions.add('right');
      if (axisY < -this.deadZone) rawActions.add('up');
      if (axisY > this.deadZone) rawActions.add('down');
    }

    // -- Auto-repeat logic --------------------------------------------------
    const allActions: InputAction[] = [
      'up', 'down', 'left', 'right', 'a', 'b', 'start', 'select',
    ];

    for (const action of allActions) {
      const isRawActive = rawActions.has(action);
      let hold = this.holdStates.get(action);

      if (isRawActive) {
        // Action is physically held — always mark as held.
        this.heldActions.add(action);

        if (!hold) {
          // Fresh press this frame.
          hold = {
            pressedAt: timestamp,
            lastRepeatAt: timestamp,
            initialFired: false,
          };
          this.holdStates.set(action, hold);
        }

        const elapsed = timestamp - hold.pressedAt;
        const sinceRepeat = timestamp - hold.lastRepeatAt;

        // justPressedActions: only on the initial press frame or repeat pulses.
        if (!hold.initialFired) {
          if (elapsed < REPEAT_INITIAL_DELAY_MS) {
            if (elapsed < 16) {
              this.justPressedActions.add(action);
            }
          } else {
            hold.initialFired = true;
            hold.lastRepeatAt = timestamp;
            this.justPressedActions.add(action);
          }
        } else {
          if (sinceRepeat >= REPEAT_INTERVAL_MS) {
            hold.lastRepeatAt = timestamp;
            this.justPressedActions.add(action);
          }
        }
      } else {
        // Action is not active — clean up its hold state.
        if (hold) {
          this.holdStates.delete(action);
        }
      }
    }
  }

  // -- Query API ------------------------------------------------------------

  isPressed(action: InputAction): boolean {
    return this.heldActions.has(action);
  }

  isJustPressed(action: InputAction): boolean {
    return this.justPressedActions.has(action);
  }

  // -- Connection info ------------------------------------------------------

  /** Return info about all currently connected gamepads. */
  getConnectedGamepads(): GamepadInfo[] {
    return Array.from(this.connectedGamepads.values());
  }

  /** Whether at least one gamepad is connected. */
  isConnected(): boolean {
    return this.connectedGamepads.size > 0;
  }

  // -- Configuration --------------------------------------------------------

  setBindings(bindings: GamepadBindings): void {
    this.bindings = { ...bindings };
    this.holdStates.clear();
  }

  getBindings(): GamepadBindings {
    return { ...this.bindings };
  }

  setDeadZone(deadZone: number): void {
    this.deadZone = Math.max(0, Math.min(1, deadZone));
  }

  getDeadZone(): number {
    return this.deadZone;
  }

  // -- Internal event handlers ----------------------------------------------

  private handleConnect(e: GamepadEvent): void {
    const info: GamepadInfo = { id: e.gamepad.id, index: e.gamepad.index };
    this.connectedGamepads.set(e.gamepad.index, info);
    for (const cb of this.connectCallbacks) cb(info);
  }

  private handleDisconnect(e: GamepadEvent): void {
    const info: GamepadInfo = this.connectedGamepads.get(e.gamepad.index) ?? {
      id: e.gamepad.id,
      index: e.gamepad.index,
    };
    this.connectedGamepads.delete(e.gamepad.index);
    for (const cb of this.disconnectCallbacks) cb(info);
  }
}
