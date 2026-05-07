/**
 * Importiert Chord-Recorder-ZIPs aus tests/fixtures/drop/ in tests/fixtures/chords/.
 *
 * Jede ZIP enthält {name}.wav + {name}.json Paare.
 * Das JSON-Feld "chord" bestimmt den Zielordner (z. B. "G-Dur" → chords/G-Dur/).
 *
 * Aufruf: node scripts/import-drop-fixtures.mjs
 */

import { promises as fs } from 'fs';
import { execFileSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const DROP_DIR = path.join(REPO_ROOT, 'tests/fixtures/drop');
const CHORDS_DIR = path.join(REPO_ROOT, 'tests/fixtures/chords');

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

/** Gibt einen freien Dateipfad zurück; bei Kollision: stem_2.wav, stem_3.wav … */
async function freeFilePath(dir, fileName) {
  const ext = path.extname(fileName);
  const stem = path.basename(fileName, ext);
  let candidate = path.join(dir, fileName);
  let n = 2;
  while (true) {
    try {
      await fs.access(candidate);
      candidate = path.join(dir, `${stem}_${n}${ext}`);
      n++;
    } catch {
      return candidate;
    }
  }
}

function extractZip(zipPath, outDir) {
  const script = `import zipfile,sys; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])`;
  try {
    execFileSync('python3', ['-c', script, zipPath, outDir], { stdio: 'pipe' });
    return;
  } catch {}
  try {
    execFileSync('unzip', ['-o', zipPath, '-d', outDir], { stdio: 'pipe' });
  } catch {
    throw new Error('Kein ZIP-Entpacker: python3 oder unzip wird benötigt.');
  }
}

async function processZip(zipPath) {
  console.log(`\n${path.basename(zipPath)}`);

  const tmpDir = `${zipPath}.tmp`;
  await ensureDir(tmpDir);

  try {
    extractZip(zipPath, tmpDir);

    const entries = await fs.readdir(tmpDir);
    const jsonFiles = entries.filter(f => f.toLowerCase().endsWith('.json'));

    if (jsonFiles.length === 0) {
      throw new Error('Keine JSON-Sidecar-Dateien gefunden.');
    }

    let imported = 0;
    let skipped = 0;

    for (const jsonFile of jsonFiles.sort()) {
      const stem = jsonFile.slice(0, -5); // strip .json
      const wavFile = `${stem}.wav`;

      if (!entries.includes(wavFile)) {
        console.warn(`  ! ${jsonFile}: kein passendes WAV gefunden, übersprungen.`);
        skipped++;
        continue;
      }

      const sidecar = JSON.parse(await fs.readFile(path.join(tmpDir, jsonFile), 'utf8'));
      const chordName = sidecar.chord;
      if (!chordName) {
        console.warn(`  ! ${jsonFile}: kein "chord"-Feld, übersprungen.`);
        skipped++;
        continue;
      }

      const qualityHint = sidecar.quality?.passed === false
        ? ` ⚠ quality.passed=false (${(sidecar.quality.failReasons ?? []).join(', ')})`
        : '';

      const destDir = path.join(CHORDS_DIR, chordName);
      await ensureDir(destDir);

      const dest = await freeFilePath(destDir, wavFile);
      await fs.rename(path.join(tmpDir, wavFile), dest);
      console.log(`  → ${path.relative(REPO_ROOT, dest)}${qualityHint}`);
      imported++;
    }

    await fs.rm(zipPath);
    console.log(`  ZIP gelöscht. (${imported} importiert, ${skipped} übersprungen)`);
    return imported;
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}

async function main() {
  const entries = await fs.readdir(DROP_DIR);
  const zips = entries.filter(f => f.toLowerCase().endsWith('.zip')).sort();

  if (zips.length === 0) {
    console.log('Keine ZIP-Dateien in tests/fixtures/drop/ gefunden.');
    return;
  }

  let totalImported = 0;
  let failed = 0;

  for (const zip of zips) {
    try {
      totalImported += await processZip(path.join(DROP_DIR, zip));
    } catch (err) {
      console.error(`  FEHLER: ${err.message}`);
      failed++;
    }
  }

  console.log(`\nFertig: ${totalImported} WAVs importiert, ${failed} ZIPs fehlgeschlagen.`);

  execFileSync('node', [new URL('./generate-chord-inventory.mjs', import.meta.url).pathname],
    { stdio: 'inherit' });

  if (totalImported > 0) {
    console.log('\nNächste Schritte:');
    console.log('  node scripts/introduce-chord-fixture.mjs');
    console.log('  npm test');
  }
}

await main();
