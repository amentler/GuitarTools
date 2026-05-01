import { describe, it, expect, beforeEach } from 'vitest';
import {
  createSrsStore,
  pickNextItem,
  recordResult,
  getWeights,
  SRS_WEIGHT_MIN,
  SRS_WEIGHT_MAX,
  SRS_WEIGHT_ON_CORRECT_FAST,
  SRS_WEIGHT_ON_CORRECT_SLOW,
  SRS_WEIGHT_ON_WRONG,
  SRS_FAST_THRESHOLD_MS,
} from '../../js/shared/learning/srsLogic.js';

function makeStorage() {
  const store = {};
  return {
    getItem:    (k) => store[k] ?? null,
    setItem:    (k, v) => { store[k] = v; },
    removeItem: (k) => { delete store[k]; },
    _raw: store,
  };
}

describe('createSrsStore', () => {
  it('initialises with empty weights', () => {
    const storage = makeStorage();
    const s = createSrsStore('test', { storage });
    expect(s.weights).toEqual({});
  });

  it('loads persisted weights from storage', () => {
    const storage = makeStorage();
    storage.setItem('gt_srs_test', JSON.stringify({ A: 3.0, B: 1.5 }));
    const s = createSrsStore('test', { storage });
    expect(s.weights['A']).toBe(3.0);
    expect(s.weights['B']).toBe(1.5);
  });

  it('uses storageKey with prefix', () => {
    const storage = makeStorage();
    const s = createSrsStore('foo', { storage });
    s.save();
    expect(Object.keys(storage._raw)).toContain('gt_srs_foo');
  });

  it('falls back to empty weights on corrupt storage', () => {
    const storage = makeStorage();
    storage.setItem('gt_srs_test', 'not-json');
    const s = createSrsStore('test', { storage });
    expect(s.weights).toEqual({});
  });
});

describe('pickNextItem', () => {
  let storage;
  let store;

  beforeEach(() => {
    storage = makeStorage();
    store = createSrsStore('test', { storage });
  });

  it('returns null for empty pool', () => {
    expect(pickNextItem(store, [])).toBeNull();
  });

  it('returns the only item in a single-item pool', () => {
    expect(pickNextItem(store, ['X'])).toBe('X');
  });

  it('returns an item from the pool', () => {
    const result = pickNextItem(store, ['A', 'B', 'C']);
    expect(['A', 'B', 'C']).toContain(result);
  });

  it('distributes items with equal weights roughly uniformly', () => {
    const counts = { A: 0, B: 0 };
    for (let i = 0; i < 2000; i++) {
      counts[pickNextItem(store, ['A', 'B'])]++;
    }
    expect(counts.A).toBeGreaterThan(700);
    expect(counts.B).toBeGreaterThan(700);
  });

  it('picks heavier item more often', () => {
    store.weights['A'] = 4.0;
    store.weights['B'] = 1.0;
    const counts = { A: 0, B: 0 };
    for (let i = 0; i < 2000; i++) {
      counts[pickNextItem(store, ['A', 'B'])]++;
    }
    // A should get ~80% of picks (4/(4+1))
    expect(counts.A).toBeGreaterThan(counts.B * 2);
  });

  it('uses default weight for unknown items', () => {
    // items not in store.weights should still be pickable
    const result = pickNextItem(store, ['unknown-key']);
    expect(result).toBe('unknown-key');
  });
});

describe('recordResult', () => {
  let storage;
  let store;

  beforeEach(() => {
    storage = makeStorage();
    store = createSrsStore('test', { storage });
  });

  it('correct fast answer reduces weight', () => {
    store.weights['A'] = 2.0;
    recordResult(store, 'A', { correct: true, responseTimeMs: SRS_FAST_THRESHOLD_MS - 1 });
    expect(store.weights['A']).toBeCloseTo(2.0 * SRS_WEIGHT_ON_CORRECT_FAST);
  });

  it('correct slow answer reduces weight less', () => {
    store.weights['A'] = 2.0;
    recordResult(store, 'A', { correct: true, responseTimeMs: SRS_FAST_THRESHOLD_MS + 1 });
    expect(store.weights['A']).toBeCloseTo(2.0 * SRS_WEIGHT_ON_CORRECT_SLOW);
  });

  it('wrong answer increases weight', () => {
    store.weights['A'] = 2.0;
    recordResult(store, 'A', { correct: false });
    expect(store.weights['A']).toBeCloseTo(2.0 * SRS_WEIGHT_ON_WRONG);
  });

  it('weight never drops below SRS_WEIGHT_MIN', () => {
    store.weights['A'] = SRS_WEIGHT_MIN;
    recordResult(store, 'A', { correct: true, responseTimeMs: 0 });
    expect(store.weights['A']).toBeGreaterThanOrEqual(SRS_WEIGHT_MIN);
  });

  it('weight never exceeds SRS_WEIGHT_MAX', () => {
    store.weights['A'] = SRS_WEIGHT_MAX;
    recordResult(store, 'A', { correct: false });
    expect(store.weights['A']).toBe(SRS_WEIGHT_MAX);
  });

  it('initialises unknown item at SRS_WEIGHT_MIN before applying factor', () => {
    recordResult(store, 'new', { correct: false });
    expect(store.weights['new']).toBeCloseTo(SRS_WEIGHT_MIN * SRS_WEIGHT_ON_WRONG);
  });

  it('persists weights to storage on record', () => {
    recordResult(store, 'A', { correct: false });
    const raw = JSON.parse(storage._raw['gt_srs_test']);
    expect(raw['A']).toBeCloseTo(SRS_WEIGHT_MIN * SRS_WEIGHT_ON_WRONG);
  });

  it('correct answer without responseTimeMs counts as slow', () => {
    store.weights['A'] = 2.0;
    recordResult(store, 'A', { correct: true });
    expect(store.weights['A']).toBeCloseTo(2.0 * SRS_WEIGHT_ON_CORRECT_SLOW);
  });
});

describe('getWeights', () => {
  it('returns a copy of weights, not the internal reference', () => {
    const storage = makeStorage();
    const store = createSrsStore('test', { storage });
    store.weights['A'] = 2.0;
    const w = getWeights(store);
    w['A'] = 99;
    expect(store.weights['A']).toBe(2.0);
  });
});
