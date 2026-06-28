// ============================================================================
// keyboard-handler.ts
// Keyboard input handler with auto-repeat and just-pressed detection.
// ============================================================================

import {
  InputAction,
  KeyBindings,
  DEFAULT_PLAYER1_KEYS,
  keyToAction,
} from './key-bindings';

/** Timing constants for authentic FC auto-repeat behaviour. */
const REPEAT_INITIAL_DELAY_MS = 300; // First repeat fires after 300ms of holding
const REPEAT_INTERVAL_MS = 80;       // Subsequent repeats fire every 80ms

/** Tracks the timing state for a single held key to drive auto-repeat. */
interface HoldState {
  /** Timestamp (ms) when the key was first pressed down. */
  pressedAt: number;
  /** Timestamp (ms) of the last emitted repeat. */
  lastRepeatAt: number;
  /** Whether the initial delay has been satisfied at least once. */
  initialFired: boolean;
}

/**
 * KeyboardHandler
 *
 * Listens to native keydown / keyup events and translates them into
 * FC-controller actions using a configurable binding map.
 *
 * Lifecycle:
 *   1. Construct with optional bindings (defaults to Player 1).
 *   2. Call `attach()` to start listening.
 *   3. Call `update()` once per frame to refresh just-pressed state.
 *   4. Call `detach()` when done to remove listeners cleanly.
 */
export class KeyboardHandler {
  // -- Configuration --------------------------------------------------------
  private bindings: KeyBindings;

  // -- State ----------------------------------------------------------------
  /** Actions that are currently held down (after auto-repeat gating). */
  private heldActions: Set<InputAction> = new Set();

  /** Actions that transitioned to "pressed" this frame (includes repeats). */
  private justPressedActions: Set<InputAction> = new Set();

  /** Per-key hold timing state, keyed by KeyboardEvent.code. */
  private holdStates: Map<string, HoldState> = new Map();

  /** Raw set of currently depressed keys (KeyboardEvent.code values). */
  private rawPressed: Set<string> = new Set();

  /** Whether event listeners are currently attached. */
  private attached = false;

  // -- Bound listener references (needed for removal) -----------------------
  private readonly onKeyDown: (e: KeyboardEvent) => void;
  private readonly onKeyUp: (e: KeyboardEvent) => void;

  // =========================================================================
  constructor(bindings: KeyBindings = { ...DEFAULT_PLAYER1_KEYS }) {
    this.bindings = bindings;

    // Pre-bind so we can remove them later.
    this.onKeyDown = this.handleKeyDown.bind(this);
    this.onKeyUp = this.handleKeyUp.bind(this);
  }

  // -- Lifecycle ------------------------------------------------------------

  /** Attach keydown/keyup listeners to the window. */
  attach(): void {
    if (this.attached) return;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    this.attached = true;
  }

  /** Remove event listeners and reset all internal state. */
  detach(): void {
    if (!this.attached) return;
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.attached = false;
    this.reset();
  }

  /** Clear all held / just-pressed state. */
  reset(): void {
    this.heldActions.clear();
    this.justPressedActions.clear();
    this.holdStates.clear();
    this.rawPressed.clear();
  }

  // -- Per-frame update -----------------------------------------------------

  /**
   * Must be called once per frame (from requestAnimationFrame loop).
   *
   * 1. Clears the just-pressed set from the *previous* frame.
   * 2. Re-evaluates held actions using auto-repeat timing.
   * 3. Marks actions as "just pressed" on the frame they first activate
   *    or on the frame a repeat fires.
   */
  update(timestamp: number = performance.now()): void {
    // Clear last frame's just-pressed flags.
    this.justPressedActions.clear();

    // Rebuild heldActions from raw key state + auto-repeat logic.
    this.heldActions.clear();

    for (const code of this.rawPressed) {
      const action = keyToAction(code, this.bindings);
      if (!action) continue;

      let hold = this.holdStates.get(code);
      if (!hold) {
        // Key was pressed this frame — mark as fresh press.
        hold = {
          pressedAt: timestamp,
          lastRepeatAt: timestamp,
          initialFired: false,
        };
        this.holdStates.set(code, hold);
      }

      const elapsed = timestamp - hold.pressedAt;
      const sinceRepeat = timestamp - hold.lastRepeatAt;

      if (!hold.initialFired) {
        // Still in the initial delay window — emit the very first press.
        if (elapsed < REPEAT_INITIAL_DELAY_MS) {
          // First frame of press — always emit.
          if (elapsed < 16) {
            // Roughly one frame at 60fps — treat as the initial press frame.
            this.heldActions.add(action);
            this.justPressedActions.add(action);
          }
          // Otherwise we are waiting for the initial delay; do not emit.
        } else {
          // Initial delay has elapsed — fire the first repeat.
          hold.initialFired = true;
          hold.lastRepeatAt = timestamp;
          this.heldActions.add(action);
          this.justPressedActions.add(action);
        }
      } else {
        // Past initial delay — use the fast repeat interval.
        if (sinceRepeat >= REPEAT_INTERVAL_MS) {
          hold.lastRepeatAt = timestamp;
          this.heldActions.add(action);
          this.justPressedActions.add(action);
        } else {
          // Between repeats — the action is still "held" (for isPressed),
          // but does NOT re-trigger justPressed.
          this.heldActions.add(action);
        }
      }
    }

    // Clean up hold states for keys that were released.
    for (const [code] of this.holdStates) {
      if (!this.rawPressed.has(code)) {
        this.holdStates.delete(code);
      }
    }
  }

  // -- Query API ------------------------------------------------------------

  /**
   * Returns true if the action is currently held down (including during
   * auto-repeat hold periods between repeat pulses).
   */
  isPressed(action: InputAction): boolean {
    return this.heldActions.has(action);
  }

  /**
   * Returns true only on the exact frame the action was first pressed or
   * on a frame where an auto-repeat pulse fires.
   */
  isJustPressed(action: InputAction): boolean {
    return this.justPressedActions.has(action);
  }

  // -- Binding remapping ----------------------------------------------------

  /**
   * Replace the current key bindings at runtime.
   * Resets all internal state so stale hold timers do not leak.
   */
  setBindings(bindings: KeyBindings): void {
    this.bindings = { ...bindings };
    this.reset();
  }

  /** Return a shallow copy of the current bindings. */
  getBindings(): KeyBindings {
    return { ...this.bindings };
  }

  // -- Internal event handlers ----------------------------------------------

  private handleKeyDown(e: KeyboardEvent): void {
    // Ignore browser auto-repeat events — we implement our own.
    if (e.repeat) return;

    this.rawPressed.add(e.code);
  }

  private handleKeyUp(e: KeyboardEvent): void {
    this.rawPressed.delete(e.code);
  }
}
