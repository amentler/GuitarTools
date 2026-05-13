#!/usr/bin/env node
/**
 * import-onset-zip.mjs
 *
 * Extracts a tagged onset ZIP (WAV + JSON sidecar) and places the files
 * in the correct tests/fixtures/ subdirectory based on the sidecar content.
 *
 * Usage:
 *   node scripts/import-onset-zip.mjs <path-to-zip> [--force] [--dry-run]
 *
 * Routing logic:
 *   - sidecar has "chord"    → tests/fixtures/chords/{chord}/
 *   - sidecar has "category" → tests/fixtures/sequences/{category}/
 *   - otherwise              → tests/fixtures/tagged/
 */

import fs    from 'node:fs/promises';
import path  from 'node:path';
import { createReadStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';

const args  = process.argv.slice(2);
const force  = args.includes('--force');
const dryRun = args.includes('--dry-run');
const zipPath = args.find(a => !a.startsWith('--'));

if (!zipPath) {
  console.error('Usage: node scripts/import-onset-zip.mjs <zip-file> [--force] [--dry-run]');
  process.exit(1);
}

const REPO_ROOT    = new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const FIXTURES_DIR = path.join(REPO_ROOT, 'tests', 'fixtures');

// ── Minimal ZIP reader ───────────────────────────────────────────────────────

/**
 * Reads all files from an uncompressed (Store) ZIP archive.
 * Returns an array of { name: string, data: Buffer }.
 *
 * @param {Buffer} buf
 * @returns {{ name: string, data: Buffer }[]}
 */
function readZip(buf) {
  const files = [];
  let pos = 0;

  while (pos + 4 <= buf.length) {
    const sig = buf.readUInt32LE(pos);
    if (sig !== 0x04034B50) break; // not a local file header

    const compression   = buf.readUInt16LE(pos + 8);
    const compressedSz  = buf.readUInt32LE(pos + 18);
    const nameLen       = buf.readUInt16LE(pos + 26);
    const extraLen      = buf.readUInt16LE(pos + 28);
    const name          = buf.subarray(pos + 30, pos + 30 + nameLen).toString('utf8');
    const dataStart     = pos + 30 + nameLen + extraLen;

    if (compression !== 0) {
      throw new Error(`File "${name}" uses compression (method ${compression}); only Store (0) is supported.`);
    }

    files.push({ name, data: buf.subarray(dataStart, dataStart + compressedSz) });
    pos = dataStart + compressedSz;
  }

  return files;
}

// ── Determine target directory ────────────────────────────────────────────────

function resolveTargetDir(sidecar) {
  if (sidecar.chord) {
    return path.join(FIXTURES_DIR, 'chords', String(sidecar.chord));
  }
  if (sidecar.category) {
    return path.join(FIXTURES_DIR, 'sequences', String(sidecar.category));
  }
  return path.join(FIXTURES_DIR, 'tagged');
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const zipBuf = await fs.readFile(zipPath);
  const files  = readZip(zipBuf);

  if (files.length === 0) {
    console.error('ZIP appears empty or is in an unsupported format.');
    process.exit(1);
  }

  // Find WAV and JSON
  const wavFile  = files.find(f => f.name.toLowerCase().endsWith('.wav'));
  const jsonFile = files.find(f => f.name.toLowerCase().endsWith('.json'));

  if (!wavFile)  { console.error('No .wav file found in ZIP.'); process.exit(1); }
  if (!jsonFile) { console.error('No .json file found in ZIP.'); process.exit(1); }

  let sidecar;
  try {
    sidecar = JSON.parse(jsonFile.data.toString('utf8'));
  } catch (err) {
    console.error(`Failed to parse JSON sidecar: ${err.message}`);
    process.exit(1);
  }

  const targetDir = resolveTargetDir(sidecar);
  const wavDest   = path.join(targetDir, path.basename(wavFile.name));
  const jsonDest  = path.join(targetDir, path.basename(jsonFile.name));

  console.log(`Target directory: ${targetDir}`);
  console.log(`  WAV  → ${wavDest}`);
  console.log(`  JSON → ${jsonDest}`);

  // Check for existing files
  for (const dest of [wavDest, jsonDest]) {
    let exists = false;
    try { await fs.access(dest); exists = true; } catch (_) { /* ok */ }
    if (exists && !force) {
      console.error(`File already exists: ${dest}\nUse --force to overwrite.`);
      process.exit(1);
    }
  }

  if (dryRun) {
    console.log('[dry-run] No files written.');
    return;
  }

  await fs.mkdir(targetDir, { recursive: true });
  await fs.writeFile(wavDest,  wavFile.data);
  await fs.writeFile(jsonDest, jsonFile.data);

  console.log('Done.');
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
