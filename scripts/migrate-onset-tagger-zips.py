#!/usr/bin/env python3
"""
migrate-onset-tagger-zips.py

Migrates all tagged ZIP fixtures to the new sidecar format:
  - Generates a new stable 12-char alphanumeric id
  - Builds a new baseName: [role_]category_bpmBPM_suffix (role omitted if 'random')
  - Sets updatedAt = migration timestamp
  - Migrates tempoBpm → bpm (removes tempoBpm)
  - Renames WAV/JSON files inside the ZIP and the ZIP file itself

Idempotent: ZIPs that already have a 12-char alphanumeric id AND no tempoBpm
are considered already migrated and are skipped.

Usage:
  python3 scripts/migrate-onset-tagger-zips.py [--dry-run]
"""

import argparse
import json
import os
import random
import re
import string
import zipfile
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent
FIXTURE_DIR = REPO_ROOT / "tests/fixtures/sequences/sheet-music-reading"


def generate_recording_uid():
    chars = string.ascii_lowercase + string.digits
    return "".join(random.choices(chars, k=12))


def extract_random_suffix(uid):
    clean = re.sub(r"[^a-z0-9]", "", uid.lower())
    return clean[-5:] if len(clean) >= 5 else clean or "xxxxx"


def build_generated_base_name(meta, suffix):
    training_role = meta.get("trainingRole") or "random"
    category = meta.get("category") or "unknown"
    bpm = meta.get("bpm")
    bpm_str = f"{int(bpm)}bpm" if bpm else "0bpm"
    if training_role and training_role != "random":
        parts = [training_role, category, bpm_str, suffix]
    else:
        parts = [category, bpm_str, suffix]
    raw = "_".join(parts)
    # normalizeRecordingBaseName equivalent
    raw = re.sub(r"[^a-zA-Z0-9._-]", "_", raw)
    raw = re.sub(r"_+", "_", raw)
    raw = raw.strip("._-")
    return raw


def normalize_sidecar(sidecar, new_id, updated_at):
    s = dict(sidecar)
    if not s.get("bpm") and s.get("tempoBpm"):
        s["bpm"] = s["tempoBpm"]
    s.pop("tempoBpm", None)
    s["id"] = new_id
    s["updatedAt"] = updated_at
    return s


def is_already_migrated(sidecar):
    existing_id = str(sidecar.get("id", ""))
    return (
        bool(re.match(r"^[a-z0-9]{12}$", existing_id, re.IGNORECASE))
        and "tempoBpm" not in sidecar
    )


def migrate_zip(zip_path, updated_at, dry_run=False):
    with zipfile.ZipFile(zip_path, "r") as zf:
        names = zf.namelist()
        json_names = [n for n in names if n.endswith(".json")]
        wav_names  = [n for n in names if n.endswith(".wav")]
        if not json_names:
            print(f"  SKIP (no JSON): {zip_path.name}")
            return False

        sidecar_str = zf.read(json_names[0]).decode("utf-8")
        try:
            sidecar = json.loads(sidecar_str)
        except json.JSONDecodeError:
            print(f"  SKIP (bad JSON): {zip_path.name}")
            return False

        if is_already_migrated(sidecar):
            print(f"  SKIP (migrated): {zip_path.name}")
            return False

        new_id       = generate_recording_uid()
        suffix       = extract_random_suffix(new_id)
        new_sidecar  = normalize_sidecar(sidecar, new_id, updated_at)
        new_base     = build_generated_base_name(new_sidecar, suffix)
        new_sidecar["baseName"] = new_base
        new_zip_name = f"{new_base}-tagged.zip"

        if dry_run:
            print(f"  DRY: {zip_path.name} → {new_zip_name}  (id: {new_id})")
            return False

        new_zip_path = zip_path.parent / new_zip_name

        # Rebuild ZIP
        with zipfile.ZipFile(new_zip_path, "w", compression=zipfile.ZIP_STORED) as out:
            if wav_names:
                wav_data = zf.read(wav_names[0])
                out.writestr(f"{new_base}.wav", wav_data)
            out.writestr(
                f"{new_base}.json",
                json.dumps(new_sidecar, ensure_ascii=False, indent=2)
            )

    # Remove old ZIP (unless output == input)
    if zip_path != new_zip_path and zip_path.exists():
        zip_path.unlink()

    print(f"  OK:  {zip_path.name} → {new_zip_name}  (id: {new_id})")
    return True


def main():
    parser = argparse.ArgumentParser(description="Migrate onset-tagger ZIP fixtures")
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
    args = parser.parse_args()

    updated_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.") + \
                 f"{datetime.now(timezone.utc).microsecond // 1000:03d}Z"

    zip_files = sorted(FIXTURE_DIR.glob("*-tagged.zip"))
    print(f"Found {len(zip_files)} tagged ZIPs in {FIXTURE_DIR.relative_to(REPO_ROOT)}\n")

    migrated = 0
    skipped  = 0

    for zp in zip_files:
        result = migrate_zip(zp, updated_at, dry_run=args.dry_run)
        if result:
            migrated += 1
        else:
            skipped += 1

    print(f"\nDone: {migrated} migrated, {skipped} skipped.")

    if not args.dry_run and migrated > 0:
        print("\nRebuilding review catalog...")
        import subprocess
        result = subprocess.run(
            ["npm", "run", "review:android-firefox"],
            cwd=str(REPO_ROOT), capture_output=False
        )
        if result.returncode != 0:
            print("review:android-firefox failed (non-fatal).")


if __name__ == "__main__":
    main()
