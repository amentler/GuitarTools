#!/usr/bin/env python3
import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path


CATEGORY_RE = re.compile(r"^[a-z0-9][a-z0-9-]*$")
NOTE_RE = re.compile(r"^[A-G](?:#|b)?[0-8]$")
POSITIVE_LIST_RE = re.compile(
    r"export const SHEET_FINGERPRINT_POSITIVE_FIXTURE_FILES = \[(.*?)\];",
    re.DOTALL,
)


def fail(message):
    print(f"error: {message}", file=sys.stderr)
    return 1


def repo_root_from_cwd():
    cwd = Path.cwd()
    if (cwd / "package.json").exists() and (cwd / "tests/fixtures").exists():
        return cwd
    return cwd


def default_drop_dir(repo_root):
    preferred = repo_root / "tests/fixtures/dropsequence"
    alternate = repo_root / "tests/fixtures/sequencedrop"
    if preferred.exists():
        return preferred
    return alternate


def load_manifest(path):
    try:
        manifest = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise ValueError(f"{path}: invalid JSON: {exc}") from exc

    category = manifest.get("category", "open-strings")
    if not isinstance(category, str) or not CATEGORY_RE.match(category):
        raise ValueError(f"{path}: category must be lowercase letters, digits, and hyphens")

    notes = manifest.get("notes")
    if not isinstance(notes, list) or not notes:
        raise ValueError(f"{path}: notes must be a non-empty array")

    if "tempoBpm" not in manifest and "bpm" in manifest:
        manifest["tempoBpm"] = manifest["bpm"]

    invalid_notes = [note for note in notes if not isinstance(note, str) or not NOTE_RE.match(note)]
    if invalid_notes:
        raise ValueError(f"{path}: invalid notes: {', '.join(map(str, invalid_notes))}")

    return manifest, category


def validate_wav(path):
    with path.open("rb") as handle:
        header = handle.read(12)
    if len(header) != 12 or header[:4] != b"RIFF" or header[8:12] != b"WAVE":
        raise ValueError(f"{path}: not a RIFF/WAVE file")


def sanitize_stem(stem):
    sanitized = re.sub(r"[^A-Za-z0-9_-]+", "_", stem).strip("._-")
    return sanitized or "sequence"


def same_bytes(left, right):
    return left.exists() and left.read_bytes() == right.read_bytes()


def choose_destination(target_dir, stem, wav_path, json_path):
    stem = sanitize_stem(stem)
    for index in range(1, 10_000):
        candidate = stem if index == 1 else f"{stem}_{index}"
        dest_wav = target_dir / f"{candidate}.wav"
        dest_json = target_dir / f"{candidate}.json"
        if same_bytes(dest_wav, wav_path) and same_bytes(dest_json, json_path):
            return dest_wav, dest_json, True
        if not dest_wav.exists() and not dest_json.exists():
            return dest_wav, dest_json, False
    raise RuntimeError(f"could not choose a free fixture name in {target_dir}")


def collect_pairs_in_dir(root):
    pairs = []
    json_by_stem = {}
    wav_by_stem = {}
    for path in sorted(root.rglob("*")):
        if path.is_file() and path.suffix.lower() == ".json":
            json_by_stem[path.with_suffix("").as_posix().lower()] = path
        elif path.is_file() and path.suffix.lower() == ".wav":
            wav_by_stem[path.with_suffix("").as_posix().lower()] = path

    for key, json_path in json_by_stem.items():
        wav_path = wav_by_stem.get(key)
        if wav_path is not None:
            pairs.append((wav_path, json_path))
    return pairs


def collect_sources(drop_dir, temp_root):
    extracted_dirs = []
    pairs = collect_pairs_in_dir(drop_dir)

    for zip_path in sorted(drop_dir.rglob("*.zip")):
        extract_dir = temp_root / zip_path.with_suffix("").name
        extract_dir.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(zip_path) as archive:
            archive.extractall(extract_dir)
        extracted_dirs.append(extract_dir)
        pairs.extend(collect_pairs_in_dir(extract_dir))

    unique = []
    seen = set()
    for wav_path, json_path in pairs:
        key = (wav_path.resolve(), json_path.resolve())
        if key not in seen:
            seen.add(key)
            unique.append((wav_path, json_path))
    return unique, extracted_dirs


