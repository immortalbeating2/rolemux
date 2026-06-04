# Task Dispatch Phase 6 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为大任务分发链路增加 `rolemux dispatch --resume <parent-task-id>`，从既有父任务产物恢复并输出可审计状态摘要和下一步命令。

**Architecture:** Phase 6 不重新执行 provider，也不自动合并 patch；它只读取 `.rolemux/tasks/{parent-task-id}` 下的父任务 metadata、manifest 和子任务 metadata/artifact，生成稳定 JSON summary。CLI 层只负责参数分支和输出，artifact 读取、状态统计、下一步命令建议集中在 `src/core/dispatch-resume.ts`。

**Tech Stack:** TypeScript, Node.js fs/path APIs, Commander, Vitest.

---

## Scope Decision

本计划继承 2026-06-05 大任务分发 Phase 1-5，而不是重新执行旧版 M6 release plan。旧版 M6 的 README、HTML report、examples、release checklist 已在 MVP 首轮完成；当前 Phase 6 选择 Phase 5 文档中列出的下一步首项 `dispatch --resume`，用于让 AI 模型和用户能从父任务产物恢复上下文，不靠聊天记忆猜测状态。

本阶段不做：

- 不重新运行失败 provider。
- 不实现选择性 patch 应用。
- 不删除 git branch。
- 不新增 MCP 或重型 workflow engine。

## Files

- Create: `src/core/dispatch-resume.ts`
- Create: `src/commands/dispatch-resume.ts`
- Create: `tests/core/dispatch-resume.test.ts`
- Create: `tests/commands/dispatch-resume.test.ts`
- Modify: `src/cli.ts`
- Modify: `README.md`
- Modify: `spec/rolemux-development-spec.md`
- Modify: `docs/progress/status.md`
- Modify: `docs/progress/timeline.md`
- Modify: `docs/progress/logs/2026-06-05.md`

## Task 1: Core Resume Loader

**Files:**
- Create: `tests/core/dispatch-resume.test.ts`
- Create: `src/core/dispatch-resume.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/core/dispatch-resume.test.ts` with these behaviors:

