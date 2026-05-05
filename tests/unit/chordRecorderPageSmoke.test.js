// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const mountSpy = vi.fn();
const registerServiceWorkerSpy = vi.fn();

vi.mock('../../js/shared/pwa/sw-client.js', () => ({
  registerServiceWorker: registerServiceWorkerSpy,
}));

vi.mock('../../js/components/index.js', () => ({}));
vi.mock('../../js/tools/chordRecorder/chordRecorder.js', () => ({
  createChordRecorderTool: () => ({
    mount: mountSpy,
  }),
}));

describe('Chord recorder page smoke', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    mountSpy.mockReset();
    registerServiceWorkerSpy.mockReset();
  });

  it('declares a local bootstrap and mounts the chord recorder tool', async () => {
    const html = readFileSync(path.join(repoRoot, 'pages', 'chord-recorder', 'index.html'), 'utf8');

    document.documentElement.innerHTML = html;

    const moduleScript = document.querySelector('script[type="module"]');
    expect(moduleScript?.getAttribute('src')).toBe('./bootstrap.js');
    expect(html).not.toContain('createChordRecorderTool');

    await import('../../pages/chord-recorder/bootstrap.js');

    expect(registerServiceWorkerSpy).toHaveBeenCalledTimes(1);
    expect(mountSpy).toHaveBeenCalledTimes(1);
    expect(mountSpy).toHaveBeenCalledWith(document.getElementById('chord-recorder-root'));
  });
});
