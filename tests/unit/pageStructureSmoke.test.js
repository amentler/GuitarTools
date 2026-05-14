import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const pagesRoot = path.join(repoRoot, 'pages');

describe('Page structure smoke', () => {
  it('stores every page in its own directory with a local bootstrap', () => {
    const pageDirs = readdirSync(pagesRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();

    expect(pageDirs).toEqual([
      'akkord-trainer',
      'akkord-uebersicht',
      'akkordfolgen-trainer',
      'audio-analyse',
      'chord-playing-essentia',
      'chord-recorder',
      'fretboard-tone-recognition',
      'guitar-tuner',
      'metronome',
      'note-playing',
      'onset-tagger',
      'recordings',
      'sheet-music-reading',
      'ton-finder',
    ]);

    for (const pageDir of pageDirs) {
      const html = readFileSync(path.join(pagesRoot, pageDir, 'index.html'), 'utf8');
      const bootstrap = readFileSync(path.join(pagesRoot, pageDir, 'bootstrap.js'), 'utf8');

      expect(html).toContain('<script type="module" src="./bootstrap.js"></script>');
      expect(html).not.toContain('<script type="module">');
      expect(bootstrap).toContain("import '../../js/components/index.js';");
      expect(bootstrap).toContain('.mount(root)');
    }
  });

  it('wires the recordings page actions', () => {
    const html = readFileSync(path.join(pagesRoot, 'recordings', 'index.html'), 'utf8');

    expect(html).toContain('id="btn-open-analyse"');
    expect(html).toContain('id="btn-open-tagger"');
    expect(html).toContain('id="btn-delete-selected"');
    expect(html).toContain('id="btn-download-selected"');
    expect(html).toContain('id="btn-dl-all"');
    expect(html).toContain('id="btn-del-all"');
  });
});
