# Task Dispatch Phase 4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the merge stage for dispatched isolated subtasks by reading real `diff.patch` files, previewing patch contents, and applying clean patches only when `--auto-merge` is explicitly requested.

**Architecture:** Add a focused `merge-patches` core module that locates parent dispatch artifacts, parses patch file paths, checks patches with `git apply --check`, and applies patches with `git apply`. Update `mergeCommand` to return structured patch previews by default and to apply patches only through `autoMerge=true`.

**Tech Stack:** TypeScript, Node.js 20+, existing `runProcess()` wrapper, native `git apply`, Vitest, temporary git repositories for command tests.

---

## File Structure

- Create `src/core/merge-patches.ts`: parent task lookup, `diff.patch` discovery, patch file parsing, `git apply --check`, and `git apply`.
- Modify `src/commands/merge.ts`: replace preview-only placeholder with real dry-run preview and explicit auto-merge.
- Modify `src/cli.ts`: add `merge --workdir <workdir>` so callers can merge artifacts outside the current shell directory.
- Modify `src/core/cli-error.ts`: add `MERGE_CONFLICT` and `PATCH_APPLY_FAILED`.
- Create `tests/core/merge-patches.test.ts`: verify patch discovery, file parsing, clean apply, and conflict detection.
- Modify `tests/commands/task-dispatch.test.ts`: verify `mergeCommand` dry-run previews real patches and `autoMerge` applies a clean patch.
- Modify `README.md`, `spec/rolemux-development-spec.md`, `docs/progress/status.md`, `docs/progress/timeline.md`, and `docs/progress/logs/2026-06-05.md`.

## Scope Boundary

Included:

- `merge --dry-run` reads `.rolemux/tasks/{parent-task-id}/subtasks/*/diff.patch`.
- Dry-run returns each patch's subtask id, patch path, touched files, status, and line count.
- `merge --auto-merge` checks every patch with `git apply --check` before applying any patch.
- `merge --auto-merge` applies clean patches with `git apply` in sorted subtask order.
- Merge command supports `--workdir` for tests and plugin callers.

Excluded:

- Automatic conflict resolution.
- Applying only a subset of patches.
- Worktree cleanup.
- Persisting a separate merge task artifact.
- `dispatch --resume`.
- Planner automatic splitting.
- Herdr backend.

### Task 1: Merge Patch Core

**Files:**
- Create: `tests/core/merge-patches.test.ts`
- Create: `src/core/merge-patches.ts`
- Modify: `src/core/cli-error.ts`

- [ ] **Step 1: Write failing core tests**

Create `tests/core/merge-patches.test.ts` with tests that:

- create a temporary git repository.
- create `.rolemux/tasks/parent/subtasks/one/diff.patch`.
- verify `loadMergePreview({ workdir, parentTaskId: 'parent' })` returns one patch touching `feature.txt`.
- verify `applyMergePatches({ workdir, parentTaskId: 'parent' })` applies `feature.txt`.
- verify applying the same new-file patch when `feature.txt` already exists throws `{ code: 'MERGE_CONFLICT' }`.

- [ ] **Step 2: Run red core tests**

Run:

```powershell
npx vitest run tests/core/merge-patches.test.ts
```

Expected: fail because `src/core/merge-patches.ts` does not exist.

- [ ] **Step 3: Implement merge patch core**

Create `src/core/merge-patches.ts` with:

- `loadMergePreview(input)` returning `{ parentTaskId, parentTaskDir, patches, warnings }`.
- `applyMergePatches(input)` checking all patches first, then applying all patches.
- `MergePatchPreview` fields: `subtaskId`, `patchPath`, `files`, `lineCount`, `status`.
- `parsePatchFiles(patch)` that reads `diff --git a/<file> b/<file>` lines and returns sorted unique target files.
- `git apply --check` for preflight and `git apply` for application.

- [ ] **Step 4: Run green core tests**

Run:

```powershell
npx vitest run tests/core/merge-patches.test.ts
```

Expected: pass.

### Task 2: Merge Command Integration

