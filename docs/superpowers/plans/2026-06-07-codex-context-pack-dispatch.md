# Codex Context Pack Dispatch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix Windows Codex multifile dispatch by prepacking allowlisted file context into the prompt so nested Codex workers do not need local file-read tools that can trigger `CryptUnprotectData failed`.

**Architecture:** Add a small context-pack core module that reads only manifest `allowedPaths` under the dispatch workdir, skips sensitive/unsafe paths, and feeds the resulting context into `runWorkflow`. Dispatch auto-applies this only for `provider=codex`, `writePolicy=readonly`, and non-empty `allowedPaths`; dangerous Codex sandbox bypass remains explicit opt-in only.

**Tech Stack:** TypeScript, Node.js fs/path APIs, Vitest, existing RoleMux dispatch artifacts.

---

### Task 1: Context Pack Core

**Files:**
- Create: `src/core/context-pack.ts`
- Test: `tests/core/context-pack.test.ts`

- [ ] **Step 1: Write failing tests**

Test `buildContextPack` with a temporary workdir containing `src/a.ts`, `.env`, and a path traversal entry. Assert the context includes `src/a.ts`, skips `.env`, and skips outside-workdir paths.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/context-pack.test.ts`
Expected: FAIL because `src/core/context-pack.ts` does not exist yet.

- [ ] **Step 3: Implement minimal module**

Export `buildContextPack({ workdir, allowedPaths })`, resolving paths under workdir, reading UTF-8 text files, limiting per-file bytes, and returning `context: string[]` plus `includedPaths`/`skippedPaths`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/core/context-pack.test.ts`
Expected: PASS.

### Task 2: Workflow Context Injection

**Files:**
- Modify: `src/core/workflow-runner.ts`
- Test: `tests/core/workflow-runner.test.ts`

- [ ] **Step 1: Write failing test**

Call `runWorkflow` in dry-run mode with `context: ['packed context']` and assert `result.prompt` contains `# Context` and the context text.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/workflow-runner.test.ts`
Expected: FAIL because `WorkflowRunInput` does not accept/pass `context`.

- [ ] **Step 3: Implement minimal input field**

Add `context?: readonly string[]` to `WorkflowRunInput` and pass it to `buildPrompt`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/core/workflow-runner.test.ts`
Expected: PASS.

### Task 3: Dispatch Codex Context Pack Routing

**Files:**
- Modify: `src/commands/dispatch.ts`
- Modify: `src/core/dispatch-artifacts.ts`
- Test: `tests/commands/task-dispatch.test.ts`

- [ ] **Step 1: Write failing dispatch test**

Create a manifest subtask with `provider: 'codex'`, `writePolicy: 'readonly'`, and `allowedPaths: ['src/target.ts']`. Use the existing mock provider and assert subtask `prompt.md` contains the packed file content and the output shows the prompt was passed to Codex.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/commands/task-dispatch.test.ts`
Expected: FAIL because dispatch ignores `allowedPaths`.

- [ ] **Step 3: Implement dispatch routing**

In `runDispatchAssignment`, call `buildContextPack` only when assignment provider is `codex`, write policy is `readonly`, and `subtask.allowedPaths` is non-empty. Pass `contextPack.context` to `runWorkflow`. Record a concise context-pack note in dispatch run metadata/attempts.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/commands/task-dispatch.test.ts`
Expected: PASS.

### Task 4: CLI Verification Scenario

**Files:**
- Create: `docs/superpowers/plans/2026-06-07-codex-context-pack-validation.manifest.json`
- Update: `docs/progress/status.md`
- Update: `docs/progress/timeline.md`
- Update: `docs/progress/logs/2026-06-07.md`

- [ ] **Step 1: Create a fixed expected-outcome manifest**

Create a multi-provider readonly validation manifest with Codex, Claude, and Agy subtasks. Codex subtask uses `allowedPaths` and asks it to report `EXPECTED_CODEX_CONTEXT_PACK_OK` if it can answer from injected context without reading files.

- [ ] **Step 2: Run dry-run and real dispatch**

Run:
`node .\dist\cli.js dispatch --manifest docs\superpowers\plans\2026-06-07-codex-context-pack-validation.manifest.json --providers 'codex:1,claude:1,agy:1' --workdir . --dry-run`
then the same command without `--dry-run`.

- [ ] **Step 3: Verify resume/artifacts**

Run `node .\dist\cli.js dispatch --resume <parentTaskId> --workdir .` and inspect subtask `prompt.md`, `output.md`, and `metadata.json`.

- [ ] **Step 4: Final verification**

Run `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e`, and `git diff --check`.
