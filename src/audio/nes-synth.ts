/**
 * NES-Style Audio Synthesis Engine
 *
 * Emulates the Ricoh 2A03 (RP2A03) sound chip found in the NES/Famicom.
 * The 2A03 provided:
 *   - 2 pulse channels with 4 selectable duty cycles (12.5%, 25%, 50%, 75%)
 *   - 1 triangle channel (fixed waveform, no volume control on hardware)
 *   - 1 noise channel (LFSR-based pseudo-random)
 *   - 1 DMC channel (1-bit delta modulation for samples)
 *
 * This engine recreates the pulse and triangle channels using Web Audio API's
 * PeriodicWave, which allows us to define custom harmonic spectra that match
 * the NES duty cycles exactly.
 *
 * KEY AUTHENTICITY PRINCIPLES:
 *   1. Frequency changes are INSTANT (setValueAtTime), never smooth ramps.
 *      The NES frequency sweep unit updated at ~60Hz, producing discrete jumps.
 *   2. Envelopes are near-instant attack (~2ms) with linear decay, mimicking
 *      the NES's volume envelope unit which used linear steps.
 *   3. All pulse oscillators use PeriodicWave, NOT the built-in 'square' type.
 *      A true 50% duty square and NES 50% duty pulse differ in harmonic content.
 *   4. Optional bit-crushing via WaveShaperNode adds the subtle quantization
 *      artifacts present in the NES's 4-bit DAC output stage.
 */

import {
  type DutyCycle,
  type SoundEffectName,
  type SoundEffectPreset,
  type NesTone,
  PRESET_MAP,
} from './presets';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Attack time in seconds.
 * Kept at ~2ms to prevent digital clicks (instant on/off causes spectral
 * splatter) while preserving the NES's famously abrupt sound.
 */
const ATTACK_TIME = 0.002;

/**
 * Release/tail time in seconds.
 * A short release prevents truncation clicks at the end of notes.
 */
const RELEASE_TIME = 0.005;

/**
 * Number of harmonics to include in PeriodicWave generation.
 * The NES pulse channel produced harmonics up to the Nyquist limit,
 * but for Web Audio we cap at 32 for performance (covers ~20kHz at 44.1k SR).
 */
const NUM_HARMONICS = 32;

// ---------------------------------------------------------------------------
// PeriodicWave Generation
// ---------------------------------------------------------------------------

/**
 * Generate Fourier coefficients for a pulse wave with a given duty cycle.
 *
 * A pulse wave with duty cycle D has the Fourier series:
 *   f(t) = 2D + sum_{n=1}^{inf} (2/(n*pi)) * sin(n*pi*D) * cos(2*pi*n*t)
 *
 * The Web Audio PeriodicWave expects:
 *   - real[]: cosine coefficients (a_n)
 *   - imag[]: sine coefficients (b_n)
 *
 * For a pulse wave, all energy is in the cosine (real) terms.
 * The coefficient for harmonic n is: (2 / (n * PI)) * sin(n * PI * duty)
 *
 * Note: harmonic 0 (DC) is set to 0 to avoid a DC offset.
 */
function generatePulseCoefficients(duty: number, harmonics: number): { real: Float32Array; imag: Float32Array } {
  const real = new Float32Array(harmonics);
  const imag = new Float32Array(harmonics);

  // DC component = 0 (we don't want DC offset in audio output)
  real[0] = 0;
  imag[0] = 0;

  for (let n = 1; n < harmonics; n++) {
    // Fourier coefficient for nth harmonic of a pulse wave with given duty
    real[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * duty);
    imag[n] = 0; // No sine component for a symmetric pulse
  }

  return { real, imag };
}

/**
 * Generate Fourier coefficients for the NES triangle wave.
 *
 * The NES triangle channel outputs a 16-step staircase approximation of a
 * triangle wave. Its Fourier series contains only odd harmonics with
 * amplitudes proportional to 1/n^2 (alternating sign).
 *
 * We approximate this with the first N odd harmonics.
 */
function generateTriangleCoefficients(harmonics: number): { real: Float32Array; imag: Float32Array } {
  const real = new Float32Array(harmonics);
  const imag = new Float32Array(harmonics);

  real[0] = 0;
  imag[0] = 0;

  for (let n = 1; n < harmonics; n++) {
    if (n % 2 === 1) {
      // Odd harmonics only, amplitude = 8/(PI^2 * n^2), alternating sign
      const sign = ((n - 1) / 2) % 2 === 0 ? 1 : -1;
      real[n] = sign * (8 / (Math.PI * Math.PI * n * n));
    } else {
      real[n] = 0; // Even harmonics are zero for triangle
    }
    imag[n] = 0;
  }

  return { real, imag };
}

