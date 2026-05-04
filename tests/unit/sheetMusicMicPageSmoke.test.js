// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

describe('Sheet music mic page smoke', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('declares a local bootstrap and redirects to sheet music reading active mode', async () => {
    const html = readFileSync(path.join(repoRoot, 'pages', 'sheet-music-mic', 'index.html'), 'utf8');
    const bootstrap = readFileSync(path.join(repoRoot, 'pages', 'sheet-music-mic', 'bootstrap.js'), 'utf8');

    document.documentElement.innerHTML = html;

    const moduleScript = document.querySelector('script[type="module"]');
    expect(moduleScript?.getAttribute('src')).toBe('./bootstrap.js');
    expect(html).toContain('weitergeleitet');
    expect(bootstrap).toContain('window.location.replace');
    expect(bootstrap).toContain('../sheet-music-reading/index.html?active=1');
  });
});
