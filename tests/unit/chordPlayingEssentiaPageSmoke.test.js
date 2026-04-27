// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const mountSpy = vi.fn();

vi.mock('../../js/components/index.js', () => ({}));
vi.mock('../../js/games/chordExerciseEssentia/chordExerciseEssentia.js', () => ({
  createChordExerciseEssentiaFeature: () => ({
    mount: mountSpy,
    unmount: vi.fn(),
  }),
}));

describe('Chord playing essentia page smoke', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    mountSpy.mockReset();
  });

  it('declares a local bootstrap and mounts the chord playing feature', async () => {
    const html = readFileSync(path.join(repoRoot, 'pages', 'chord-playing-essentia', 'index.html'), 'utf8');

    document.documentElement.innerHTML = html;

    const moduleScript = document.querySelector('script[type="module"]');
    expect(moduleScript?.getAttribute('src')).toBe('./bootstrap.js');
    expect(html).not.toContain('createChordExerciseEssentiaFeature');

    await import('../../pages/chord-playing-essentia/bootstrap.js');

    expect(mountSpy).toHaveBeenCalledTimes(1);
    expect(mountSpy).toHaveBeenCalledWith(document.getElementById('view-chord-exercise-essentia'));
  });
});