def import_pairs(repo_root, pairs, dry_run):
    sequences_dir = repo_root / "tests/fixtures/sequences"
    imported = []
    skipped = []

    for wav_path, json_path in pairs:
        manifest, category = load_manifest(json_path)
        validate_wav(wav_path)

        target_dir = sequences_dir / category
        dest_wav, dest_json, duplicate = choose_destination(target_dir, wav_path.stem, wav_path, json_path)
        rel_wav = dest_wav.relative_to(sequences_dir).as_posix()
        if duplicate:
            skipped.append(rel_wav)
            continue

        print(f"import: {wav_path} -> {dest_wav}")
        if not dry_run:
            target_dir.mkdir(parents=True, exist_ok=True)
            shutil.copy2(wav_path, dest_wav)
            dest_json.write_text(
                json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
        imported.append(rel_wav)

    return imported, skipped


def evaluate_imported(repo_root, imported):
    if not imported:
        return []

    node_code = """
import {
  discoverSheetMusicSequenceFixtures,
  evaluateSheetMusicSequenceFingerprint,
} from './tests/helpers/sheetMusicSequenceFingerprint.js';

const wanted = new Set(JSON.parse(process.argv[1]));
const fixtures = discoverSheetMusicSequenceFixtures().filter(fixture => wanted.has(fixture.file));
const report = evaluateSheetMusicSequenceFingerprint(fixtures);
console.log(JSON.stringify(report.cases.map(row => ({
  file: row.fixture.file,
  passed: row.passed,
  acceptedCount: row.acceptedCount,
  expectedCount: row.expectedCount,
  reason: row.reason,
})), null, 2));
"""
    result = subprocess.run(
        ["node", "--input-type=module", "-e", node_code, json.dumps(imported)],
        cwd=repo_root,
        text=True,
        capture_output=True,
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or result.stdout.strip())
    return json.loads(result.stdout)


def update_positive_list(repo_root, passing_files, dry_run):
    if not passing_files:
        return []

    helper_path = repo_root / "tests/helpers/sheetMusicSequenceFingerprint.js"
    source = helper_path.read_text(encoding="utf-8")
    match = POSITIVE_LIST_RE.search(source)
    if not match:
        raise RuntimeError(f"could not find positive fixture list in {helper_path}")

    existing = re.findall(r"'([^']+)'", match.group(1))
    merged = sorted(set(existing).union(passing_files))
    added = [path for path in merged if path not in existing]
    if not added:
        return []

    replacement = "export const SHEET_FINGERPRINT_POSITIVE_FIXTURE_FILES = [\n"
    replacement += "".join(f"  '{path}',\n" for path in merged)
    replacement += "];"

    if not dry_run:
        helper_path.write_text(POSITIVE_LIST_RE.sub(replacement, source), encoding="utf-8")
    return added


def run_sheetfingerprint(repo_root):
    return subprocess.run(
        ["npm", "run", "sheetfingerprint"],
        cwd=repo_root,
        text=True,
        check=False,
    ).returncode


def main():
    parser = argparse.ArgumentParser(description="Import sheet-music sequence fixtures.")
    parser.add_argument("--drop-dir", type=Path, help="Drop folder containing ZIPs or WAV/JSON pairs.")
    parser.add_argument("--dry-run", action="store_true", help="Validate and report without writing files.")
    parser.add_argument(
        "--no-promote",
        action="store_true",
        help="Do not add passing imported fixtures to SHEET_FINGERPRINT_POSITIVE_FIXTURE_FILES.",
    )
    parser.add_argument(
        "--skip-sheetfingerprint",
        action="store_true",
        help="Skip the final npm run sheetfingerprint report.",
    )
    args = parser.parse_args()

    repo_root = repo_root_from_cwd()
    drop_dir = args.drop_dir or default_drop_dir(repo_root)
    if not drop_dir.exists():
        return fail(f"drop directory does not exist: {drop_dir}")

    with tempfile.TemporaryDirectory(prefix="sequence-fixtures-") as temp_name:
        pairs, _ = collect_sources(drop_dir, Path(temp_name))
        if not pairs:
            print(f"no sequence ZIPs or WAV/JSON pairs found in {drop_dir}")
            return 0

        imported, skipped = import_pairs(repo_root, pairs, args.dry_run)
        if skipped:
            print("duplicates skipped:")
            for rel_path in skipped:
                print(f"  {rel_path}")
        if args.dry_run:
            print("dry run: no files written")
            return 0

        results = evaluate_imported(repo_root, imported)
        passing = [row["file"] for row in results if row["passed"]]
        failing = [row for row in results if not row["passed"]]
        added = [] if args.no_promote else update_positive_list(repo_root, passing, args.dry_run)

        print("fingerprint results for imported fixtures:")
        for row in results:
            status = "PASS" if row["passed"] else "FAIL"
            print(f"  {status} {row['file']} {row['acceptedCount']}/{row['expectedCount']}")
        if added:
            print("promoted positive fixtures:")
            for rel_path in added:
                print(f"  {rel_path}")
        if failing:
            print("not promoted because recognition was incomplete:")
            for row in failing:
                print(f"  {row['file']}: {row['reason']}")

    if not args.skip_sheetfingerprint:
        return run_sheetfingerprint(repo_root)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
