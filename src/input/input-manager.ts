// ============================================================================
// input-manager.ts
// Unified input manager that combines keyboard and gamepad sources.
// ============================================================================

import {
  InputAction,
  KeyBindings,
  GamepadBindings,
  DEFAULT_PLAYER1_KEYS,
  DEFAULT_PLAYER2_KEYS,
} from './key-bindings';
import { KeyboardHandler } from './keyboard-handler';
import {
  GamepadHandler,
  GamepadHandlerConfig,
  GamepadConnectCallback,
  GamepadDisconnectCallback,
} from './gamepad-handler';

/** The type of input device that last provided input. */
export type InputType = 'keyboard' | 'gamepad' | 'none';

/** Payload delivered to action listeners. */
export interface InputActionEvent {
  action: InputAction;
  type: 'press' | 'repeat';
  source: InputType;
  timestamp: number;
}

/** Callback signature for action listeners. */
export type InputActionCallback = (event: InputActionEvent) => void;

/**
 * InputManager
 *
 * Singleton facade that owns one KeyboardHandler (Player 1 by default) and
 * one GamepadHandler, merging their state each frame so consumers never need
 * to care which device the player is using.
 *
 * Usage:
 *   import { inputManager } from './input-manager';
 *   inputManager.attach();
 *   // In your game loop:
 *   inputManager.update();
 *   if (inputManager.isActionJustPressed('start')) { ... }
 */
export class InputManager {
  // -- Sub-handlers ---------------------------------------------------------
  private keyboardP1: KeyboardHandler;
  private keyboardP2: KeyboardHandler;
  private gamepad: GamepadHandler;

  // -- Active input tracking ------------------------------------------------
  private lastInputType: InputType = 'none';

  // -- Event emitter --------------------------------------------------------
  private actionCallbacks: InputActionCallback[] = [];

  // =========================================================================
  constructor() {
    this.keyboardP1 = new KeyboardHandler({ ...DEFAULT_PLAYER1_KEYS });
    this.keyboardP2 = new KeyboardHandler({ ...DEFAULT_PLAYER2_KEYS });
    this.gamepad = new GamepadHandler();
  }

  // -- Lifecycle ------------------------------------------------------------

  /** Start listening for keyboard and gamepad events. */
  attach(): void {
    this.keyboardP1.attach();
    this.keyboardP2.attach();
    this.gamepad.attach();
  }

  /** Stop listening and reset all internal state. */
  detach(): void {
    this.keyboardP1.detach();
    this.keyboardP2.detach();
    this.gamepad.detach();
    this.actionCallbacks = [];
    this.lastInputType = 'none';
  }

  // -- Per-frame update -----------------------------------------------------

  /**
   * Must be called once per animation frame.  Updates both handlers and then
   * fires action events for any newly-activated actions.
   */
  update(timestamp: number = performance.now()): void {
    this.keyboardP1.update(timestamp);
    this.keyboardP2.update(timestamp);
    this.gamepad.update(timestamp);

    // Detect active input type based on which source fired this frame.
    const allActions: InputAction[] = [
      'up', 'down', 'left', 'right', 'a', 'b', 'start', 'select',
    ];

    for (const action of allActions) {
      if (this.keyboardP1.isJustPressed(action) || this.keyboardP2.isJustPressed(action)) {
        this.lastInputType = 'keyboard';
        this.emitAction(action, 'keyboard', timestamp);
      } else if (this.gamepad.isJustPressed(action)) {
        this.lastInputType = 'gamepad';
        this.emitAction(action, 'gamepad', timestamp);
      }
    }
  }

  // -- Query API ------------------------------------------------------------

  /**
   * Returns true if the action is currently held on either keyboard (for
   * the given player) or gamepad.
   *
   * @param action  The input action to test.
   * @param player  1 or 2 (default 1). Only affects the keyboard source.
   */
  isAction(action: InputAction, player: 1 | 2 = 1): boolean {
    const kb = player === 1 ? this.keyboardP1 : this.keyboardP2;
    return kb.isPressed(action) || this.gamepad.isPressed(action);
  }

