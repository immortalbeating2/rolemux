# Task Dispatch Phase 7 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 `rolemux merge` 增加显式子任务筛选，让用户可以只预览或应用指定 subtask 的 patch。

**Architecture:** Phase 7 保持 `merge` 的默认行为不变：未传筛选参数时仍读取父任务下全部 `diff.patch`。新增筛选只进入 `src/core/merge-patches.ts` 的 patch 读取和应用路径，CLI 层通过 `--subtasks one,two` 解析为字符串数组并传给 command handler；不存在的指定子任务必须抛 `NOT_FOUND`，避免静默漏合并。

**Tech Stack:** TypeScript, Node.js fs/path APIs, Commander, Vitest.

---

## Scope Decision

本计划继承大任务分发 Phase 1-6。Phase 6 已提供 `dispatch --resume` 用来读取父任务状态；Phase 7 选择下一项“选择性 patch 应用”，让用户在审阅 resume/merge preview 后可以只应用部分子任务 patch。

本阶段不做：

- 不重新运行失败 provider。
- 不自动解决 git apply conflict。
- 不删除 worktree 或 git branch。
- 不引入交互式选择 UI。

## Files

- Modify: `src/core/merge-patches.ts`
- Modify: `src/commands/merge.ts`
- Modify: `src/cli.ts`
- Modify: `tests/core/merge-patches.test.ts`
- Modify: `tests/commands/task-dispatch.test.ts`
- Modify: `README.md`
- Modify: `spec/rolemux-development-spec.md`
- Modify: `docs/progress/status.md`
- Modify: `docs/progress/timeline.md`
- Modify: `docs/progress/logs/2026-06-05.md`

## Task 1: Core Selective Patch Loading

**Files:**
- Modify: `tests/core/merge-patches.test.ts`
- Modify: `src/core/merge-patches.ts`

- [ ] **Step 1: Write failing core tests**

Add two tests to `tests/core/merge-patches.test.ts`:

```typescript
test('loads only selected subtask patch previews', async () => {
  const workdir = await mkdtemp(join(tmpdir(), 'rolemux merge selected preview '));
  await writePatchArtifact(workdir, 'parent', 'one', featurePatch());
  await writePatchArtifact(workdir, 'parent', 'two', anotherPatch());

  const preview = await loadMergePreview({
    workdir,
    parentTaskId: 'parent',
    subtasks: ['two']
  });

  expect(preview.patches.map(patch => patch.subtaskId)).toEqual(['two']);
  expect(preview.patches[0]?.files).toEqual(['another.txt']);
});

test('rejects selected subtasks that do not have patch artifacts', async () => {
  const workdir = await mkdtemp(join(tmpdir(), 'rolemux merge missing selected preview '));
  await writePatchArtifact(workdir, 'parent', 'one', featurePatch());

  await expect(loadMergePreview({
    workdir,
    parentTaskId: 'parent',
    subtasks: ['missing']
  })).rejects.toMatchObject({
    code: 'NOT_FOUND'
  });
});
```

Add helper:

```typescript
function anotherPatch(): string {
  return [
    'diff --git a/another.txt b/another.txt',
    'new file mode 100644',
    'index 0000000..f0b582a',
    '--- /dev/null',
    '+++ b/another.txt',
    '@@ -0,0 +1 @@',
    '+created by selected merge',
    ''
  ].join('\n');
}
```

- [ ] **Step 2: Run core tests to verify red**

Run:

```powershell
npx vitest run tests/core/merge-patches.test.ts
```

Expected: fail because `MergePatchInput` does not accept `subtasks`.

- [ ] **Step 3: Implement core filtering**

Modify `src/core/merge-patches.ts`:

- Add `readonly subtasks?: readonly string[] | undefined` to `MergePatchInput`.
- In `loadMergePreview`, compute target subtask names:
  - When `subtasks` is undefined or empty, keep existing behavior and inspect all subtask directories.
  - When `subtasks` has values, trim/filter duplicates and inspect only those ids.
- If a selected subtask directory or `diff.patch` is missing, throw `CliError` with `code: 'NOT_FOUND'` and details `{ parentTaskId, subtaskId, patchPath }`.
- Preserve stable order from the requested subtask list.
- `applyMergePatches` reuses `loadMergePreview(input)`, so selected apply automatically uses the same filter and preflight conflict checks.

- [ ] **Step 4: Run core tests to verify green**

Run:

```powershell
npx vitest run tests/core/merge-patches.test.ts
```

Expected: pass.

## Task 2: Command And CLI Subtask Option

**Files:**
- Modify: `tests/commands/task-dispatch.test.ts`
- Modify: `src/commands/merge.ts`
- Modify: `src/cli.ts`

- [ ] **Step 1: Write failing command tests**

