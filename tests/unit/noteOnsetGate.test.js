import { describe, it, expect } from 'vitest';
import {
  computeFrameRms,
  createOnsetGateState,
  updateOnsetGate,
  isOnsetGateOpen,
  consumeOnsetGate,
  ONSET_REATTACK_SPIKE_FACTOR,
} from '../../js/shared/audio/noteOnsetGate.js';

function constantBuffer(value, length = 64) {
  return new Float32Array(length).fill(value);
}

describe('noteOnsetGate', () => {
  it('computes RMS for a constant buffer', () => {
    expect(computeFrameRms(constantBuffer(0.25))).toBeCloseTo(0.25, 5);
  });

  it('opens the gate on a rising edge above threshold', () => {
    let state = createOnsetGateState();
    ({ nextState: state } = updateOnsetGate(state, 0.001));

    const res = updateOnsetGate(state, 0.08);
    expect(res.event).toBe('onset');
    expect(isOnsetGateOpen(res.nextState)).toBe(true);
  });

  it('does not retrigger while the signal stays above threshold', () => {
    let state = createOnsetGateState();
    ({ nextState: state } = updateOnsetGate(state, 0.001));
    ({ nextState: state } = updateOnsetGate(state, 0.08));

    const res = updateOnsetGate(state, 0.08);
    expect(res.event).toBeNull();
  });

  it('consumeOnsetGate closes the gate until a new attack arrives', () => {
    let state = createOnsetGateState();
    ({ nextState: state } = updateOnsetGate(state, 0.001));
    ({ nextState: state } = updateOnsetGate(state, 0.08));

    state = consumeOnsetGate(state);
    expect(isOnsetGateOpen(state)).toBe(false);

    const sustained = updateOnsetGate(state, 0.08);
    expect(sustained.event).toBeNull();
    expect(isOnsetGateOpen(sustained.nextState)).toBe(false);
  });

  it('reopens only after the signal falls back and rises again', () => {
    let state = createOnsetGateState();
    ({ nextState: state } = updateOnsetGate(state, 0.001));
    ({ nextState: state } = updateOnsetGate(state, 0.08));
    state = consumeOnsetGate(state);

    for (let i = 0; i < 4; i++) {
      ({ nextState: state } = updateOnsetGate(state, 0.001));
    }
    const replay = updateOnsetGate(state, 0.08);

    expect(replay.event).toBe('onset');
    expect(isOnsetGateOpen(replay.nextState)).toBe(true);
  });

  it('reopens on a strong re-attack without requiring near-silence first', () => {
    let state = createOnsetGateState();
    ({ nextState: state } = updateOnsetGate(state, 0.001));
    ({ nextState: state } = updateOnsetGate(state, 0.08));
    state = consumeOnsetGate(state);

    for (const rms of [0.07, 0.05, 0.03, 0.02, 0.018]) {
      ({ nextState: state } = updateOnsetGate(state, rms));
    }

    const replay = updateOnsetGate(state, 0.055);

    expect(replay.event).toBe('onset');
    expect(isOnsetGateOpen(replay.nextState)).toBe(true);
  });

  // TC1 – reattackSpikeFactor: lenient re-trigger fires at 1.6× floor
  it('retriggers during sustain when reattackSpikeFactor is lowered', () => {
    let state = createOnsetGateState();
    ({ nextState: state } = updateOnsetGate(state, 0.001));
    ({ nextState: state } = updateOnsetGate(state, 0.08));
    state = consumeOnsetGate(state);

    // Sustain decays: trackedFloor tracks the minimum → ≈ 0.04
    for (const rms of [0.07, 0.06, 0.05, 0.04]) {
      ({ nextState: state } = updateOnsetGate(state, rms));
    }

    // New attack: 0.065 = 1.625× floor (0.04) — below default 2.2×, above 1.5×
    const result = updateOnsetGate(state, 0.065, { reattackSpikeFactor: ONSET_REATTACK_SPIKE_FACTOR });

    expect(result.event).toBe('onset');
    expect(isOnsetGateOpen(result.nextState)).toBe(true);
  });

  // TC2 – same scenario without option: default 2.2× is too strict, no retrigger
  it('does not retrigger at 1.6× floor when reattackSpikeFactor is default (2.2)', () => {
    let state = createOnsetGateState();
    ({ nextState: state } = updateOnsetGate(state, 0.001));
    ({ nextState: state } = updateOnsetGate(state, 0.08));
    state = consumeOnsetGate(state);

    for (const rms of [0.07, 0.06, 0.05, 0.04]) {
      ({ nextState: state } = updateOnsetGate(state, rms));
    }

    // 0.065 < 0.04 * 2.2 = 0.088 → no retrigger
    const result = updateOnsetGate(state, 0.065);

    expect(result.event).toBeNull();
    expect(isOnsetGateOpen(result.nextState)).toBe(false);
  });

  // TC3 – absolute delta guard still applies even with low reattackSpikeFactor
  it('does not retrigger when absolute delta is below reattackMinDelta', () => {
    let state = createOnsetGateState();
    ({ nextState: state } = updateOnsetGate(state, 0.001));
    ({ nextState: state } = updateOnsetGate(state, 0.003));
    state = consumeOnsetGate(state);

    // trackedFloor → 0.002 after slight decay
    ({ nextState: state } = updateOnsetGate(state, 0.002));

    // 0.004 = 2× floor (> 1.5×), but delta = 0.002 < ONSET_REATTACK_MIN_DELTA (0.015)
    const result = updateOnsetGate(state, 0.004, { reattackSpikeFactor: ONSET_REATTACK_SPIKE_FACTOR });

    expect(result.event).toBeNull();
  });

  // TC4 – backward compatibility: no option, strong attack → unchanged behaviour
  it('backward-compatible: strong re-attack without option still triggers', () => {
    let state = createOnsetGateState();
    ({ nextState: state } = updateOnsetGate(state, 0.001));
    ({ nextState: state } = updateOnsetGate(state, 0.08));
    state = consumeOnsetGate(state);

    for (const rms of [0.07, 0.05, 0.03, 0.02, 0.018]) {
      ({ nextState: state } = updateOnsetGate(state, rms));
    }

    // 0.055 ≈ 3× floor (0.018) → passes even with default 2.2× threshold
    const result = updateOnsetGate(state, 0.055);

    expect(result.event).toBe('onset');
    expect(isOnsetGateOpen(result.nextState)).toBe(true);
  });
});