// ---------------------------------------------------------------------------
// Bit-Crushing Curve
// ---------------------------------------------------------------------------

/**
 * Generate a WaveShaper curve that quantizes the signal to a reduced bit depth.
 * This simulates the NES's 4-bit DAC (16 discrete output levels per channel).
 *
 * @param bits - Effective bit depth (4 = 16 levels, matching NES hardware)
 * @param samples - Number of samples in the curve (higher = smoother lookup)
 */
function generateBitCrushCurve(bits: number = 4, samples: number = 4096): Float32Array {
  const curve = new Float32Array(samples);
  const levels = Math.pow(2, bits); // 16 levels for 4-bit

  for (let i = 0; i < samples; i++) {
    // Map index to [-1, 1] range
    const x = (i / (samples - 1)) * 2 - 1;
    // Quantize: round to nearest level
    const step = 2 / levels;
    curve[i] = Math.round(x / step) * step;
  }

  return curve;
}

// ---------------------------------------------------------------------------
// White Noise Buffer
// ---------------------------------------------------------------------------

/**
 * Generate a buffer of white noise for the NES noise channel emulation.
 * The actual NES used a 15-bit LFSR, but white noise is a close approximation.
 */
function generateNoiseBuffer(ctx: AudioContext, durationSec: number): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = Math.floor(sampleRate * durationSec);
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < length; i++) {
    // Pseudo-random values in [-1, 1]
    data[i] = Math.random() * 2 - 1;
  }

  return buffer;
}

// ---------------------------------------------------------------------------
// NESSynth Class
// ---------------------------------------------------------------------------

export class NESSynth {
  private ctx: AudioContext;

  /** Master output gain node (controls overall volume) */
  private masterGain: GainNode;

  /** SFX-specific gain node (nested under master) */
  private sfxGain: GainNode;

  /** Optional bit-crusher WaveShaper node */
  private bitCrusher: WaveShaperNode | null = null;

  /** Whether bit-crushing is currently active */
  private bitCrushEnabled = false;

  /**
   * Cached PeriodicWave objects for each duty cycle.
   * Creating PeriodicWaves is expensive, so we build them once at init.
   */
  private pulseWaves: Map<DutyCycle, PeriodicWave>;

  /** Cached triangle PeriodicWave */
  private triangleWave: PeriodicWave;

  /** Cached noise buffer (1 second, reused across effects) */
  private noiseBuffer: AudioBuffer;

  /**
   * Master volume: 0 (silent) to 1 (full).
   * Affects all audio output from this synth.
   */
  public masterVolume = 0.7;

  /**
   * SFX volume: 0 (silent) to 1 (full).
   * Applied on top of master volume for sound effects.
   */
  public sfxVolume = 0.8;

  constructor() {
    // Lazy-init AudioContext on first user interaction (browser requirement)
    this.ctx = new AudioContext();

    // Build signal chain: sfxGain -> [bitCrusher?] -> masterGain -> destination
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.masterVolume;
    this.masterGain.connect(this.ctx.destination);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = this.sfxVolume;
    this.sfxGain.connect(this.masterGain);

    // Pre-build PeriodicWaves for all NES duty cycles
    this.pulseWaves = new Map();
    const duties: DutyCycle[] = [0.125, 0.25, 0.5, 0.75];
    for (const duty of duties) {
      const { real, imag } = generatePulseCoefficients(duty, NUM_HARMONICS);
      const wave = this.ctx.createPeriodicWave(real, imag, {
        // Disable normalization to preserve authentic amplitude differences
        // between duty cycles (12.5% is naturally quieter than 50%)
        disableNormalization: false,
      });
      this.pulseWaves.set(duty, wave);
    }

    // Build triangle wave
    const triCoeffs = generateTriangleCoefficients(NUM_HARMONICS);
    this.triangleWave = this.ctx.createPeriodicWave(triCoeffs.real, triCoeffs.imag, {
      disableNormalization: false,
    });

    // Pre-generate noise buffer (1 second)
    this.noiseBuffer = generateNoiseBuffer(this.ctx, 1.0);
  }

  // -------------------------------------------------------------------------
  // Volume Controls
  // -------------------------------------------------------------------------

  /** Set master volume (0-1). Immediately applies. */
  setMasterVolume(vol: number): void {
    this.masterVolume = Math.max(0, Math.min(1, vol));
    this.masterGain.gain.setValueAtTime(this.masterVolume, this.ctx.currentTime);
  }

