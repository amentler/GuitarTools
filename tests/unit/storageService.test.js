import { describe, expect, it, vi } from 'vitest';
import { createStorageService } from '../../js/shared/storage/storageService.js';

function createMockStorage(initialValues = {}) {
  const store = new Map(Object.entries(initialValues));

  return {
    getItem: vi.fn(key => store.get(key) ?? null),
    setItem: vi.fn((key, value) => {
      store.set(key, String(value));
    }),
    removeItem: vi.fn(key => {
      store.delete(key);
    }),
  };
}

describe('storageService', () => {
  it('reads and writes with a key prefix', () => {
    const storage = createMockStorage();
    const service = createStorageService({ storage, prefix: 'app:' });

    service.set('theme', 'dark');

    expect(storage.setItem).toHaveBeenCalledWith('app:theme', 'dark');
    expect(service.getString('theme', { defaultValue: 'light' })).toBe('dark');
  });

  it('falls back to default numbers for invalid values', () => {
    const storage = createMockStorage({ bpm: 'nope' });
    const service = createStorageService({ storage });

    expect(service.getNumber('bpm', {
      defaultValue: 80,
      parse: value => parseInt(value, 10),
    })).toBe(80);
  });

  it('parses boolean values and falls back for unknown strings', () => {
    const storage = createMockStorage({
      active: 'true',
      disabled: 'false',
      mystery: 'maybe',
    });
    const service = createStorageService({ storage });

    expect(service.getBoolean('active')).toBe(true);
    expect(service.getBoolean('disabled', { defaultValue: true })).toBe(false);
    expect(service.getBoolean('mystery', { defaultValue: true })).toBe(true);
  });

  it('returns default JSON when parsing fails', () => {
    const storage = createMockStorage({ prefs: '{broken' });
    const service = createStorageService({ storage });

    expect(service.getJson('prefs', { defaultValue: { bpm: 80 } })).toEqual({ bpm: 80 });
  });
});
