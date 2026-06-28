/**
 * NES-Style Sound Effect Presets
 *
 * These presets define parameters for authentic NES/Famicom sound effects.
 * The original NES used the Ricoh 2A03 chip, which had:
 *   - 2 pulse wave channels (4 duty cycles: 12.5%, 25%, 50%, 75%)
 *   - 1 triangle wave channel
 *   - 1 white noise channel
 *   - 1 DMC (sample playback) channel
 *
 * All frequencies and durations here are tuned to feel like real NES game SFX.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Supported NES duty cycles for pulse channels */
export type DutyCycle = 0.125 | 0.25 | 0.5 | 0.75;

/** Waveform types available on the NES 2A03 chip */
export type NesWaveType = 'pulse' | 'triangle' | 'noise';

/** All available sound effect names */
export type SoundEffectName =
  | 'cursorUp'
  | 'cursorDown'
  | 'confirm'
  | 'cancel'
  | 'pageTurn'
  | 'cartridgeInsert'
  | 'powerOn'
  | 'pause'
  | 'menuOpen';

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

/** A single tone/note within a sound effect */
export interface NesTone {
  /** Frequency in Hz */
  frequency: number;
  /** Duration in milliseconds */
  duration: number;
  /** Duty cycle for pulse waves (ignored for triangle/noise) */
  dutyCycle: DutyCycle;
  /** Volume multiplier 0-1 (relative to master SFX volume) */
  volume: number;
  /** Which waveform to use */
  type: NesWaveType;
  /**
   * Optional frequency sweep end value.
   * NES sound effects often use instantaneous frequency jumps rather than
   * smooth sweeps, so this represents a target frequency that is reached
   * via discrete step changes within the tone duration.
   */
  frequencyEnd?: number;
  /**
   * Number of discrete frequency steps when sweeping.
   * NES didn't do smooth glides - it stepped through frequencies.
   * Default: 1 (no stepping, instant change).
   */
  steps?: number;
  /** Optional delay before this tone starts (ms) */
  delay?: number;
}

/** Complete sound effect definition: one or more tones layered/sequenced */
export interface SoundEffectPreset {
  /** Human-readable name */
  name: string;
  /** Ordered list of tones that make up this effect */
  tones: NesTone[];
  /**
   * If true, mix white noise into the output alongside the primary tones.
   * Used for effects like cartridge insert that need a noise burst.
   */
  noiseMix?: boolean;
  /** Volume of the noise mix (0-1), only used when noiseMix is true */
  noiseVolume?: number;
  /** Duration of noise mix in ms */
  noiseDuration?: number;
}

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

/** Cursor Up: short ascending square wave blip, classic NES menu navigation */
export const CURSOR_UP: SoundEffectPreset = {
  name: 'Cursor Up',
  tones: [
    {
      frequency: 880,       // A5 - bright, upward feel
      duration: 50,
      dutyCycle: 0.5,       // 50% duty = classic NES "square" sound
      volume: 0.6,
      type: 'pulse',
    },
  ],
};

/** Cursor Down: short descending square wave blip */
export const CURSOR_DOWN: SoundEffectPreset = {
  name: 'Cursor Down',
  tones: [
    {
      frequency: 660,       // E5 - lower pitch for downward motion
      duration: 50,
      dutyCycle: 0.5,
      volume: 0.6,
      type: 'pulse',
    },
  ],
};

/** Confirm: two ascending blips - the quintessential NES "select" sound */
export const CONFIRM: SoundEffectPreset = {
  name: 'Confirm',
  tones: [
    {
      frequency: 600,       // First blip
      duration: 40,
      dutyCycle: 0.5,
      volume: 0.6,
      type: 'pulse',
      delay: 0,
    },
    {
      frequency: 900,       // Second blip, higher = positive/affirming
      duration: 40,
      dutyCycle: 0.5,
      volume: 0.7,
      type: 'pulse',
      delay: 50,            // Brief gap between blips
    },
  ],
};

