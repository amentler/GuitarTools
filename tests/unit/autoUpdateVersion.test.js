import { describe, expect, it } from 'vitest';
import {
  bumpVersion,
  normalizeVersionCounter,
} from '../../scripts/autoUpdateVersionCore.mjs';

describe('auto-update-version.sh helpers', () => {
  it('keeps 0.x versions in the public format when bumping', () => {
    expect(bumpVersion('0.9')).toBe('0.10');
    expect(bumpVersion('0.10')).toBe('0.11');
    expect(bumpVersion('0.999')).toBe('0.1000');
  });

  it('maps previously broken 1.x/2.x versions back into the 0.x counter space', () => {
    expect(normalizeVersionCounter('1.0')).toBe('10');
    expect(normalizeVersionCounter('2.3')).toBe('23');
    expect(bumpVersion('2.3')).toBe('0.24');
  });
});
