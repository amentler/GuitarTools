/**
 * Erzeugt tests/fixtures/chord-inventory.json aus allen Sidecar-JSONs in tests/fixtures/chords/.
 * Nur Dateien mit Sidecar-JSON werden erfasst — Legacy-WAVs ohne JSON werden ignoriert.
 *
 * Aufruf: node scripts/generate-chord-inventory.mjs
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildInventoryEntry } from '../js/tools/chordRecorder/chordInventoryLogic.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const CHORDS_DIR = path.join(REPO_ROOT, 'tests/fixtures/chords');
const OUT_FILE   = path.join(REPO_ROOT, 'tests/fixtures/chord-inventory.json');

async function collectSidecars(chordsDir) {
  const entries = [];
  const chordFolders = await fs.readdir(chordsDir);
  for (const folder of chordFolders) {
    const folderPath = path.join(chordsDir, folder);
    const stat = await fs.stat(folderPath);
    if (!stat.isDirectory()) continue;
    const files = await fs.readdir(folderPath);
    for (const file of files) {
      if (!file.toLowerCase().endsWith('.json')) continue;
      try {
        const raw = await fs.readFile(path.join(folderPath, file), 'utf8');
        const sidecar = JSON.parse(raw);
        if (sidecar.chordKey && sidecar.technique && sidecar.strumMode) {
          entries.push(buildInventoryEntry(sidecar));
        }
      } catch {
        // Malformed JSON — skip silently
      }
    }
  }
  return entries;
}

const recordings = await collectSidecars(CHORDS_DIR);
const inventory = {
  generatedAt: new Date().toISOString(),
  recordings,
};

await fs.writeFile(OUT_FILE, JSON.stringify(inventory, null, 2) + '\n', 'utf8');
console.log(`chord-inventory.json: ${recordings.length} Aufnahmen erfasst.`);
