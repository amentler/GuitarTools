import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { describe, expect, it } from 'vitest';
import { loadSheetMusicOnsetConfigFromArgs } from '../../scripts/sheetMusicOnsetConfig.mjs';

describe('sheetMusicOnsetConfig', () => {
  it('returns empty options when no onset config is provided', () => {
    expect(loadSheetMusicOnsetConfigFromArgs([])).toEqual({
      configPath: null,
      options: {},
    });
  });

  it('maps analysis and detector JSON settings into fingerprint options', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gt-onset-config-'));
    const configPath = join(dir, 'onset.json');
    writeFileSync(configPath, JSON.stringify({
      onsetFrameSize: 2048,
      analyzeIntervalMs: 25,
      minFlux: 0.011,
      onsetDetectorOptions: {
        cooldownFrames: 2,
      },
    }));

    try {
      const result = loadSheetMusicOnsetConfigFromArgs(['--onset-config', configPath]);
      expect(result.configPath).toBe(configPath);
      expect(result.options).toEqual({
        onsetFrameSize: 2048,
        analyzeIntervalMs: 25,
        onsetDetectorOptions: {
          cooldownFrames: 2,
          minFlux: 0.011,
        },
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
