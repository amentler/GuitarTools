#!/bin/bash

# auto-update-version.sh
# Staff Engineer implementation of version.txt auto-update with incrementing numbers.

COMMIT_MSG_FILE=$1
COMMIT_SOURCE=$2

# 1. Guard: Only update if version.txt is NOT already staged.
if git diff --cached --name-only | grep -q "^version.txt$"; then
    exit 0
fi

# 2. Extract current version number from version.txt
# Expected format: "Version 0.1 | ..."
CURRENT_VERSION_RAW=$(grep -oP "Version \d+\.\d+" version.txt)
if [ -z "$CURRENT_VERSION_RAW" ]; then
    CURRENT_VERSION="0.0"
else
    CURRENT_VERSION=$(echo "$CURRENT_VERSION_RAW" | awk '{print $2}')
fi

# 3. Increment minor version
MAJOR=$(echo "$CURRENT_VERSION" | cut -d. -f1)
MINOR=$(echo "$CURRENT_VERSION" | cut -d. -f2)

# Sanity check if MAJOR/MINOR are integers
if ! [[ "$MAJOR" =~ ^[0-9]+$ ]] || ! [[ "$MINOR" =~ ^[0-9]+$ ]]; then
    MAJOR=0
    MINOR=0
fi

NEW_MINOR=$((MINOR + 1))
NEW_VERSION="$MAJOR.$NEW_MINOR"

TIMESTAMP=$(date "+%Y-%m-%d %H:%M")
HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "initial")

# 4. Extract title if possible
TITLE=""
if [ -n "$COMMIT_MSG_FILE" ] && [ -f "$COMMIT_MSG_FILE" ]; then
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
