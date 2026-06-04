# Task Dispatch Phase 5 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a safe worktree cleanup command for dispatch artifacts so users can remove isolated worker worktrees after reviewing or merging patches.

**Architecture:** Add a focused `worktree-cleanup` core module that reads `worktree.txt` files from a parent dispatch task, validates every path is under `.rolemux/worktrees/`, previews cleanup targets, and removes existing worktrees through `git worktree remove --force`. Add a `rolemux worktree cleanup` CLI command that defaults to dry-run semantics unless the caller omits `--dry-run`.

**Tech Stack:** TypeScript, Node.js 20+, existing `runProcess()` wrapper, native `git worktree remove`, Vitest, temporary git repositories for worktree tests.

---

## File Structure

- Create `src/core/worktree-cleanup.ts`: parent task lookup, `worktree.txt` discovery, path safety validation, cleanup preview, and git worktree removal.
- Create `src/commands/worktree.ts`: command handler for worktree cleanup.
- Modify `src/cli.ts`: add `rolemux worktree cleanup --parent-task <id> --workdir <dir> --dry-run`.
- Modify `src/core/cli-error.ts`: add `WORKTREE_CLEANUP_UNSAFE_PATH` and `WORKTREE_CLEANUP_FAILED`.
- Create `tests/core/worktree-cleanup.test.ts`: verify preview, cleanup removal, missing worktree handling, and unsafe path rejection.
- Create `tests/commands/worktree-cleanup.test.ts`: verify command result shape and cleanup behavior.
- Modify `README.md`, `spec/rolemux-development-spec.md`, `docs/progress/status.md`, `docs/progress/timeline.md`, and `docs/progress/logs/2026-06-05.md`.

## Scope Boundary

Included:

- `worktree cleanup --dry-run` lists worktrees recorded in `worktree.txt`.
- `worktree cleanup` removes existing recorded worktrees with `git worktree remove --force`.
- Cleanup only accepts worktree paths under `.rolemux/worktrees/` inside the target `--workdir`.
- Missing worktree paths are reported as `missing`, not treated as fatal.
- Cleanup does not remove `.rolemux/tasks/{parent-task-id}` artifacts.

Excluded:

- Deleting git branches created for worktrees.
- Cleaning all worktrees without a parent task id.
- Cleaning worktrees outside `.rolemux/worktrees/`.
- Automatic cleanup after merge.
- `dispatch --resume`.
- Selective patch application.
- Planner automatic splitting.
- Herdr backend.

### Task 1: Worktree Cleanup Core

**Files:**
- Create: `tests/core/worktree-cleanup.test.ts`
- Create: `src/core/worktree-cleanup.ts`
- Modify: `src/core/cli-error.ts`

- [ ] **Step 1: Write failing core tests**

Create `tests/core/worktree-cleanup.test.ts` with tests that:

- create a temporary git repository.
- use `createIsolatedWorktree()` to create a real `.rolemux/worktrees/parent/one` worktree.
- write `.rolemux/tasks/parent/subtasks/one/worktree.txt` with the worktree path.
- verify `loadWorktreeCleanupPreview({ workdir, parentTaskId: 'parent' })` returns one target with status `pending`.
- verify `cleanupWorktrees({ workdir, parentTaskId: 'parent' })` removes the worktree and returns target status `removed`.
- verify a missing worktree path returns target status `missing`.
- verify a `worktree.txt` path outside `.rolemux/worktrees/` rejects with `{ code: 'WORKTREE_CLEANUP_UNSAFE_PATH' }`.

- [ ] **Step 2: Run red core tests**

Run:

```powershell
npx vitest run tests/core/worktree-cleanup.test.ts
```

Expected: fail because `src/core/worktree-cleanup.ts` does not exist.

- [ ] **Step 3: Implement worktree cleanup core**

Create `src/core/worktree-cleanup.ts` with:

- `loadWorktreeCleanupPreview(input)` returning `{ status: 'dry-run', parentTaskId, parentTaskDir, targets, warnings }`.
- `cleanupWorktrees(input)` returning `{ status: 'cleaned', parentTaskId, parentTaskDir, targets, warnings }`.
- `WorktreeCleanupTarget` fields: `subtaskId`, `worktreePath`, `exists`, `status`.
- `validateManagedWorktreePath(workdir, worktreePath)` requiring the resolved path to be under `resolve(workdir, '.rolemux/worktrees')`.
- `git worktree remove --force <worktreePath>` for existing targets.

