// ============================================================================
// key-bindings.ts
// Default key bindings and types for the FC Platform input system.
// ============================================================================

/** All possible input actions mirroring the original FC controller layout. */
export type InputAction =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'a'
  | 'b'
  | 'start'
  | 'select';

/** A mapping from keyboard key codes (KeyboardEvent.code) to input actions. */
export type KeyBindings = Record<string, InputAction>;

/** A mapping from gamepad button indices to input actions. */
export type GamepadBindings = Record<number, InputAction>;

/** Full input configuration for one player. */
export interface InputConfig {
  keyboard: KeyBindings;
  gamepad: GamepadBindings;
}

// ---------------------------------------------------------------------------
// Default Player 1 keyboard bindings
// Arrow keys + WASD for direction, J/Z = A, K/X = B, Enter = Start, Shift = Select
// ---------------------------------------------------------------------------
export const DEFAULT_PLAYER1_KEYS: KeyBindings = {
  // Arrow keys
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  // WASD
  KeyW: 'up',
  KeyS: 'down',
  KeyA: 'left',
  KeyD: 'right',
  // Action buttons
  KeyJ: 'a',
  KeyZ: 'a',
  KeyK: 'b',
  KeyX: 'b',
  // Meta buttons
  Enter: 'start',
  ShiftLeft: 'select',
  ShiftRight: 'select',
};

// ---------------------------------------------------------------------------
// Default Player 2 keyboard bindings
// I/K/J/L for direction (note: K and J overlap with P1 action buttons —
// this is intentional since two players on one keyboard is uncommon),
// O = A, P = B, Digit1 = Start, Digit2 = Select
// ---------------------------------------------------------------------------
export const DEFAULT_PLAYER2_KEYS: KeyBindings = {
  // Direction keys
  KeyI: 'up',
  KeyK: 'down',
  KeyJ: 'left',
  KeyL: 'right',
  // Action buttons
  KeyO: 'a',
  KeyP: 'b',
  // Meta buttons
  Digit1: 'start',
  Digit2: 'select',
};

// ---------------------------------------------------------------------------
// Default gamepad button mapping (Standard Gamepad API mapping)
// D-pad: 12=up, 13=down, 14=left, 15=right
// Face:  0=A, 1=B
// Meta:  9=Start, 8=Select (Back)
// ---------------------------------------------------------------------------
export const DEFAULT_GAMEPAD_BINDINGS: GamepadBindings = {
  12: 'up',
  13: 'down',
  14: 'left',
  15: 'right',
  0: 'a',
  1: 'b',
  9: 'start',
  8: 'select',
};

/** Default analog stick axis indices (standard mapping). */
export const GAMEPAD_AXIS = {
  LEFT_X: 0,
  LEFT_Y: 1,
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Given a key code string, find the InputAction it maps to in the supplied
 * bindings.  Returns `undefined` when the key is not bound.
 *
 * @param keyCode  KeyboardEvent.code value, e.g. "ArrowUp"
 * @param bindings The KeyBindings map to search
 */
export function keyToAction(
  keyCode: string,
  bindings: KeyBindings,
): InputAction | undefined {
  return bindings[keyCode];
}

/**
 * Given a gamepad button index, find the InputAction it maps to.
 *
 * @param buttonIndex  Standard gamepad button index
 * @param bindings     The GamepadBindings map to search
 */
export function buttonToAction(
  buttonIndex: number,
  bindings: GamepadBindings,
): InputAction | undefined {
  return bindings[buttonIndex];
}

/**
 * Reverse lookup: given an InputAction, return all key codes that are bound
 * to it.  Useful for displaying "Press [KEY] to continue" prompts.
 *
 * @param action   The action to look up
 * @param bindings The KeyBindings map to search
 */
export function actionToKeys(
  action: InputAction,
  bindings: KeyBindings,
): string[] {
  const keys: string[] = [];
  for (const [code, bound] of Object.entries(bindings)) {
    if (bound === action) {
      keys.push(code);
    }
  }
  return keys;
}

/**
 * Reverse lookup for gamepad: given an action, return all button indices
 * bound to it.
 */
export function actionToButtons(
  action: InputAction,
  bindings: GamepadBindings,
): number[] {
  const buttons: number[] = [];
  for (const [idx, bound] of Object.entries(bindings)) {
    if (bound === action) {
      buttons.push(Number(idx));
    }
  }
  return buttons;
}