/** Cancel: descending tone, unmistakably "negative" in NES games */
export const CANCEL: SoundEffectPreset = {
  name: 'Cancel',
  tones: [
    {
      frequency: 800,       // Start high
      frequencyEnd: 500,    // Sweep down
      duration: 60,
      dutyCycle: 0.5,
      volume: 0.6,
      type: 'pulse',
      steps: 4,             // 4 discrete steps for that chunky NES sweep
    },
  ],
};

/** Page Turn: rapid triple blip ascending, like flipping through a menu */
export const PAGE_TURN: SoundEffectPreset = {
  name: 'Page Turn',
  tones: [
    {
      frequency: 400,
      duration: 30,
      dutyCycle: 0.25,      // 25% duty = thinner, reedier pulse
      volume: 0.5,
      type: 'pulse',
      delay: 0,
    },
    {
      frequency: 600,
      duration: 30,
      dutyCycle: 0.25,
      volume: 0.5,
      type: 'pulse',
      delay: 35,
    },
    {
      frequency: 800,
      duration: 30,
      dutyCycle: 0.25,
      volume: 0.5,
      type: 'pulse',
      delay: 70,
    },
  ],
};

/** Cartridge Insert: square wave + white noise, mimicking the physical click */
export const CARTRIDGE_INSERT: SoundEffectPreset = {
  name: 'Cartridge Insert',
  tones: [
    {
      frequency: 200,       // Low thud
      duration: 150,
      dutyCycle: 0.5,
      volume: 0.5,
      type: 'pulse',
    },
  ],
  noiseMix: true,
  noiseVolume: 0.3,
  noiseDuration: 80,        // Short noise burst at the start
};

/** Power On: triangle wave low hum fading in, like the NES boot */
export const POWER_ON: SoundEffectPreset = {
  name: 'Power On',
  tones: [
    {
      frequency: 110,       // A2 - low hum
      duration: 500,
      dutyCycle: 0.5,       // Ignored for triangle, kept for type consistency
      volume: 0.7,
      type: 'triangle',     // Triangle channel for that warm NES bass
    },
  ],
};

/** Pause: descending double tone */
export const PAUSE: SoundEffectPreset = {
  name: 'Pause',
  tones: [
    {
      frequency: 880,       // A5
      duration: 80,
      dutyCycle: 0.5,
      volume: 0.5,
      type: 'pulse',
      delay: 0,
    },
    {
      frequency: 440,       // A4 - octave down
      duration: 80,
      dutyCycle: 0.5,
      volume: 0.5,
      type: 'pulse',
      delay: 90,
    },
  ],
};

/** Menu Open: ascending arpeggio, bright and inviting */
export const MENU_OPEN: SoundEffectPreset = {
  name: 'Menu Open',
  tones: [
    {
      frequency: 440,       // A4
      duration: 35,
      dutyCycle: 0.125,     // 12.5% duty = very thin, nasal pulse
      volume: 0.5,
      type: 'pulse',
      delay: 0,
    },
    {
      frequency: 554,       // C#5
      duration: 35,
      dutyCycle: 0.125,
      volume: 0.5,
      type: 'pulse',
      delay: 40,
    },
    {
      frequency: 660,       // E5
      duration: 35,
      dutyCycle: 0.125,
      volume: 0.55,
      type: 'pulse',
      delay: 80,
    },
    {
      frequency: 880,       // A5 - octave above root
      duration: 50,
      dutyCycle: 0.25,
      volume: 0.6,
      type: 'pulse',
      delay: 120,
    },
  ],
};

// ---------------------------------------------------------------------------
// Lookup map
// ---------------------------------------------------------------------------

/** Map of all presets keyed by SoundEffectName */
export const PRESET_MAP: Record<SoundEffectName, SoundEffectPreset> = {
  cursorUp: CURSOR_UP,
  cursorDown: CURSOR_DOWN,
  confirm: CONFIRM,
  cancel: CANCEL,
  pageTurn: PAGE_TURN,
  cartridgeInsert: CARTRIDGE_INSERT,
  powerOn: POWER_ON,
  pause: PAUSE,
  menuOpen: MENU_OPEN,
};
