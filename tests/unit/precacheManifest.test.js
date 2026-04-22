import { describe, expect, it } from 'vitest';
import {
  PRECACHE_URLS,
  buildPrecacheManifest,
} from '../../js/shared/pwa/precacheManifest.js';

describe('precacheManifest', () => {
  it('builds a sorted and unique manifest', () => {
    const manifest = buildPrecacheManifest({
      coreUrls: ['b.js', 'a.js', 'a.js'],
      pageUrls: ['pages/z/index.html', 'pages/a/index.html'],
      extraUrls: ['manifest.json'],
    });

    expect(manifest).toEqual([
      'a.js',
      'b.js',
      'index.html',
      'manifest.json',
      'pages/a/index.html',
      'pages/z/index.html',
    ]);
  });

  it('supports exclusions via string and regex', () => {
    const manifest = buildPrecacheManifest({
      coreUrls: ['keep.js', 'drop.js'],
      pageUrls: ['pages/a/index.html'],
      exclude: ['drop.js', /^pages\//],
    });

    expect(manifest).toEqual(['index.html', 'keep.js', 'manifest.json']);
  });

  it('includes required entries in the default manifest', () => {
    expect(PRECACHE_URLS).toContain('index.html');
    expect(PRECACHE_URLS).toContain('manifest.json');
    expect(PRECACHE_URLS).toContain('pages/metronome/index.html');
    expect(PRECACHE_URLS).toContain('js/lib/essentia/essentia-wasm.web.wasm');
  });
});