- [ ] **Step 4: Run green core tests**

Run:

```powershell
npx vitest run tests/core/worktree-cleanup.test.ts
```

Expected: pass.

### Task 2: Worktree Cleanup Command and CLI

**Files:**
- Create: `tests/commands/worktree-cleanup.test.ts`
- Create: `src/commands/worktree.ts`
- Modify: `src/cli.ts`

- [ ] **Step 1: Write failing command tests**

Create `tests/commands/worktree-cleanup.test.ts` with tests that:

- create a temporary git repository and a real isolated worktree.
- write the matching parent task `worktree.txt`.
- call `worktreeCleanupCommand({ parentTask: 'parent', workdir, dryRun: true })` and assert status `dry-run`.
- call `worktreeCleanupCommand({ parentTask: 'parent', workdir, dryRun: false })` and assert status `cleaned` plus removed target.

- [ ] **Step 2: Run red command tests**

Run:

```powershell
npx vitest run tests/commands/worktree-cleanup.test.ts
```

Expected: fail because `src/commands/worktree.ts` does not exist.

- [ ] **Step 3: Implement command and CLI integration**

Create `src/commands/worktree.ts`:

- `WorktreeCleanupCommandOptions` with `parentTask`, `workdir`, and `dryRun`.
- `worktreeCleanupCommand(options)` that calls `loadWorktreeCleanupPreview()` when `dryRun === true`, otherwise calls `cleanupWorktrees()`.

Update `src/cli.ts`:

- import `worktreeCleanupCommand`.
- add a `worktree` command group.
- add `worktree cleanup --parent-task <parentTask> --workdir <workdir> --dry-run`.

- [ ] **Step 4: Run green command tests**

Run:

```powershell
npx vitest run tests/commands/worktree-cleanup.test.ts
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

- `rolemux worktree cleanup --parent-task <id> --workdir . --dry-run` previews cleanup targets.
- `rolemux worktree cleanup --parent-task <id> --workdir .` removes recorded worktrees.
- Cleanup only trusts `worktree.txt` paths under `.rolemux/worktrees/`.
- Cleanup does not delete task artifacts or git branches.

- [ ] **Step 2: Verify docs**

Run:

```powershell
Select-String -LiteralPath README.md -Pattern 'worktree cleanup','--parent-task','worktree.txt'
Select-String -LiteralPath docs\progress\status.md -Pattern 'Phase 5','worktree cleanup','worktree.txt'
```

Expected: patterns found.

### Task 4: Final Verification and Commit

**Files:**
- All touched files

- [ ] **Step 1: Run targeted tests**

Run:

```powershell
npx vitest run tests/core/worktree-cleanup.test.ts tests/commands/worktree-cleanup.test.ts
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

- [ ] **Step 3: Run CLI cleanup verification**

Run a temporary git repository, create an isolated worktree and matching `worktree.txt`, build the CLI, execute:

```powershell
node .\dist\cli.js worktree cleanup --parent-task parent --workdir <temp-repo> --dry-run
node .\dist\cli.js worktree cleanup --parent-task parent --workdir <temp-repo>
```

Expected: dry-run reports one `pending` target; cleanup reports one `removed` target and the worktree path no longer exists.

- [ ] **Step 4: Commit and push main**

Run:

```powershell
git add .
git commit -m "feat: 增加 dispatch worktree 清理 / add dispatch worktree cleanup"
git push origin main
```

Expected: commit and push succeed.

## Self-Review

Spec coverage:

- Worktree cleanup after dispatch/merge: Task 1 and Task 2.
- Safe path boundary for `.rolemux/worktrees/`: Task 1.
- CLI JSON result for AI/plugin callers: Task 2.
- Docs/progress: Task 3.

Deferred by design:

- Deleting git branches created for worktrees.
- Automatic cleanup after merge.
- Cleaning all parent tasks at once.
- `dispatch --resume`.
- Selective patch application.
- Planner automatic splitting.
- Herdr backend.
