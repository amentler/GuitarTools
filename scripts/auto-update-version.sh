#!/bin/bash

# auto-update-version.sh
# Hook-owned version/cache metadata updater.
# Called from .husky/pre-commit. It only updates metadata files that are not
# already staged for the current commit.

AUTO_UPDATE_VERSION_CORE="scripts/autoUpdateVersionCore.mjs"

normalize_version_counter() {
    node "$AUTO_UPDATE_VERSION_CORE" normalize "$1"
}

format_version_from_counter() {
    node "$AUTO_UPDATE_VERSION_CORE" format "$1"
}

extract_numeric_version_from_file() {
    local file_path=$1

    if [[ ! -f "$file_path" ]]; then
        return 1
    fi

    # Try to find "Version X.Y |"
    local ver
    ver=$(grep -m1 -oE '^Version [0-9]+(\.[0-9]+)? \|' "$file_path" | awk '{ print $2 }')
    if [[ -n "$ver" ]]; then
        echo "$ver"
        return 0
    fi

    # Fallback: if it just says "Version 2026-..." (no numeric counter), return 0.0 or last known
    return 1
}

extract_current_version() {
    local version_file=$1
    local current_version=""

    # Read from HEAD so stale staged or working-tree content never freezes the counter.
    current_version=$(git show "HEAD:${version_file}" 2>/dev/null | grep -m1 -oE '^Version [0-9]+(\.[0-9]+)? \|' | awk '{ print $2 }')
    if [[ -n "$current_version" ]]; then
        echo "$current_version"
        return 0
    fi

    # Fallback: scan recent git history (e.g. initial commit where HEAD lacks the file).
    while IFS= read -r commit_hash; do
        current_version=$(git show "${commit_hash}:${version_file}" 2>/dev/null | grep -m1 -oE '^Version [0-9]+(\.[0-9]+)? \|' | awk '{ print $2 }')
        if [[ -n "$current_version" ]]; then
            echo "$current_version"
            return 0
        fi
    done < <(git log --format=%H -n 20 -- "$version_file" 2>/dev/null)

    echo "0.7" # Hard fallback based on known last version
}

bump_version() {
    node "$AUTO_UPDATE_VERSION_CORE" bump "$1"
}

sync_sw_cache_version() {
    if is_staged "sw.js"; then
        echo "sw.js already staged; leaving CACHE_VERSION unchanged"
        return 0
    fi

    if [ ! -f "sw.js" ] || [ ! -f "version.txt" ]; then
        return 0
    fi

    if ! git diff --quiet -- "sw.js"; then
        echo "sw.js has unstaged changes; leaving CACHE_VERSION unchanged"
        return 0
    fi

    CURRENT_VERSION_STRING=$(staged_or_worktree_first_line "version.txt")
    VERSION_SLUG=$(echo "$CURRENT_VERSION_STRING" | grep -oE 'Version [^|]+' | sed 's/Version //' | xargs | tr ' ' '-' | tr ':' '-')

    if [ -n "$VERSION_SLUG" ]; then
        sed -i "s/const CACHE_VERSION = '.*';/const CACHE_VERSION = '$VERSION_SLUG';/" sw.js
        git add sw.js
        echo "Synced sw.js CACHE_VERSION to $VERSION_SLUG"
    fi
}

is_staged() {
    local file_path=$1
    ! git diff --cached --quiet -- "$file_path"
}

staged_or_worktree_first_line() {
    local file_path=$1

    if is_staged "$file_path"; then
        git show ":$file_path" 2>/dev/null | head -n 1
        return 0
    fi

    head -n 1 "$file_path"
}

build_precommit_title() {
    local file_count
    local first_file

    file_count=$(git diff --cached --name-only --diff-filter=ACMRTUXB \
        | grep -v -E '^(version\.txt|sw\.js)$' \
        | wc -l \
        | tr -d ' ')
    first_file=$(git diff --cached --name-only --diff-filter=ACMRTUXB \
        | grep -v -E '^(version\.txt|sw\.js)$' \
        | head -n 1)

    if [ -z "$first_file" ]; then
        echo "Metadata update"
        return 0
    fi

    if [ "$file_count" -gt 1 ]; then
        echo "$first_file (+$((file_count - 1)) more)"
        return 0
    fi

    echo "$first_file"
}

main() {
    # 1. Always regenerate version.txt from HEAD so accidental staging (e.g.
    #    after git stash/rebase) can never freeze the counter.
    #    Only exception: version.txt has explicit unstaged edits (shouldn't
    #    happen per CLAUDE.md, but kept as a safety-net).
    if [ -f "version.txt" ] && ! git diff --quiet -- "version.txt"; then
        echo "version.txt has unstaged changes; leaving version metadata unchanged"
    else
        CURRENT_VERSION=$(extract_current_version "version.txt")

        # 2. Increment the counter while keeping the public format in 0.x.
        NEW_VERSION=$(bump_version "$CURRENT_VERSION")

        TIMESTAMP=$(date "+%Y-%m-%d %H:%M")
        HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "initial")
        TITLE=$(build_precommit_title)

        # 3. Write and stage version.txt.
        echo "Version $NEW_VERSION | $TIMESTAMP | $HASH | $TITLE" > version.txt
        git add version.txt
        echo "Auto-updated version.txt to $NEW_VERSION"
    fi

    # 4. Sync sw.js CACHE_VERSION with version.txt when sw.js is not already
    #    part of the current commit.
    sync_sw_cache_version
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
    main "$@"
fi
