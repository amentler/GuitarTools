#!/bin/bash

# auto-update-version.sh
# Staff Engineer implementation of version.txt auto-update.
#
# This script updates version.txt with:
# 1. Current timestamp
# 2. Current HEAD hash (as base)
# 3. Commit title (if available from prepare-commit-msg)

COMMIT_MSG_FILE=$1
COMMIT_SOURCE=$2

# 1. Guard: Only update if version.txt is NOT already staged.
# This respects manual version bumps.
if git diff --cached --name-only | grep -q "^version.txt$"; then
    # version.txt is already in the index, do nothing.
    exit 0
fi

TIMESTAMP=$(date "+%Y-%m-%d %H:%M")
HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "initial")

# 2. Extract title if possible
TITLE=""
if [ -n "$COMMIT_MSG_FILE" ] && [ -f "$COMMIT_MSG_FILE" ]; then
    # Read the first non-comment line
    TITLE=$(grep -v '^#' "$COMMIT_MSG_FILE" | head -n 1 | xargs)
fi

# Fallback for title
if [ -z "$TITLE" ]; then
    TITLE="Update"
fi

# 3. Update the file
echo "Version $TIMESTAMP | $HASH | $TITLE" > version.txt

# 4. Stage the change so it becomes part of the current commit
git add version.txt

echo "Auto-updated version.txt with timestamp and hash."