```typescript
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { createDispatchArtifacts } from '../../src/core/dispatch-artifacts.js';
import { loadDispatchResume } from '../../src/core/dispatch-resume.js';
import { createTempDir, removeDir } from '../helpers/temp-dir.js';

describe('loadDispatchResume', () => {
  let workdir: string;

  beforeEach(async () => {
    workdir = await createTempDir('rolemux-dispatch-resume-');
  });

  afterEach(async () => {
    await removeDir(workdir);
  });

  test('summarizes parent dispatch artifacts and subtask artifact state', async () => {
    const manifestPath = join(workdir, 'rolemux-tasks.json');
    const manifest = {
      version: 1 as const,
      parentTask: { title: 'Resume parent' },
      subtasks: [
        {
          id: 'ok',
          title: 'Successful task',
          task: 'Write safely.',
          role: 'builder',
          writePolicy: 'isolated' as const
        },
        {
          id: 'failed',
          title: 'Failed task',
          task: 'Review safely.',
          role: 'reviewer',
          writePolicy: 'readonly' as const
        }
      ]
    };
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    const record = await createDispatchArtifacts({
      workdir,
      parentTaskId: 'parent-task',
      manifestPath,
      manifest,
      workerCount: 2,
      assignments: [
        { subtaskId: 'ok', workerId: 'codex-1', provider: 'codex', role: 'builder', writePolicy: 'isolated' },
        { subtaskId: 'failed', workerId: 'claude-1', provider: 'claude', role: 'reviewer', writePolicy: 'readonly' }
      ],
      runs: [
        {
          subtaskId: 'ok',
          title: 'Successful task',
          provider: 'codex',
          role: 'builder',
          workerId: 'codex-1',
          writePolicy: 'isolated',
          task: 'Write safely.',
          prompt: 'prompt ok',
          output: 'output ok',
          stderr: '',
          status: 'success',
          exitCode: 0,
          diff: 'diff --git a/a.txt b/a.txt\n',
          worktreePath: join(workdir, '.rolemux', 'worktrees', 'parent-task', 'ok')
        },
        {
          subtaskId: 'failed',
          title: 'Failed task',
          provider: 'claude',
          role: 'reviewer',
          workerId: 'claude-1',
          writePolicy: 'readonly',
          task: 'Review safely.',
          prompt: 'prompt failed',
          output: 'output failed',
          stderr: 'provider failed',
          status: 'failed',
          exitCode: 1
        }
      ]
    });

    const summary = await loadDispatchResume({ workdir, parentTaskId: record.parentTaskId });

    expect(summary.status).toBe('failed');
    expect(summary.parentTaskId).toBe('parent-task');
    expect(summary.subtaskCount).toBe(2);
    expect(summary.successCount).toBe(1);
    expect(summary.failedCount).toBe(1);
    expect(summary.timeoutCount).toBe(0);
    expect(summary.subtasks).toEqual([
      expect.objectContaining({
        subtaskId: 'failed',
        title: 'Failed task',
        provider: 'claude',
        role: 'reviewer',
        writePolicy: 'readonly',
        status: 'failed',
        hasDiff: false,
        hasWorktree: false
      }),
      expect.objectContaining({
        subtaskId: 'ok',
        title: 'Successful task',
        provider: 'codex',
        role: 'builder',
        writePolicy: 'isolated',
        status: 'success',
        hasDiff: true,
        hasWorktree: true
      })
    ]);
    expect(summary.nextCommands).toContain('rolemux merge --parent-task parent-task --workdir . --dry-run');
    expect(summary.nextCommands).toContain('rolemux worktree cleanup --parent-task parent-task --workdir . --dry-run');
    expect(summary.warnings).toContain('Some subtasks did not succeed; inspect subtask output artifacts before merging.');
    expect(summary.requiresUserAction).toBe(true);
  });

  test('rejects a missing parent dispatch task with a structured error', async () => {
    await mkdir(join(workdir, '.rolemux', 'tasks'), { recursive: true });

    await expect(loadDispatchResume({ workdir, parentTaskId: 'missing-parent' })).rejects.toMatchObject({
      code: 'NOT_FOUND'
    });
  });
});
```

- [ ] **Step 2: Run the core test to verify red**

Run:

```powershell
npx vitest run tests/core/dispatch-resume.test.ts
```

Expected: fail because `src/core/dispatch-resume.ts` does not exist.

- [ ] **Step 3: Implement the core loader**

Create `src/core/dispatch-resume.ts` with these exported contracts:

```typescript
export interface LoadDispatchResumeOptions {
  readonly workdir: string;
  readonly parentTaskId: string;
}

export interface DispatchResumeSubtask {
  readonly subtaskId: string;
  readonly title?: string | undefined;
  readonly provider?: string | undefined;
  readonly role?: string | undefined;
  readonly writePolicy?: string | undefined;
  readonly status: TaskRunStatus;
  readonly exitCode: number | null;
  readonly artifactDir: string;
  readonly outputPath: string;
  readonly stderrPath: string;
  readonly diffPath?: string | undefined;
  readonly worktreePath?: string | undefined;
  readonly hasDiff: boolean;
  readonly hasWorktree: boolean;
}

export interface DispatchResumeSummary {
  readonly status: TaskRunStatus;
  readonly parentTaskId: string;
  readonly parentTaskDir: string;
  readonly manifestPath: string;
  readonly subtaskCount: number;
  readonly successCount: number;
  readonly failedCount: number;
  readonly timeoutCount: number;
  readonly subtasks: readonly DispatchResumeSubtask[];
  readonly nextCommands: readonly string[];
  readonly warnings: readonly string[];
  readonly requiresUserAction: boolean;
}
```

Implementation rules:

