# Task Dispatch Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `rolemux dispatch` execute readonly subtasks with real provider adapters and persist parent/subtask artifacts.

**Architecture:** Keep `dispatchCommand` as the command boundary, reuse `runWorkflow()` for provider execution, and add a focused dispatch artifact store for parent task directories. This phase intentionally rejects `writePolicy=isolated` during real execution because git worktree isolation and patch collection are Phase 3.

**Tech Stack:** TypeScript, Node.js 20+, Commander, zod, Vitest, existing provider command override env vars.

---

## File Structure

- Create `src/core/dispatch-artifacts.ts`: create parent dispatch directory, write `manifest.json`, `summary.md`, parent `metadata.json`, and nested `subtasks/{id}/` artifacts.
- Modify `src/core/task-metadata.ts`: allow optional dispatch artifact fields while keeping existing run metadata compatible with `status`.
- Modify `src/core/cli-error.ts`: add `DISPATCH_UNSUPPORTED_WRITE_POLICY`.
- Modify `src/commands/dispatch.ts`: support real dispatch when `dryRun !== true`, run readonly assignments, reject isolated assignments, return parent task metadata.
- Modify `src/cli.ts`: add `--workdir` to `dispatch`.
- Modify `tests/commands/task-dispatch.test.ts`: add real dispatch tests with mock provider env override.
- Modify `README.md`, `spec/rolemux-development-spec.md`, and progress docs.

## Scope Boundary

Included:

- Real provider execution for `readonly` subtasks.
- Parent task id and parent artifact directory.
- Nested subtask artifacts: `task.md`, `prompt.md`, `output.md`, `stderr.log`, `metadata.json`.
- Parent `manifest.json`, `summary.md`, `metadata.json`.
- CLI `dispatch --workdir`.
- Mock-provider test coverage.

Excluded:

- Git worktree creation.
- `writePolicy=isolated` real execution.
- Patch collection.
- `merge --auto-merge`.
- `dispatch --resume`.
- Herdr backend.

### Task 1: Dispatch Artifact Store

**Files:**
- Create: `tests/core/dispatch-artifacts.test.ts`
- Create: `src/core/dispatch-artifacts.ts`
- Modify: `src/core/task-metadata.ts`

- [ ] **Step 1: Write failing artifact store tests**

Create `tests/core/dispatch-artifacts.test.ts`:

```typescript
import { existsSync } from 'node:fs';
import { mkdtemp, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, test } from 'vitest';
import { createDispatchArtifacts } from '../../src/core/dispatch-artifacts.js';
import { parseTaskMetadata } from '../../src/core/task-metadata.js';

describe('dispatch artifacts', () => {
  test('writes parent and subtask artifacts', async () => {
    const workdir = await mkdtemp(join(tmpdir(), 'rolemux dispatch artifacts '));
    const record = await createDispatchArtifacts({
      workdir,
      manifestPath: join(workdir, 'rolemux-tasks.json'),
      manifest: {
        version: 1,
        parentTask: { title: 'Dispatch work' },
        subtasks: [
          { id: 'one', title: 'One', role: 'builder', task: 'Do one thing.', writePolicy: 'readonly' }
        ]
      },
      workerCount: 1,
      assignments: [
        { subtaskId: 'one', workerId: 'codex-1', provider: 'codex', role: 'builder', writePolicy: 'readonly' }
      ],
      runs: [
        {
          subtaskId: 'one',
          title: 'One',
          provider: 'codex',
          role: 'builder',
          workerId: 'codex-1',
          writePolicy: 'readonly',
          task: 'Do one thing.',
          prompt: '# Role\nbuilder\n',
          output: 'MOCK_PROVIDER_OUTPUT',
          stderr: '',
          status: 'success',
          exitCode: 0
        }
      ]
    });

    expect(record.parentTaskId).toMatch(/^\d{8}T\d{6}-/);
    expect(existsSync(join(record.parentTaskDir, 'manifest.json'))).toBe(true);
    expect(existsSync(join(record.parentTaskDir, 'summary.md'))).toBe(true);
    expect(existsSync(join(record.parentTaskDir, 'subtasks', 'one', 'output.md'))).toBe(true);

    const metadata = parseTaskMetadata(JSON.parse(await readFile(join(record.parentTaskDir, 'metadata.json'), 'utf8')));
    expect(metadata.command).toBe('dispatch');
    expect(metadata.artifacts.manifest).toBe('manifest.json');
    expect(metadata.dispatch?.subtaskCount).toBe(1);
  });
});
```

- [ ] **Step 2: Run red test**

Run:

```powershell
npx vitest run tests/core/dispatch-artifacts.test.ts
```

Expected: fail because `src/core/dispatch-artifacts.ts` does not exist.

- [ ] **Step 3: Implement artifact store**

Create `src/core/dispatch-artifacts.ts` with:

- `createDispatchArtifacts(input)`.
- Parent directory under `.rolemux/tasks/{parentTaskId}`.
- Nested subtask directories under `subtasks/{subtaskId}`.
- Metadata compatible with `parseTaskMetadata()`.

- [ ] **Step 4: Run green test**

Run:

```powershell
npx vitest run tests/core/dispatch-artifacts.test.ts
```

Expected: pass.

### Task 2: Real Dispatch Command

**Files:**
- Modify: `tests/commands/task-dispatch.test.ts`
- Modify: `src/commands/dispatch.ts`
- Modify: `src/core/cli-error.ts`

- [ ] **Step 1: Write failing real dispatch tests**

Add tests that:

- set `ROLEMUX_PROVIDER_CODEX_COMMAND=process.execPath`.
- set `ROLEMUX_PROVIDER_CODEX_ARGS_PREFIX=tests/fixtures/mock-provider.mjs`.
- call `dispatchCommand({ manifest, providers: 'codex:1', workdir, dryRun: false })`.
- assert `status === 'success'`, `parentTaskId` exists, nested subtask `output.md` contains `MOCK_PROVIDER_OUTPUT`.
- assert a real dispatch containing `writePolicy: 'isolated'` rejects with `DISPATCH_UNSUPPORTED_WRITE_POLICY`.

- [ ] **Step 2: Run red test**

Run:

```powershell
npx vitest run tests/commands/task-dispatch.test.ts
```

Expected: fail because `dispatchCommand` is preview-only and has no `workdir`.

- [ ] **Step 3: Implement real dispatch**

Update `dispatchCommand`:

- Add `workdir?: string`.
- Keep dry-run behavior unchanged.
- For real execution, reject assignments with `writePolicy !== 'readonly'`.
- Run readonly assignments through `runWorkflow()`.
- Persist artifacts via `createDispatchArtifacts()`.
- Return `status`, `parentTaskId`, `artifactDir`, assignments, warnings, and `nextCommands`.

- [ ] **Step 4: Run green test**

Run:

```powershell
npx vitest run tests/commands/task-dispatch.test.ts
```

Expected: pass.

### Task 3: CLI Workdir Wiring

**Files:**
- Modify: `src/cli.ts`
- Modify: `tests/cli-smoke.test.ts` if needed

- [ ] **Step 1: Add CLI `--workdir`**

In `dispatch` command registration, add:

```typescript
.option('--workdir <workdir>', 'working directory', process.cwd())
```

Pass `workdir: options.workdir` to `dispatchCommand()`.

- [ ] **Step 2: Build and smoke dispatch**

Run:

```powershell
npm run build
node .\dist\cli.js dispatch --help
```

Expected: help includes `--workdir <workdir>`.

### Task 4: Docs and Progress

**Files:**
- Modify: `README.md`
- Modify: `spec/rolemux-development-spec.md`
- Modify: `docs/progress/status.md`
- Modify: `docs/progress/timeline.md`
- Create: `docs/progress/logs/2026-06-05.md`

- [ ] **Step 1: Update docs**

Document that:

- `dispatch` now executes readonly subtasks.
- `isolated` remains reserved for Phase 3.
- Parent/subtask artifacts are written under `.rolemux/tasks/{parent-task-id}`.

- [ ] **Step 2: Verify docs**

Run:

```powershell
Select-String -LiteralPath README.md -Pattern 'readonly','parent-task','dispatch'
Select-String -LiteralPath docs\progress\status.md -Pattern 'Phase 2','真实 dispatch'
```

Expected: patterns found.

### Task 5: Final Verification and Commit

**Files:**
- All touched files

- [ ] **Step 1: Run targeted tests**

Run:

```powershell
npx vitest run tests/core/dispatch-artifacts.test.ts tests/commands/task-dispatch.test.ts
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
git commit -m "feat: 实现 dispatch 真实执行层"
git push origin main
```

Expected: commit and push succeed.

## Self-Review

Spec coverage:

- Real readonly dispatch execution: Task 2.
- Parent/subtask artifacts: Task 1 and Task 2.
- Provider adapter reuse: Task 2.
- `--workdir`: Task 3.
- Docs/progress: Task 4.

Deferred by design:

- Git worktree isolation.
- Patch collection.
- `merge --auto-merge`.
- `dispatch --resume`.
- Herdr backend.