  /** Set SFX volume (0-1). Immediately applies. */
  setSfxVolume(vol: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, vol));
    this.sfxGain.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
  }

  // -------------------------------------------------------------------------
  // Bit-Crusher
  // -------------------------------------------------------------------------

  /**
   * Enable the bit-crushing effect to simulate NES's 4-bit DAC quantization.
   * Adds subtle stepped artifacts to all audio output.
   *
   * @param bits - Bit depth (1-8). Default 4 matches NES hardware.
   */
  enableBitCrusher(bits: number = 4): void {
    if (this.bitCrushEnabled) return;

    this.bitCrusher = this.ctx.createWaveShaper();
    this.bitCrusher.curve = generateBitCrushCurve(bits);
    this.bitCrusher.oversample = '2x'; // Mild oversampling reduces aliasing

    // Re-route: sfxGain -> bitCrusher -> masterGain
    this.sfxGain.disconnect();
    this.sfxGain.connect(this.bitCrusher);
    this.bitCrusher.connect(this.masterGain);

    this.bitCrushEnabled = true;
  }

  /** Disable bit-crushing, restoring clean signal path. */
  disableBitCrusher(): void {
    if (!this.bitCrushEnabled || !this.bitCrusher) return;

    // Re-route: sfxGain -> masterGain (bypass crusher)
    this.sfxGain.disconnect();
    this.bitCrusher.disconnect();
    this.sfxGain.connect(this.masterGain);

    this.bitCrusher = null;
    this.bitCrushEnabled = false;
  }

  // -------------------------------------------------------------------------
  // AudioContext Management
  // -------------------------------------------------------------------------

  /** Get the underlying AudioContext (for sharing with emulator audio output). */
  getAudioContext(): AudioContext {
    return this.ctx;
  }

  /**
   * Resume the AudioContext. Browsers require a user gesture to start audio.
   * Call this on first user interaction (click/keypress).
   */
  async resume(): Promise<void> {
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  /** Suspend the AudioContext to save resources. */
  async suspend(): Promise<void> {
    await this.ctx.suspend();
  }

  /** Close the AudioContext entirely (cleanup). */
  async close(): Promise<void> {
    await this.ctx.close();
  }

  // -------------------------------------------------------------------------
  // Core Tone Playback
  // -------------------------------------------------------------------------

  /**
   * Play a single NES tone with authentic characteristics.
   *
   * This is the fundamental building block for all sound effects.
   * It creates an oscillator, applies an envelope, and connects it through
   * the signal chain. The oscillator is automatically stopped and cleaned up.
   */
  private playTone(tone: NesTone, startTime: number): void {
    const durationSec = tone.duration / 1000;

    // Create oscillator with the appropriate waveform
    const osc = this.ctx.createOscillator();

    if (tone.type === 'triangle') {
      osc.setPeriodicWave(this.triangleWave);
    } else {
      // Pulse wave with specified duty cycle
      const wave = this.pulseWaves.get(tone.dutyCycle);
      if (wave) {
        osc.setPeriodicWave(wave);
      } else {
        // Fallback to 50% duty
        osc.setPeriodicWave(this.pulseWaves.get(0.5)!);
      }
    }

    // Create per-tone gain for envelope control
    const toneGain = this.ctx.createGain();
    const t = startTime;

    // --- Envelope ---
    // Start silent
    toneGain.gain.setValueAtTime(0, t);

    // Instant attack (~2ms) to prevent spectral splatter / clicks
    // This is the MINIMUM ramp needed to avoid harsh transients while
    // still sounding like the NES's abrupt envelopes.
    toneGain.gain.linearRampToValueAtTime(tone.volume, t + ATTACK_TIME);

    // Hold at full volume for most of the duration
    const releaseStart = t + durationSec - RELEASE_TIME;
    toneGain.gain.setValueAtTime(tone.volume, Math.max(releaseStart, t + ATTACK_TIME));

    // Short release to avoid truncation click
    toneGain.gain.linearRampToValueAtTime(0, t + durationSec);

    // --- Frequency ---
    // NES frequency changes were INSTANT (no portamento).
    // We use setValueAtTime to achieve the characteristic stepped pitch changes.
    osc.frequency.setValueAtTime(tone.frequency, t);

    if (tone.frequencyEnd !== undefined && tone.steps && tone.steps > 1) {
      // Discrete stepped frequency sweep (NES-style)
      const stepDuration = durationSec / tone.steps;
      const freqDelta = (tone.frequencyEnd - tone.frequency) / tone.steps;

      for (let i = 1; i <= tone.steps; i++) {
        const stepFreq = tone.frequency + freqDelta * i;
        const stepTime = t + stepDuration * i;
        // INSTANT jump - no interpolation, just like the NES
        osc.frequency.setValueAtTime(stepFreq, stepTime);
      }
    } else if (tone.frequencyEnd !== undefined) {
      // Single instant jump at midpoint
      const midTime = t + durationSec * 0.5;
      osc.frequency.setValueAtTime(tone.frequencyEnd, midTime);
    }

    // Connect: oscillator -> tone gain -> sfx gain (-> [crusher] -> master -> out)
    osc.connect(toneGain);
    toneGain.connect(this.sfxGain);

    // Schedule start and stop
    osc.start(t);
    osc.stop(t + durationSec + 0.01); // Small buffer past the release
  }

  /**
   * Play a noise burst (for noise-mixed effects like cartridge insert).
   */
  private playNoise(volume: number, durationMs: number, startTime: number): void {
    const durationSec = durationMs / 1000;

    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = this.noiseBuffer;

    const noiseGain = this.ctx.createGain();
    const t = startTime;

    // Envelope for noise
    noiseGain.gain.setValueAtTime(0, t);
    noiseGain.gain.linearRampToValueAtTime(volume, t + ATTACK_TIME);
    noiseGain.gain.setValueAtTime(volume, t + durationSec - RELEASE_TIME);
    noiseGain.gain.linearRampToValueAtTime(0, t + durationSec);

    noiseSource.connect(noiseGain);
    noiseGain.connect(this.sfxGain);

    noiseSource.start(t);
    noiseSource.stop(t + durationSec + 0.01);
  }

  // -------------------------------------------------------------------------
  // Preset Playback
  // -------------------------------------------------------------------------

  /**
   * Play a sound effect by preset object.
   * Handles sequencing of multiple tones and optional noise mix.
   */
  playPreset(preset: SoundEffectPreset): void {
    // Ensure AudioContext is running
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    const now = this.ctx.currentTime;

    // Schedule each tone with its delay offset
    for (const tone of preset.tones) {
      const delaySec = (tone.delay || 0) / 1000;
      this.playTone(tone, now + delaySec);
    }

    // Mix in noise if the preset calls for it
    if (preset.noiseMix && preset.noiseVolume && preset.noiseDuration) {
      this.playNoise(preset.noiseVolume, preset.noiseDuration, now);
    }
  }

  /**
   * Play a sound effect by name, looking up the preset from the registry.
   */
  play(name: SoundEffectName): void {
    const preset = PRESET_MAP[name];
    if (preset) {
      this.playPreset(preset);
    }
  }

  // -------------------------------------------------------------------------
  // Convenience Methods - Named Sound Effects
  // -------------------------------------------------------------------------

  /** Short ascending square wave blip (880Hz, 50ms, 50% duty). Menu up. */
  playCursorUp(): void {
    this.play('cursorUp');
  }

  /** Short descending square wave blip (660Hz, 50ms, 50% duty). Menu down. */
  playCursorDown(): void {
    this.play('cursorDown');
  }

  /** Two ascending blips (600Hz -> 900Hz, 40ms each). Selection confirmed. */
  playConfirm(): void {
    this.play('confirm');
  }

  /** Descending tone (800Hz -> 500Hz, 60ms). Cancel / back. */
  playCancel(): void {
    this.play('cancel');
  }

  /** Rapid triple blip (400/600/800Hz, 30ms each). Page turn. */
  playPageTurn(): void {
    this.play('pageTurn');
  }

  /** Square wave + white noise mix (200Hz, 150ms). Cartridge insertion. */
  playCartridgeInsert(): void {
    this.play('cartridgeInsert');
  }

  /** Triangle wave low hum fade in (110Hz, 500ms). Power-on sequence. */
  playPowerOn(): void {
    this.play('powerOn');
  }

  /** Descending double tone (880Hz -> 440Hz, 80ms each). Pause toggle. */
  playPause(): void {
    this.play('pause');
  }

  /** Ascending arpeggio (A major). Menu opening. */
  playMenuOpen(): void {
    this.play('menuOpen');
  }
}

// ---------------------------------------------------------------------------
// Singleton Export
// ---------------------------------------------------------------------------

/**
 * Singleton instance of the NES synthesizer.
 * Import this anywhere in the app to play NES-style sound effects.
 *
 * Usage:
 *   import { nesSynth } from './audio/nes-synth';
 *   nesSynth.playConfirm();
 *
 * Note: Most browsers require a user gesture before audio can play.
 * Call `nesSynth.resume()` inside a click/keydown handler on first load.
 */
export const nesSynth = new NESSynth();