**Files:**
- Modify: `tests/commands/task-dispatch.test.ts`
- Modify: `src/commands/merge.ts`
- Modify: `src/cli.ts`

- [ ] **Step 1: Write failing command tests**

Update `tests/commands/task-dispatch.test.ts` with:

- a dry-run merge test that creates a parent task artifact with one `diff.patch`, calls `mergeCommand({ parentTask: 'parent', workdir, dryRun: true })`, and asserts `patches[0].files` contains `feature.txt`.
- an auto-merge test that creates a temporary git repo, writes the same parent artifact, calls `mergeCommand({ parentTask: 'parent', workdir, autoMerge: true })`, and asserts `feature.txt` exists with patch content.

- [ ] **Step 2: Run red command tests**

Run:

```powershell
npx vitest run tests/commands/task-dispatch.test.ts
```

Expected: fail because `mergeCommand` still returns an empty preview and rejects auto-merge.

- [ ] **Step 3: Implement command integration**

Update `mergeCommand` so:

- `autoMerge !== true` returns `status: 'dry-run'`, real `patches`, warnings from preview, and next command `rolemux merge --parent-task <id> --workdir <workdir> --auto-merge`.
- `autoMerge === true` calls `applyMergePatches`, returns `status: 'success'`, real `patches`, empty next commands, and `requiresUserAction: false`.

Update `src/cli.ts` so the `merge` command accepts `--workdir <workdir>` and passes it to `mergeCommand`.

- [ ] **Step 4: Run green command tests**

Run:

```powershell
npx vitest run tests/commands/task-dispatch.test.ts
```

Expected: pass.

### Task 3: Docs and Progress

**Files:**
- Modify: `README.md`
- Modify: `spec/rolemux-development-spec.md`
- Modify: `docs/progress/status.md`
- Modify: `docs/progress/timeline.md`
- Modify: `docs/progress/logs/2026-06-05.md`

- [ ] **Step 1: Update docs**

Document:

- `merge --dry-run` now reads real `diff.patch` artifacts and previews touched files.
- `merge --auto-merge` explicitly applies clean patches with `git apply`.
- `merge --workdir` lets callers target a project directory.
- Conflict resolution, subset selection, and worktree cleanup remain future work.

- [ ] **Step 2: Verify docs**

Run:

```powershell
Select-String -LiteralPath README.md -Pattern 'merge --dry-run','merge --auto-merge','--workdir','diff.patch'
Select-String -LiteralPath docs\progress\status.md -Pattern 'Phase 4','merge','diff.patch'
```

Expected: patterns found.

### Task 4: Final Verification and Commit

**Files:**
- All touched files

- [ ] **Step 1: Run targeted tests**

Run:

```powershell
npx vitest run tests/core/merge-patches.test.ts tests/commands/task-dispatch.test.ts
```

Expected: pass.

- [ ] **Step 2: Run full verification**

Run:

```powershell
npm run typecheck
npm test
npm run build
git diff --check
```

Expected: all commands exit 0.

- [ ] **Step 3: Run CLI merge verification**

Run a temporary git repository, write a parent task `diff.patch`, build the CLI, execute:

```powershell
node .\dist\cli.js merge --parent-task parent --workdir <temp-repo> --dry-run
node .\dist\cli.js merge --parent-task parent --workdir <temp-repo> --auto-merge
```

Expected: dry-run reports `feature.txt`; auto-merge creates `feature.txt`.

- [ ] **Step 4: Commit and push main**

Run:

```powershell
git add .
git commit -m "feat: 增加 dispatch patch 合并 / add dispatch patch merge"
git push origin main
```

Expected: commit and push succeed.

## Self-Review

Spec coverage:

- `merge --dry-run` reads real patch artifacts: Task 1 and Task 2.
- `merge --auto-merge` explicit opt-in applies clean patches: Task 1 and Task 2.
- Machine-readable result for AI/plugin callers: Task 2.
- Docs/progress: Task 3.

Deferred by design:

- Automatic conflict resolution.
- Subset patch selection.
- Worktree cleanup.
- `dispatch --resume`.
- Planner automatic splitting.
- Herdr backend.