Add two tests to `tests/commands/task-dispatch.test.ts`:

```typescript
test('merge dry-run previews only selected subtask patches', async () => {
  const workdir = await mkdtemp(join(tmpdir(), 'rolemux merge selected command '));
  await writePatchArtifact(workdir, 'parent', 'one', featurePatch());
  await writePatchArtifact(workdir, 'parent', 'two', anotherPatch());

  const result = await mergeCommand({
    parentTask: 'parent',
    workdir,
    dryRun: true,
    autoMerge: false,
    subtasks: ['two']
  });

  expect(result.status).toBe('dry-run');
  expect(result.patches.map(patch => patch.subtaskId)).toEqual(['two']);
  expect(result.nextCommands[0]).toContain('--subtasks two');
});

test('merge auto-merge applies only selected subtask patches', async () => {
  const workdir = await mkdtemp(join(tmpdir(), 'rolemux merge selected auto '));
  await initRepo(workdir);
  await writePatchArtifact(workdir, 'parent', 'one', featurePatch());
  await writePatchArtifact(workdir, 'parent', 'two', anotherPatch());

  const result = await mergeCommand({
    parentTask: 'parent',
    workdir,
    dryRun: false,
    autoMerge: true,
    subtasks: ['two']
  });

  expect(result.status).toBe('success');
  expect(await readFile(join(workdir, 'another.txt'), 'utf8')).toContain('created by selected merge');
  await expect(readFile(join(workdir, 'feature.txt'), 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
});
```

Add the same `anotherPatch()` helper used in the core test.

- [ ] **Step 2: Run command tests to verify red**

Run:

```powershell
npx vitest run tests/commands/task-dispatch.test.ts
```

Expected: fail because `MergeCommandOptions` does not accept `subtasks`.

- [ ] **Step 3: Implement command and CLI wiring**

Modify `src/commands/merge.ts`:

- Add `readonly subtasks?: readonly string[] | undefined` to `MergeCommandOptions`.
- Pass `subtasks` to `loadMergePreview` and `applyMergePatches`.
- Append `--subtasks ${options.subtasks.join(',')}` to the dry-run next command when subtasks are selected.

Modify `src/cli.ts`:

- Add `.option('--subtasks <subtasks>', 'comma-separated subtask ids to preview or apply')` to `merge`.
- Parse with existing `parseCsv`.
- Pass parsed array to `mergeCommand`.

- [ ] **Step 4: Run target tests to verify green**

Run:

```powershell
npx vitest run tests/core/merge-patches.test.ts tests/commands/task-dispatch.test.ts
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

Add command examples:

```powershell
rolemux merge --parent-task <parent-task-id> --workdir . --subtasks one,two --dry-run
rolemux merge --parent-task <parent-task-id> --workdir . --subtasks one,two --auto-merge
```

Document that missing selected patch artifacts return `NOT_FOUND`, and unspecified `--subtasks` preserves existing all-patch behavior.

- [ ] **Step 2: Update progress docs**

Add Phase 7 entries to status, timeline, and the 2026-06-05 log with scope, validation and risks.

## Task 4: Final Verification, Commit, Push

**Files:**
- All files touched in Tasks 1-3.

- [ ] **Step 1: Run targeted verification**

Run:

```powershell
npx vitest run tests/core/merge-patches.test.ts tests/commands/task-dispatch.test.ts
```

Expected: target tests pass.

- [ ] **Step 2: Run full verification**

Run:

```powershell
npm run typecheck
npm test
npm run build
```

Expected: typecheck, all tests and build pass.

- [ ] **Step 3: Run built CLI selective merge smoke test**

Create a temporary git repo and two patch artifacts, then run:

```powershell
node .\dist\cli.js merge --parent-task parent --workdir $workdir --subtasks two --dry-run
node .\dist\cli.js merge --parent-task parent --workdir $workdir --subtasks two --auto-merge
```

Expected:

- dry-run reports only subtask `two`.
- auto-merge creates only `another.txt`.
- `feature.txt` remains absent.

- [ ] **Step 4: Check whitespace and git status**

Run:

```powershell
git diff --check
git status --short
```

Expected: no whitespace errors; only Phase 7 files changed.

- [ ] **Step 5: Commit and push main**

Run:

```powershell
git add .
git commit -m "feat: 增加选择性 patch 合并 / add selective patch merge"
git push origin main
```

Expected: commit succeeds and `main` pushes to origin.

## Self-Review

- Spec coverage: Phase 7 implements the documented next step “选择性 patch 应用” without changing default merge semantics.
- Placeholder scan: no unresolved implementation placeholders are intentionally left in this plan.
- Type consistency: `subtasks` is an optional readonly string array from core input through command options; CLI parses comma-separated text into that array.
