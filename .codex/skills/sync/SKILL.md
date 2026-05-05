---
name: sync
description: Automate a safe git synchronization flow for coding tasks. Use when Codex should finalize a change set by running tests only for relevant non-Markdown code changes, creating a commit, pulling latest remote state, merging a base branch (for example main), and pushing the current branch.
---

# Sync

Execute sync operations with `scripts/git-sync.sh`.

Run from the target repository root.

## Workflow

1. Resolve branch context.
- Read current branch with `git rev-parse --abbrev-ref HEAD`.
- Require a git repository and stop with a clear error when not in one.

2. Run tests only when relevant changes require them.
- Inspect the current local change set before staging.
- Run the provided test command only when `--test-cmd` is set and at least one non-Markdown file changed.
- Skip tests automatically when there are no local changes.
- Skip tests automatically when all local changes are Markdown-only.
- Skip tests when the caller explicitly confirms they already passed in the current run (`--skip-tests`).

3. Commit local changes.
- Stage all changes with `git add -A`.
- Commit only when there are staged changes.
- Use caller-provided commit message.
- Be aware that some repositories auto-generate follow-up metadata during
  `prepare-commit-msg` or related hooks. In this repo, `version.txt` and
  `sw.js` may already be staged for the next commit immediately after a
  successful commit.

4. Pull, merge, push.
- Pull current branch from remote with `git pull --ff-only`.
- Merge base branch into current branch when `current != merge-branch`.
- Push current branch to remote.

## Repo-specific note for GuitarTools

- `version.txt` is owned by `.husky/prepare-commit-msg` via
  `scripts/auto-update-version.sh`; agents must not edit it manually.
- The same hook also syncs `sw.js` `CACHE_VERSION`.
- After a commit, the hook may leave the next version/cache bump already staged.
  Treat this as normal repo behavior and inspect `git status` before assuming
  the sync is finished.

## Usage

```bash
~/.codex/skills/sync/scripts/git-sync.sh \
  --test-cmd "npm test" \
  --commit-message "chore: sync branch" \
  --pull-remote origin \
  --merge-branch main
```

Skip tests when they already passed during this run:

```bash
~/.codex/skills/sync/scripts/git-sync.sh \
  --skip-tests \
  --commit-message "chore: sync branch" \
  --merge-branch main
```

Markdown-only edits do not trigger the test suite:

```bash
~/.codex/skills/sync/scripts/git-sync.sh \
  --test-cmd "npm test" \
  --commit-message "docs: update plans"
```
