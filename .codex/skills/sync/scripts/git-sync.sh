#!/usr/bin/env bash
set -euo pipefail

TEST_CMD=""
SKIP_TESTS=0
VERSION_FILE=""
VERSION_NOTE="sync update"
COMMIT_MESSAGE=""
PULL_REMOTE="origin"
MERGE_BRANCH="main"
PUSH_REMOTE="origin"

list_changed_files() {
  local head_exists=0

  if git rev-parse --verify HEAD >/dev/null 2>&1; then
    head_exists=1
  fi

  {
    if [[ "$head_exists" -eq 1 ]]; then
      git diff --name-only HEAD --
    else
      git diff --name-only --
      git diff --name-only --cached --
    fi
    git ls-files --others --exclude-standard
  } | sed '/^$/d' | sort -u
}

has_non_markdown_changes() {
  local changed_files="$1"
  local file=""

  while IFS= read -r file; do
    [[ -z "$file" ]] && continue
    case "$file" in
      *.md|*.mdx)
        ;;
      *)
        return 0
        ;;
    esac
  done <<< "$changed_files"

  return 1
}

usage() {
  cat <<'EOF'
Usage:
  git-sync.sh [options]

Options:
  --test-cmd "<cmd>"          Test command to run (for example: "npm test")
  --skip-tests                Skip tests (only when already confirmed as passed)
  --version-file <path>       Version file to update (optional)
  --version-note "<text>"     Note suffix for version line (default: "sync update")
  --commit-message "<text>"   Commit message (required)
  --pull-remote <name>        Remote for pull (default: origin)
  --merge-branch <name>       Base branch to merge into current branch (default: main)
  --push-remote <name>        Remote for push (default: origin)
  -h, --help                  Show help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --test-cmd)
      TEST_CMD="${2:-}"
      shift 2
      ;;
    --skip-tests)
      SKIP_TESTS=1
      shift
      ;;
    --version-file)
      VERSION_FILE="${2:-}"
      shift 2
      ;;
    --version-note)
      VERSION_NOTE="${2:-}"
      shift 2
      ;;
    --commit-message)
      COMMIT_MESSAGE="${2:-}"
      shift 2
      ;;
    --pull-remote)
      PULL_REMOTE="${2:-}"
      shift 2
      ;;
    --merge-branch)
      MERGE_BRANCH="${2:-}"
      shift 2
      ;;
    --push-remote)
      PUSH_REMOTE="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 2
      ;;
  esac
done

if [[ -z "$COMMIT_MESSAGE" ]]; then
  echo "--commit-message is required." >&2
  exit 2
fi

git rev-parse --is-inside-work-tree >/dev/null 2>&1 || {
  echo "Not inside a git repository." >&2
  exit 2
}

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
echo "Current branch: ${CURRENT_BRANCH}"

CHANGED_FILES="$(list_changed_files)"

if [[ "$SKIP_TESTS" -eq 1 ]]; then
  echo "Skipping tests by explicit request."
elif [[ -z "$TEST_CMD" ]]; then
  echo "No test command provided; skipping tests."
elif [[ -z "$CHANGED_FILES" ]]; then
  echo "No local changes detected; skipping tests."
elif has_non_markdown_changes "$CHANGED_FILES"; then
  echo "Running tests because non-Markdown files changed: ${TEST_CMD}"
  eval "$TEST_CMD"
else
  echo "Only Markdown changes detected; skipping tests."
fi

if [[ -n "$VERSION_FILE" ]]; then
  if [[ -f "$VERSION_FILE" ]]; then
    TS="$(date -u '+%Y-%m-%d %H:%M UTC')"
    NEW_LINE="Version ${TS} | ${VERSION_NOTE}"
    if head -n 1 "$VERSION_FILE" | grep -q '^Version '; then
      TMP_FILE="$(mktemp)"
      { echo "$NEW_LINE"; tail -n +2 "$VERSION_FILE"; } > "$TMP_FILE"
      mv "$TMP_FILE" "$VERSION_FILE"
      echo "Updated first line in ${VERSION_FILE}"
    else
      echo "$NEW_LINE" >> "$VERSION_FILE"
      echo "Appended version line to ${VERSION_FILE}"
    fi
  else
    echo "Version file not found: ${VERSION_FILE}" >&2
    exit 2
  fi
fi

git add -A

if ! git diff --cached --quiet; then
  git commit -m "$COMMIT_MESSAGE"
else
  echo "No staged changes to commit."
fi

echo "Pulling latest from ${PULL_REMOTE}/${CURRENT_BRANCH}"
git pull --ff-only "$PULL_REMOTE" "$CURRENT_BRANCH"

if [[ "$MERGE_BRANCH" != "$CURRENT_BRANCH" ]]; then
  echo "Merging ${MERGE_BRANCH} into ${CURRENT_BRANCH}"
  git merge --no-edit "$MERGE_BRANCH"
else
  echo "Merge skipped: merge branch equals current branch (${CURRENT_BRANCH})"
fi

echo "Pushing ${CURRENT_BRANCH} to ${PUSH_REMOTE}"
git push "$PUSH_REMOTE" "$CURRENT_BRANCH"

echo "Sync completed."
