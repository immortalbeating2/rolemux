# Task Dispatch Phase 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable `writePolicy=isolated` dispatch by running each write subtask in its own git worktree and collecting `diff.patch`.

**Architecture:** Add a focused `git-worktree` core module that owns git repository checks, worktree creation, diff collection, and cleanup-safe paths. Update `dispatchCommand` to preallocate a parent task id, create isolated worktrees before running providers, run isolated subtasks inside those worktrees, then persist `diff.patch` and `worktree.txt` in subtask artifacts.

**Tech Stack:** TypeScript, Node.js 20+, native `git` CLI via existing `runProcess()`, Vitest, mock provider fixtures.

---

## File Structure

- Create `src/core/git-worktree.ts`: git repository detection, parent worktree root, per-subtask worktree creation, diff collection.
- Modify `src/core/dispatch-artifacts.ts`: accept preallocated parent id, persist `diff.patch` and `worktree.txt`.
- Modify `src/commands/dispatch.ts`: allow `isolated` execution, route isolated subtasks to worktree workdir, collect diff after worker completion.
- Modify `src/core/cli-error.ts`: add `WORKTREE_NOT_AVAILABLE` and `WORKTREE_CREATE_FAILED`.
- Modify `tests/core/dispatch-artifacts.test.ts`: assert diff/worktree artifacts are written.
- Create `tests/core/git-worktree.test.ts`: verify worktree creation and diff collection against a temporary git repository.
- Modify `tests/commands/task-dispatch.test.ts`: replace Phase 2 isolated rejection with isolated execution in a temporary git repo.
- Modify `README.md`, `spec/rolemux-development-spec.md`, `docs/progress/status.md`, `docs/progress/timeline.md`, and create/update `docs/progress/logs/2026-06-05.md`.

## Scope Boundary

Included:

- Real `writePolicy=isolated` dispatch.
- Per-subtask git worktree creation under `.rolemux/worktrees/{parent-task-id}/{subtask-id}`.
- Provider worker runs inside the isolated worktree.
- `git diff --binary HEAD` collected into `diff.patch`.
- `worktree.txt` records the absolute worktree path.
- `readonly` dispatch behavior remains unchanged.

Excluded:

- Applying patches.
- `merge --auto-merge`.
- Automatic cleanup of worktrees.
- `dispatch --resume`.
- Herdr backend.

### Task 1: Git Worktree Core

**Files:**
- Create: `tests/core/git-worktree.test.ts`
- Create: `src/core/git-worktree.ts`
- Modify: `src/core/cli-error.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/core/git-worktree.test.ts`:

```typescript
import { existsSync } from 'node:fs';
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, test } from 'vitest';
import { collectWorktreeDiff, createIsolatedWorktree, ensureGitRepository } from '../../src/core/git-worktree.js';
import { runProcess } from '../../src/core/process-runner.js';

describe('git worktree isolation', () => {
  test('creates an isolated worktree and collects diff', async () => {
    const repo = await mkdtemp(join(tmpdir(), 'rolemux git repo '));
    await initRepo(repo);

    const worktree = await createIsolatedWorktree({
      workdir: repo,
      parentTaskId: '20260605T000000-test01',
      subtaskId: 'write-code'
    });

    expect(existsSync(worktree.worktreePath)).toBe(true);
    await writeFile(join(worktree.worktreePath, 'feature.txt'), 'created by worker\n', 'utf8');

    const diff = await collectWorktreeDiff(worktree.worktreePath);

    expect(diff).toContain('feature.txt');
    expect(diff).toContain('created by worker');
  });

  test('rejects isolated worktree creation outside a git repository', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'rolemux no git '));

    await expect(ensureGitRepository(dir)).rejects.toMatchObject({ code: 'WORKTREE_NOT_AVAILABLE' });
  });
});

async function initRepo(repo: string): Promise<void> {
  await runProcess({ executable: 'git', args: ['init'], cwd: repo });
  await runProcess({ executable: 'git', args: ['config', 'user.email', 'rolemux@example.invalid'], cwd: repo });
  await runProcess({ executable: 'git', args: ['config', 'user.name', 'RoleMux Test'], cwd: repo });
  await writeFile(join(repo, 'README.md'), 'baseline\n', 'utf8');
  await runProcess({ executable: 'git', args: ['add', 'README.md'], cwd: repo });
  await runProcess({ executable: 'git', args: ['commit', '-m', 'baseline'], cwd: repo });
  await mkdir(join(repo, '.rolemux'), { recursive: true });
}
```

- [ ] **Step 2: Run red test**

Run:

```powershell
npx vitest run tests/core/git-worktree.test.ts
```

Expected: fail because `src/core/git-worktree.ts` does not exist.

- [ ] **Step 3: Implement git worktree core**

Create `src/core/git-worktree.ts` with:

- `ensureGitRepository(workdir)`.
- `createIsolatedWorktree({ workdir, parentTaskId, subtaskId })`.
- `collectWorktreeDiff(worktreePath)`.
- Branch names formatted as `rolemux/{parentTaskId}-{subtaskId}` with unsafe chars replaced by `-`.
- Worktree paths under `.rolemux/worktrees/{parentTaskId}/{subtaskId}`.

