# Task Dispatch Phase 8 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复 Phase 1-7 审查发现的 worker 执行语义和 merge 安全边界问题，并固化完整 worker E2E 验收。

**Architecture:** `dispatch` 保持现有 manifest、worker pool、artifact 结构不变，但真实执行从全量 `Promise.all` 改为按 provider 配额限流的队列执行。`merge` 在 command 层拒绝冲突参数，在 CLI 层拒绝空 `--subtasks`，避免 dry-run 写入和 malformed 参数退化为全量合并。

**Tech Stack:** TypeScript, Node.js process/fs/path APIs, Commander, Vitest.

---

## Scope Decision

Phase 8 优先修复 subagent 审查发现的 Critical/Important 问题：

- 真实 worker 并发必须受 `codex:1`、`codex:2` 等 provider quota 限制。
- `merge --dry-run --auto-merge` 必须拒绝，不得写入。
- 空或全逗号 `--subtasks` 必须拒绝，不得退化为全量 patch。
- 新增一条完整 CLI E2E 覆盖 `manifest validate -> dispatch -> resume -> merge --subtasks -> cleanup dry-run`。

本阶段不做：

- 不实现失败 subtask 重新执行。
- 不实现 worktree branch 删除。
- 不改变 provider adapter 参数。
- 不把 readonly 变成 OS 级只读沙箱；readonly 仍依赖任务/role 约束，写代码类任务应使用 `isolated`。

## Files

- Create: `tests/fixtures/slow-provider.mjs`
- Create: `tests/e2e/worker-dispatch-flow.test.ts`
- Modify: `src/commands/dispatch.ts`
- Modify: `src/commands/merge.ts`
- Modify: `src/cli.ts`
- Modify: `src/core/merge-patches.ts`
- Modify: `tests/commands/task-dispatch.test.ts`
- Modify: `tests/core/merge-patches.test.ts`
- Modify: `README.md`
- Modify: `spec/rolemux-development-spec.md`
- Modify: `docs/progress/status.md`
- Modify: `docs/progress/timeline.md`
- Modify: `docs/progress/logs/2026-06-05.md`

## Task 1: Worker Concurrency Limit

**Files:**
- Create: `tests/fixtures/slow-provider.mjs`
- Modify: `tests/commands/task-dispatch.test.ts`
- Modify: `src/commands/dispatch.ts`

- [ ] **Step 1: Add a slow provider fixture**

Create `tests/fixtures/slow-provider.mjs` that appends JSON lines to `ROLEMUX_SLOW_PROVIDER_LOG`, sleeps for `ROLEMUX_SLOW_PROVIDER_DELAY_MS`, and exits successfully.

- [ ] **Step 2: Write failing dispatch concurrency tests**

Add tests to `tests/commands/task-dispatch.test.ts`:

- `dispatch respects codex:1 concurrency limit`
- `dispatch respects codex:2 concurrency limit`

Each test uses four readonly subtasks, points Codex to `slow-provider.mjs`, runs `dispatchCommand`, reads the JSONL events, and asserts the computed max concurrent provider processes is `1` or `<= 2`.

- [ ] **Step 3: Run tests to verify red**

Run:

```powershell
npx vitest run tests/commands/task-dispatch.test.ts
```

Expected: concurrency tests fail because current dispatch starts all subtasks with `Promise.all`.

- [ ] **Step 4: Implement provider-limited dispatch queue**

Modify `src/commands/dispatch.ts`:

- Build provider limits from worker pool counts.
- Treat fixed provider subtasks as using that provider's quota; if provider is not in the pool, use limit `1`.
- Execute assignments through per-provider queues with preallocated result positions to preserve result order.
- Keep dry-run behavior unchanged.

- [ ] **Step 5: Run tests to verify green**

Run:

```powershell
npx vitest run tests/commands/task-dispatch.test.ts
```

Expected: pass.

## Task 2: Merge Safety Argument Guards