- Resolve `workdir`, then read `.rolemux/tasks/{parentTaskId}/metadata.json`.
- Validate metadata with `parseTaskMetadata`.
- Require `metadata.command === 'dispatch'`; otherwise throw `CliError` with `code: 'NOT_FOUND'`.
- Read parent `manifest.json` only to confirm it exists and expose its path.
- Read subtask directories under `subtasks/`, sort by directory name for stable output.
- For each subtask, read and validate `metadata.json`; derive title, workerId and writePolicy from the first object in `attempts`.
- Use artifact names from metadata to build `outputPath`, `stderrPath`, `diffPath` and worktree file path.
- If `worktree.txt` exists, read the actual worktree path into `worktreePath`.
- Compute success/failed/timeout counts from subtask metadata.
- Add `rolemux merge --parent-task <id> --workdir . --dry-run` when any subtask has a diff.
- Add `rolemux worktree cleanup --parent-task <id> --workdir . --dry-run` when any subtask has a worktree.
- Add warning `Some subtasks did not succeed; inspect subtask output artifacts before merging.` when failed or timeout count is non-zero.

- [ ] **Step 4: Run the core test to verify green**

Run:

```powershell
npx vitest run tests/core/dispatch-resume.test.ts
```

Expected: pass.

## Task 2: Command And CLI Integration

**Files:**
- Create: `tests/commands/dispatch-resume.test.ts`
- Create: `src/commands/dispatch-resume.ts`
- Modify: `src/cli.ts`

- [ ] **Step 1: Write the failing command tests**

Create `tests/commands/dispatch-resume.test.ts`:

```typescript
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { dispatchResumeCommand } from '../../src/commands/dispatch-resume.js';
import { createDispatchArtifacts } from '../../src/core/dispatch-artifacts.js';
import { createTempDir, removeDir } from '../helpers/temp-dir.js';

describe('dispatchResumeCommand', () => {
  let workdir: string;

  beforeEach(async () => {
    workdir = await createTempDir('rolemux-dispatch-resume-command-');
  });

  afterEach(async () => {
    await removeDir(workdir);
  });

  test('returns a resume summary for a parent task id', async () => {
    const manifestPath = join(workdir, 'rolemux-tasks.json');
    const manifest = {
      version: 1 as const,
      parentTask: { title: 'Command resume parent' },
      subtasks: [
        {
          id: 'one',
          title: 'One',
          task: 'Read only.',
          role: 'summarizer',
          writePolicy: 'readonly' as const
        }
      ]
    };
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    await createDispatchArtifacts({
      workdir,
      parentTaskId: 'parent-task',
      manifestPath,
      manifest,
      workerCount: 1,
      assignments: [
        { subtaskId: 'one', workerId: 'codex-1', provider: 'codex', role: 'summarizer', writePolicy: 'readonly' }
      ],
      runs: [
        {
          subtaskId: 'one',
          title: 'One',
          provider: 'codex',
          role: 'summarizer',
          workerId: 'codex-1',
          writePolicy: 'readonly',
          task: 'Read only.',
          prompt: 'prompt',
          output: 'output',
          stderr: '',
          status: 'success',
          exitCode: 0
        }
      ]
    });

    const result = await dispatchResumeCommand({ parentTask: 'parent-task', workdir });

    expect(result.status).toBe('success');
    expect(result.parentTaskId).toBe('parent-task');
    expect(result.subtasks).toHaveLength(1);
    expect(result.requiresUserAction).toBe(false);
  });
});
```

- [ ] **Step 2: Run command test to verify red**

Run:

```powershell
npx vitest run tests/commands/dispatch-resume.test.ts
```

Expected: fail because `src/commands/dispatch-resume.ts` does not exist.

- [ ] **Step 3: Add command wrapper**

Create `src/commands/dispatch-resume.ts`:

```typescript
import { loadDispatchResume } from '../core/dispatch-resume.js';
import type { DispatchResumeSummary } from '../core/dispatch-resume.js';

export interface DispatchResumeCommandOptions {
  readonly parentTask: string;
  readonly workdir?: string | undefined;
}

/** Loads a dispatch parent task and returns a machine-readable resume summary. */
export async function dispatchResumeCommand(options: DispatchResumeCommandOptions): Promise<DispatchResumeSummary> {
  return loadDispatchResume({
    parentTaskId: options.parentTask,
    workdir: options.workdir ?? process.cwd()
  });
}
```

- [ ] **Step 4: Wire CLI dispatch --resume**

Modify `src/cli.ts`:

- Import `dispatchResumeCommand`.
- Change `dispatch` command options:
  - `--manifest <manifest>` is optional.
  - `--providers <providers>` is optional.
  - Add `--resume <parentTask>`.
- In action:
  - If `options.resume` exists, call `dispatchResumeCommand`.
  - Otherwise require both `options.manifest` and `options.providers`; throw `Error('dispatch requires --manifest and --providers unless --resume is used.')` if missing.
  - Existing dispatch behavior remains unchanged when manifest/providers are supplied.

- [ ] **Step 5: Run command tests to verify green**

Run:

```powershell
npx vitest run tests/core/dispatch-resume.test.ts tests/commands/dispatch-resume.test.ts tests/commands/task-dispatch.test.ts
```

Expected: pass.

## Task 3: Documentation And Progress Trace

**Files:**
- Modify: `README.md`
- Modify: `spec/rolemux-development-spec.md`
- Modify: `docs/progress/status.md`
- Modify: `docs/progress/timeline.md`
- Modify: `docs/progress/logs/2026-06-05.md`

- [ ] **Step 1: Update user-facing docs**

Add `dispatch --resume` to README and spec command examples:

```powershell
rolemux dispatch --resume <parent-task-id> --workdir .
```

Describe:

- It reads existing parent dispatch artifacts.
- It summarizes subtask status, output paths, diff/worktree presence and next commands.
- It does not rerun providers in Phase 6.

- [ ] **Step 2: Update progress docs**

Add Phase 6 entries to:

- `docs/progress/status.md`
- `docs/progress/timeline.md`
- `docs/progress/logs/2026-06-05.md`

The entries must include implementation scope, verification commands, risks and next recommendations.

## Task 4: Final Verification, Commit, Push

**Files:**
- All files touched in Tasks 1-3.

- [ ] **Step 1: Run targeted verification**

Run:

```powershell
npx vitest run tests/core/dispatch-resume.test.ts tests/commands/dispatch-resume.test.ts tests/commands/task-dispatch.test.ts
```

Expected: all target tests pass.

- [ ] **Step 2: Run full verification**

Run:

```powershell
npm run typecheck
npm test
npm run build
```

Expected: typecheck, all tests and build pass.

- [ ] **Step 3: Run built CLI smoke test**

Create a temporary workdir with a minimal parent dispatch artifact, then run:

```powershell
node .\dist\cli.js dispatch --resume parent --workdir $workdir
```

Expected:

- JSON status is `success`.
- `parentTaskId` is `parent`.
- `subtaskCount` is `1`.

- [ ] **Step 4: Check whitespace and git status**

Run:

```powershell
git diff --check
git status --short
```

Expected: no whitespace errors; only Phase 6 files changed.

- [ ] **Step 5: Commit and push main**

Run:

```powershell
git add .
git commit -m "feat: 增加 dispatch resume 摘要 / add dispatch resume summary"
git push origin main
```

Expected: commit succeeds and `main` pushes to origin.

## Self-Review

- Spec coverage: Phase 6 implements the documented next step `dispatch --resume` and keeps merge/worktree cleanup commands as next-command suggestions.
- Placeholder scan: no `TBD`, `TODO`, `implement later`, or unspecified edge-case instructions remain in this plan.
- Type consistency: command option uses `parentTask`; core option uses `parentTaskId`; output fields match `DispatchResumeSummary`.
