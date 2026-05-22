#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildZip, readZip } from '../js/shared/zip.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_ROOT = 'tests/fixtures/sequences/sheet-music-reading';
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const targetRoot = args.find(arg => !arg.startsWith('--')) ?? DEFAULT_ROOT;
const UPDATED_AT = new Date().toISOString();

function repoPath(relativePath) {
  return path.join(REPO_ROOT, relativePath);
}

function toPosix(relativePath) {
  return relativePath.split(path.sep).join('/');
}

function walkTaggedZips(relativeDir, results = []) {
  const absoluteDir = repoPath(relativeDir);
  if (!existsSync(absoluteDir)) return results;
  for (const entry of readdirSync(absoluteDir, { withFileTypes: true })) {
    const child = path.join(relativeDir, entry.name);
    if (entry.isDirectory()) {
      walkTaggedZips(child, results);
    } else if (entry.name.endsWith('-tagged.zip')) {
      results.push(child);
    }
  }
  return results;
}

function baseNameForZip(zipPath) {
  return path.basename(zipPath).replace(/-tagged\.zip$/i, '');
}

function normalizeSidecar(sidecar, baseName) {
  const next = { ...sidecar };
  next.id ||= baseName;
  next.baseName ||= baseName;
  next.recordedAt ||= UPDATED_AT;
  next.updatedAt = UPDATED_AT;
  return next;
}

function rewriteZip(relativeZipPath) {
  const absoluteZipPath = repoPath(relativeZipPath);
  const stat = statSync(absoluteZipPath);
  const zipData = new Uint8Array(readFileSync(absoluteZipPath));
  const entries = readZip(zipData);
  const jsonIndex = entries.findIndex(entry => entry.name.toLowerCase().endsWith('.json'));
  if (jsonIndex === -1) {
    return { relativeZipPath, changed: false, reason: 'missing-json-sidecar' };
  }

  const baseName = baseNameForZip(relativeZipPath);
  const jsonEntry = entries[jsonIndex];
  const sidecar = JSON.parse(new TextDecoder().decode(jsonEntry.data));
  const nextSidecar = normalizeSidecar(sidecar, baseName);
  const jsonData = new TextEncoder().encode(`${JSON.stringify(nextSidecar, null, 2)}\n`);
  const changed = new TextDecoder().decode(jsonEntry.data) !== new TextDecoder().decode(jsonData);

  if (!changed || dryRun) {
    return { relativeZipPath, changed, reason: changed ? 'dry-run' : 'already-normalized' };
  }

  const nextEntries = entries.map((entry, index) => (
    index === jsonIndex ? { name: entry.name, data: jsonData } : entry
  ));
  writeFileSync(absoluteZipPath, buildZip(nextEntries));
  utimesSync(absoluteZipPath, stat.atime, stat.mtime);
  return { relativeZipPath, changed: true, reason: 'updated' };
}

const zipPaths = walkTaggedZips(targetRoot).sort((a, b) => toPosix(a).localeCompare(toPosix(b), 'de-DE'));
const results = zipPaths.map(rewriteZip);
const changed = results.filter(result => result.changed);
const skipped = results.filter(result => !result.changed);

for (const result of results) {
  const marker = result.changed ? (dryRun ? 'would update' : 'updated') : 'skipped';
  console.log(`${marker}: ${toPosix(result.relativeZipPath)} (${result.reason})`);
}

console.log(`Normalized ${changed.length}/${results.length} tagged ZIP sidecars${dryRun ? ' (dry-run)' : ''}.`);
if (skipped.some(result => result.reason === 'missing-json-sidecar')) {
  process.exitCode = 1;
}
