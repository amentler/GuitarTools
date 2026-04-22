// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const mountSpy = vi.fn();

vi.mock('../../js/components/index.js', () => ({}));
vi.mock('../../js/games/sheetMusicMic/sheetMusicMicExercise.js', () => ({
  createSheetMusicMicFeature: () => ({
    mount: mountSpy,
    unmount: vi.fn(),
  }),
}));

describe('Sheet music mic page smoke', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    mountSpy.mockReset();
  });

  it('declares a local bootstrap and mounts the sheet music mic feature', async () => {
    const html = readFileSync(path.join(repoRoot, 'pages', 'sheet-music-mic', 'index.html'), 'utf8');

    document.documentElement.innerHTML = html;

    const moduleScript = document.querySelector('script[type="module"]');
    expect(moduleScript?.getAttribute('src')).toBe('./bootstrap.js');
    expect(html).not.toContain('createSheetMusicMicFeature');

    await import('../../pages/sheet-music-mic/bootstrap.js');

    expect(mountSpy).toHaveBeenCalledTimes(1);
    expect(mountSpy).toHaveBeenCalledWith(document.getElementById('view-sheet-mic'));
  });
});
