#!/bin/bash

# auto-update-version.sh
# Staff Engineer implementation of version.txt auto-update with incrementing numbers.

normalize_version_counter() {
    local version=$1

    if [[ ! "$version" =~ ^[0-9]+(\.[0-9]+)?$ ]]; then
        return 1
    fi

    local whole=${version%%.*}
    local fraction=""
    if [[ "$version" == *.* ]]; then
        fraction=${version#*.}
    fi

    if [[ -z "$fraction" ]]; then
        fraction="0"
    fi

    if [[ "$whole" == "0" ]]; then
        echo "$fraction"
        return 0
    fi

    echo "${whole}${fraction}"
}

format_version_from_counter() {
    local counter=$1
    echo "0.$counter"
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

    current_version=$(extract_numeric_version_from_file "$version_file")
    if [[ -n "$current_version" ]]; then
        echo "$current_version"
        return 0
    fi

    # Check git history for the most recent valid numeric version
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
    local current_version=$1
    local counter
    counter=$(normalize_version_counter "$current_version") || return 1
    counter=$((10#$counter + 1))
    format_version_from_counter "$counter"
}

sync_sw_cache_version() {
    if [ -f "sw.js" ] && [ -f "version.txt" ]; then
        CURRENT_VERSION_STRING=$(head -n 1 version.txt)
        VERSION_SLUG=$(echo "$CURRENT_VERSION_STRING" | grep -oE 'Version [^|]+' | sed 's/Version //' | xargs | tr ' ' '-' | tr ':' '-')
        
        if [ -n "$VERSION_SLUG" ]; then
            sed -i "s/const CACHE_VERSION = '.*';/const CACHE_VERSION = '$VERSION_SLUG';/" sw.js
            git add sw.js
            echo "Synced sw.js CACHE_VERSION to $VERSION_SLUG"
        fi
    fi
}

main() {
    local COMMIT_MSG_FILE=$1
    local COMMIT_SOURCE=$2

    # 1. Guard: Only update version.txt if it is NOT already staged.
    # This avoids overwriting manual version bumps.
    if ! git diff --cached --name-only | grep -qx "version.txt"; then
        # 2. Extract current version number from version.txt or, if necessary,
        # recover the last valid numeric version from git history.
        CURRENT_VERSION=$(extract_current_version "version.txt")

        # 3. Increment the counter while keeping the public format in 0.x.
        NEW_VERSION=$(bump_version "$CURRENT_VERSION")

        TIMESTAMP=$(date "+%Y-%m-%d %H:%M")
        HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "initial")

        # 4. Extract title if possible
        TITLE=""
        if [ -n "$COMMIT_MSG_FILE" ] && [ -f "$COMMIT_MSG_FILE" ]; then
            # Read the first non-comment line from the commit message file
            TITLE=$(grep -v '^#' "$COMMIT_MSG_FILE" | head -n 1 | xargs)
        fi

        if [ -z "$TITLE" ]; then
            TITLE="Update"
        fi

        # 5. Update the file
        echo "Version $NEW_VERSION | $TIMESTAMP | $HASH | $TITLE" > version.txt

        # 6. Stage the change
        git add version.txt

        echo "Auto-updated version.txt to $NEW_VERSION"
    fi

    # 7. Sync sw.js CACHE_VERSION with version.txt
    sync_sw_cache_version
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
    main "$@"
fi
