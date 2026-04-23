import { describe, it, expect } from 'vitest';
import {
  computeFrameRms,
  createOnsetGateState,
  updateOnsetGate,
  isOnsetGateOpen,
  consumeOnsetGate,
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
});
