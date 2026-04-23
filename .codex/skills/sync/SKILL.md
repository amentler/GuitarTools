---
name: sync
description: Automate a safe git synchronization flow for coding tasks. Use when Codex should finalize a change set by running tests only for relevant non-Markdown code changes, checking/updating a version file, creating a commit, pulling latest remote state, merging a base branch (for example main), and pushing the current branch.
---

# Sync

Execute sync operations with `scripts/git-sync.sh`.

Run from the target repository root.

## Workflow

1. Resolve branch context.
- Read current branch with `git rev-parse --abbrev-ref HEAD`.
- Require a git repository and stop with a clear error when not in one.

2. Run tests only when relevant changes require them.
- Inspect the current local change set before version-file updates or staging.
- Run the provided test command only when `--test-cmd` is set and at least one non-Markdown file changed.
- Skip tests automatically when there are no local changes.
- Skip tests automatically when all local changes are Markdown-only.
- Skip tests when the caller explicitly confirms they already passed in the current run (`--skip-tests`).

3. Check and update version file.
- If `--version-file` is provided and the file exists:
  - Replace first line when it starts with `Version `.
  - Otherwise append one new version line.
- Format: `Version YYYY-MM-DD HH:MM UTC | <note>`.

4. Commit local changes.
- Stage all changes with `git add -A`.
- Commit only when there are staged changes.
- Use caller-provided commit message.

5. Pull, merge, push.
- Pull current branch from remote with `git pull --ff-only`.
- Merge base branch into current branch when `current != merge-branch`.
- Push current branch to remote.

## Usage

```bash
~/.codex/skills/sync/scripts/git-sync.sh \
  --test-cmd "npm test" \
  --version-file version.txt \
  --version-note "sync update" \
  --commit-message "chore: sync branch" \
  --pull-remote origin \
  --merge-branch main
```

Skip tests when they already passed during this run:

```bash
~/.codex/skills/sync/scripts/git-sync.sh \
  --skip-tests \
  --version-file version.txt \
  --version-note "sync update" \
  --commit-message "chore: sync branch" \
  --merge-branch main
```

Markdown-only edits do not trigger the test suite:

```bash
~/.codex/skills/sync/scripts/git-sync.sh \
  --test-cmd "npm test" \
  --commit-message "docs: update plans"
```