  /**
   * Returns true only on the frame the action was first pressed or on a
   * frame where an auto-repeat pulse fires.
   */
  isActionJustPressed(action: InputAction, player: 1 | 2 = 1): boolean {
    const kb = player === 1 ? this.keyboardP1 : this.keyboardP2;
    return kb.isJustPressed(action) || this.gamepad.isJustPressed(action);
  }

  /**
   * Returns which input device most recently produced an action event.
   * Returns 'none' if no input has been received since attach/reset.
   */
  getActiveInputType(): InputType {
    return this.lastInputType;
  }

  // -- Binding remapping ----------------------------------------------------

  /**
   * Replace keyboard bindings at runtime.
   *
   * @param bindings  New KeyBindings map.
   * @param player    Which player's keyboard bindings to replace (1 or 2).
   */
  setKeyBindings(bindings: KeyBindings, player: 1 | 2 = 1): void {
    if (player === 1) {
      this.keyboardP1.setBindings(bindings);
    } else {
      this.keyboardP2.setBindings(bindings);
    }
  }

  /** Retrieve the current keyboard bindings for a player. */
  getKeyBindings(player: 1 | 2 = 1): KeyBindings {
    return player === 1
      ? this.keyboardP1.getBindings()
      : this.keyboardP2.getBindings();
  }

  /**
   * Replace the gamepad button mapping.
   */
  setGamepadConfig(config: Partial<GamepadHandlerConfig>): void {
    if (config.bindings) {
      this.gamepad.setBindings(config.bindings);
    }
    if (config.deadZone !== undefined) {
      this.gamepad.setDeadZone(config.deadZone);
    }
  }

  /** Retrieve the current gamepad bindings. */
  getGamepadBindings(): GamepadBindings {
    return this.gamepad.getBindings();
  }

  /** Retrieve the current analog stick dead zone. */
  getGamepadDeadZone(): number {
    return this.gamepad.getDeadZone();
  }

  // -- Event emitter --------------------------------------------------------

  /**
   * Register a callback that fires whenever any action is activated
   * (initial press or auto-repeat pulse).
   */
  onAction(callback: InputActionCallback): void {
    this.actionCallbacks.push(callback);
  }

  /**
   * Remove a previously registered action callback.
   */
  offAction(callback: InputActionCallback): void {
    const idx = this.actionCallbacks.indexOf(callback);
    if (idx !== -1) {
      this.actionCallbacks.splice(idx, 1);
    }
  }

  /** Register a callback for gamepad connection events. */
  onGamepadConnect(callback: GamepadConnectCallback): void {
    this.gamepad.onConnect(callback);
  }

  /** Register a callback for gamepad disconnection events. */
  onGamepadDisconnect(callback: GamepadDisconnectCallback): void {
    this.gamepad.onDisconnect(callback);
  }

  // -- Accessors for sub-handlers (advanced use) ----------------------------

  /** Direct access to the Player 1 keyboard handler. */
  getKeyboardP1(): KeyboardHandler {
    return this.keyboardP1;
  }

  /** Direct access to the Player 2 keyboard handler. */
  getKeyboardP2(): KeyboardHandler {
    return this.keyboardP2;
  }

  /** Direct access to the gamepad handler. */
  getGamepadHandler(): GamepadHandler {
    return this.gamepad;
  }

  // -- Internal helpers -----------------------------------------------------

  private emitAction(
    action: InputAction,
    source: InputType,
    timestamp: number,
  ): void {
    const event: InputActionEvent = {
      action,
      type: 'press',
      source,
      timestamp,
    };
    for (const cb of this.actionCallbacks) {
      cb(event);
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton export — import this from anywhere in the application.
// ---------------------------------------------------------------------------
export const inputManager = new InputManager();
