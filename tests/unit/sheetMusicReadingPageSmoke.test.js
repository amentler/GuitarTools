// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const mountSpy = vi.fn();

vi.mock('../../js/components/index.js', () => ({}));
vi.mock('../../js/games/sheetMusicReading/sheetMusicReading.js', () => ({
  createSheetMusicFeature: () => ({
    mount: mountSpy,
    unmount: vi.fn(),
  }),
}));

describe('Sheet music reading page smoke', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    mountSpy.mockReset();
  });

  it('declares a local bootstrap and mounts the sheet music feature', async () => {
    const html = readFileSync(path.join(repoRoot, 'pages', 'sheet-music-reading', 'index.html'), 'utf8');

    document.documentElement.innerHTML = html;

    const moduleScript = document.querySelector('script[type="module"]');
    expect(moduleScript?.getAttribute('src')).toBe('./bootstrap.js');
    expect(html).not.toContain('createSheetMusicFeature');

    await import('../../pages/sheet-music-reading/bootstrap.js');

    expect(mountSpy).toHaveBeenCalledTimes(1);
    expect(mountSpy).toHaveBeenCalledWith(document.getElementById('view-sheet-music'));
  });
});
