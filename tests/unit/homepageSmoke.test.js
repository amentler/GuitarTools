// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

describe('Homepage smoke', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('loads the homepage shell and links the migrated exercise page', async () => {
    const html = readFileSync(path.join(repoRoot, 'index.html'), 'utf8');

    document.documentElement.innerHTML = html;

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue('Version test'),
    });
    vi.stubGlobal('fetch', fetchMock);

    await import('../../js/components/index.js');
    await import('../../js/app.js');

    expect(document.getElementById('view-menu')?.classList.contains('active')).toBe(true);
    expect(document.getElementById('app-version')?.textContent).toBe('Version test');

    const hrefByTitle = Object.fromEntries(
      Array.from(document.querySelectorAll('gt-menu-card')).map((card) => [
        card.getAttribute('title'),
        card.getAttribute('href'),
      ]),
    );

    expect(hrefByTitle).toMatchObject({
      'Griffbrett': 'pages/fretboard-tone-recognition/index.html',
      'Noten lesen': 'pages/sheet-music-reading/index.html',
      'Akkord-Trainer': 'pages/akkord-trainer/index.html',
      'Ton-Finder': 'pages/ton-finder/index.html',
      'Ton spielen': 'pages/note-playing/index.html',
      'Noten spielen': 'pages/sheet-music-mic/index.html',
      'Akkord spielen': 'pages/chord-playing-essentia/index.html',
      'Akkorde spielen': 'pages/akkordfolgen-trainer/index.html',
      'Tuner': 'pages/guitar-tuner/index.html',
      'Metronom': 'pages/metronome/index.html',
      'Akkord Übersicht': 'pages/akkord-uebersicht/index.html',
    });
  });
});