**Files:**
- Modify: `tests/commands/task-dispatch.test.ts`
- Modify: `tests/core/merge-patches.test.ts`
- Modify: `src/commands/merge.ts`
- Modify: `src/core/merge-patches.ts`
- Modify: `src/cli.ts`

- [ ] **Step 1: Write failing safety tests**

Add command tests:

- `merge rejects dry-run with auto-merge`
- `merge rejects empty selected subtasks`

Add core test:

- `loadMergePreview rejects an explicitly empty selected subtask list`

- [ ] **Step 2: Run tests to verify red**

Run:

```powershell
npx vitest run tests/core/merge-patches.test.ts tests/commands/task-dispatch.test.ts
```

Expected: tests fail because current behavior allows `dryRun + autoMerge` and treats empty selected subtasks as unselected.

- [ ] **Step 3: Implement safety guards**

Modify `src/commands/merge.ts`:

- Throw `CliError` with `INVALID_ARGUMENT` when `dryRun === true && autoMerge === true`.
- Throw `CliError` with `INVALID_ARGUMENT` when `subtasks` is an empty array.

Modify `src/core/merge-patches.ts`:

- Treat an explicitly empty `subtasks` array as `INVALID_ARGUMENT`.

Modify `src/cli.ts`:

- Parse `--subtasks` with a merge-specific parser that rejects empty input, `,`, and whitespace-only comma lists.

- [ ] **Step 4: Run tests to verify green**

Run:

```powershell
npx vitest run tests/core/merge-patches.test.ts tests/commands/task-dispatch.test.ts
```

Expected: pass.

## Task 3: Full Worker CLI E2E

**Files:**
- Create: `tests/e2e/worker-dispatch-flow.test.ts`

- [ ] **Step 1: Write failing E2E test**

Add an E2E test that uses built `dist/cli.js` in a temp git repo:

1. Create manifest with one readonly Claude subtask and one isolated Codex subtask.
2. Use `mock-provider.mjs` for Claude and `write-file-provider.mjs` for Codex.
3. Run `manifest validate`.
4. Run real `dispatch`.
5. Run `dispatch --resume`.
6. Run `merge --subtasks write --dry-run`.
7. Run `merge --subtasks write --auto-merge`.
8. Run `worktree cleanup --dry-run`.
9. Assert `worker-output.txt` exists only after merge and cleanup finds a target.

- [ ] **Step 2: Run E2E to verify red or green**

Run:

```powershell
npm run build
npx vitest run --config vitest.e2e.config.ts tests/e2e/worker-dispatch-flow.test.ts
```

Expected: after Tasks 1-2 this should pass; before the fixes it may fail on the Phase 8 safety gaps.

## Task 4: Documentation And Progress

**Files:**
- Modify: `README.md`
- Modify: `spec/rolemux-development-spec.md`
- Modify: `docs/progress/status.md`
- Modify: `docs/progress/timeline.md`
- Modify: `docs/progress/logs/2026-06-05.md`

- [ ] **Step 1: Update docs**

Document:

- Provider quotas now limit real concurrent provider executions.
- `--dry-run` and `--auto-merge` are mutually exclusive.
- Empty `--subtasks` is invalid.
- Full worker E2E exists for dispatch/resume/selective merge/cleanup.

- [ ] **Step 2: Update progress trace**

Add Phase 8 entries with TDD red/green verification and final validation results.

## Task 5: Final Verification

**Files:**
- All touched files.

- [ ] **Step 1: Run targeted verification**

```powershell
npx vitest run tests/commands/task-dispatch.test.ts tests/core/merge-patches.test.ts
```

- [ ] **Step 2: Run full verification**

```powershell
npm run typecheck
npm test
npm run test:e2e
npm run build
npm pack --dry-run
git diff --check
```

- [ ] **Step 3: Check git status**

```powershell
git status --short --branch
```

## Self-Review

- Spec coverage: Phase 8 covers the worker concurrency and merge safety issues found by subagent review.
- Placeholder scan: no unresolved implementation placeholders are intentionally left in this plan.
- Type consistency: `subtasks` remains `readonly string[] | undefined`, with explicit empty arrays rejected at command/core boundaries.