- [ ] **Step 4: Run green test**

Run:

```powershell
npx vitest run tests/core/git-worktree.test.ts
```

Expected: pass.

### Task 2: Persist Diff and Worktree Artifacts

**Files:**
- Modify: `tests/core/dispatch-artifacts.test.ts`
- Modify: `src/core/dispatch-artifacts.ts`

- [ ] **Step 1: Write failing artifact assertions**

Update the dispatch artifact test run input with:

```typescript
diff: 'diff --git a/feature.txt b/feature.txt\n',
worktreePath: join(workdir, '.rolemux', 'worktrees', 'parent', 'one')
```

Assert:

```typescript
expect(existsSync(join(record.parentTaskDir, 'subtasks', 'one', 'diff.patch'))).toBe(true);
expect(existsSync(join(record.parentTaskDir, 'subtasks', 'one', 'worktree.txt'))).toBe(true);
```

- [ ] **Step 2: Run red test**

Run:

```powershell
npx vitest run tests/core/dispatch-artifacts.test.ts
```

Expected: fail because `diff.patch` and `worktree.txt` are not written.

- [ ] **Step 3: Implement artifact persistence**

Update `DispatchRunArtifactInput` with optional `diff` and `worktreePath`, then write:

- `diff.patch` when `diff !== undefined`.
- `worktree.txt` when `worktreePath !== undefined`.

- [ ] **Step 4: Run green test**

Run:

```powershell
npx vitest run tests/core/dispatch-artifacts.test.ts
```

Expected: pass.

### Task 3: Dispatch Isolated Execution

**Files:**
- Modify: `tests/commands/task-dispatch.test.ts`
- Modify: `src/commands/dispatch.ts`
- Modify: `src/core/dispatch-artifacts.ts`

- [ ] **Step 1: Write failing isolated dispatch test**

Replace the Phase 2 isolated rejection test with a test that:

- creates a temporary git repo.
- writes a manifest containing an isolated subtask.
- sets mock provider env vars to `tests/fixtures/write-file-provider.mjs`.
- runs `dispatchCommand({ manifest, providers: 'codex:1', workdir, dryRun: false })`.
- asserts status `success`.
- asserts nested `diff.patch` contains the file written by the mock provider.
- asserts nested `worktree.txt` exists.

- [ ] **Step 2: Create failing write-file mock provider**

Create `tests/fixtures/write-file-provider.mjs`:

```javascript
#!/usr/bin/env node

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

writeFileSync(join(process.cwd(), 'worker-output.txt'), 'created by isolated worker\n', 'utf8');
console.log('WRITE_FILE_PROVIDER_OUTPUT');
```

- [ ] **Step 3: Run red test**

Run:

```powershell
npx vitest run tests/commands/task-dispatch.test.ts
```

Expected: fail because isolated dispatch is still rejected.

- [ ] **Step 4: Implement isolated dispatch**

Update `dispatchCommand`:

- preallocate `parentTaskId`.
- for `readonly`, run with base `workdir`.
- for `isolated`, create worktree with `createIsolatedWorktree()`.
- run workflow in worktree path.
- collect diff with `collectWorktreeDiff()`.
- pass `diff` and `worktreePath` to `createDispatchArtifacts()`.

- [ ] **Step 5: Run green test**

Run:

```powershell
npx vitest run tests/commands/task-dispatch.test.ts
```

Expected: pass.

### Task 4: Docs and Progress

**Files:**
- Modify: `README.md`
- Modify: `spec/rolemux-development-spec.md`
- Modify: `docs/progress/status.md`
- Modify: `docs/progress/timeline.md`
- Modify: `docs/progress/logs/2026-06-05.md`

- [ ] **Step 1: Update docs**

Document:

- `writePolicy=isolated` now creates git worktrees.
- Diffs are collected as `subtasks/{id}/diff.patch`.
- Worktree path is recorded in `subtasks/{id}/worktree.txt`.
- Worktree cleanup and merge application remain future work.

- [ ] **Step 2: Verify docs**

Run:

```powershell
Select-String -LiteralPath README.md -Pattern 'diff.patch','worktree.txt','writePolicy=isolated'
Select-String -LiteralPath docs\progress\status.md -Pattern 'Phase 3','worktree','diff.patch'
```

Expected: patterns found.

### Task 5: Final Verification and Commit

**Files:**
- All touched files

- [ ] **Step 1: Run targeted tests**

Run:

```powershell
npx vitest run tests/core/git-worktree.test.ts tests/core/dispatch-artifacts.test.ts tests/commands/task-dispatch.test.ts
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

- [ ] **Step 3: Commit and push main**

Run:

```powershell
git add .
git commit -m "feat: 增加 dispatch worktree 隔离"
git push origin main
```

Expected: commit and push succeed.

## Self-Review

Spec coverage:

- `writePolicy=isolated` worktree execution: Task 1 and Task 3.
- Per-subtask diff collection: Task 1, Task 2, Task 3.
- Nested artifacts with `diff.patch` and `worktree.txt`: Task 2.
- Docs/progress: Task 4.

Deferred by design:

- Applying patches.
- `merge --auto-merge`.
- Worktree cleanup.
- `dispatch --resume`.
- Herdr backend.
