#!/bin/bash

# auto-update-version.sh
# Staff Engineer implementation of version.txt auto-update with incrementing numbers.

extract_numeric_version_from_file() {
    local file_path=$1

    if [[ ! -f "$file_path" ]]; then
        return 1
    fi

    grep -m1 -oE '^Version [0-9]+(\.[0-9]+)? \|' "$file_path" | awk '{ print $2 }'
}

extract_current_version() {
    local version_file=$1
    local current_version=""

    current_version=$(extract_numeric_version_from_file "$version_file")
    if [[ -n "$current_version" ]]; then
        echo "$current_version"
        return 0
    fi

    while IFS= read -r commit_hash; do
        current_version=$(git show "${commit_hash}:${version_file}" 2>/dev/null | grep -m1 -oE '^Version [0-9]+(\.[0-9]+)? \|' | awk '{ print $2 }')
        if [[ -n "$current_version" ]]; then
            echo "$current_version"
            return 0
        fi
    done < <(git log --format=%H -- "$version_file" 2>/dev/null)

    echo "0.0"
}

bump_version() {
    local current_version=$1
    awk -v version="$current_version" 'BEGIN { printf "%.1f", version + 0.1 }'
}

COMMIT_MSG_FILE=$1
COMMIT_SOURCE=$2

# 1. Guard: Only update if version.txt is NOT already staged.
# This avoids overwriting manual version bumps.
if git diff --cached --name-only | grep -qx "version.txt"; then
    exit 0
fi

# 2. Extract current version number from version.txt or, if necessary,
# recover the last valid numeric version from git history.
CURRENT_VERSION=$(extract_current_version "version.txt")

# 3. Increment the numeric version by exactly 0.1.
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
