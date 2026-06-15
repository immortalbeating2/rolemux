# Three CLI Dispatch Plugin Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Validate that the locally installed RoleMux workflow can dispatch a read-only development-oriented task to Codex, Claude, and Agy, collect completion state, and expose plugin/provider issues through task artifacts.

**Architecture:** Use RoleMux's existing `manifest validate -> dispatch --dry-run -> dispatch -> dispatch --resume` lifecycle with a three-subtask manifest. Each subtask is pinned to one provider and uses `writePolicy: readonly` to avoid concurrent repository edits while still exercising real provider adapters and task artifact creation.

**Tech Stack:** RoleMux TypeScript CLI, Windows PowerShell, Codex CLI, Claude CLI, Agy CLI, JSON subtask manifest, `.rolemux/tasks/` artifacts.

---

## Scope

This is a validation plan, not a product feature implementation. It intentionally does not change CLI contracts, provider arguments, role prompts, or install behavior.

The test content is development-oriented: each provider receives a bounded review task about RoleMux's current provider-runner/plugin path and returns a short engineering assessment. Providers must not edit files.

## Files

- Create: `docs/superpowers/plans/2026-06-06-three-cli-dispatch-plugin-validation.md`
- Create: `docs/superpowers/plans/2026-06-06-three-cli-dispatch-plugin-validation.manifest.json`
- Create or update: `docs/progress/logs/2026-06-06.md`
- Modify: `docs/progress/status.md`
- Modify: `docs/progress/timeline.md`

Runtime artifacts are expected under `.rolemux/tasks/{parent-task-id}/` and are intentionally ignored by git.

## Test Manifest

Manifest path:

```powershell
docs\superpowers\plans\2026-06-06-three-cli-dispatch-plugin-validation.manifest.json
```

The manifest pins one subtask to each provider:

```json
{
  "version": 1,
  "parentTask": {
    "title": "Three CLI dispatch plugin validation",
    "source": "docs/superpowers/plans/2026-06-06-three-cli-dispatch-plugin-validation.md"
  },
  "defaults": {
    "role": "reviewer",
    "writePolicy": "readonly"
  },
  "subtasks": [
    {
      "id": "codex-plugin-path-review",
      "title": "Codex plugin path review",
      "provider": "codex",
      "role": "reviewer",
      "writePolicy": "readonly",
      "task": "Review the current RoleMux repository as a read-only Codex worker. Focus on whether the installed RoleMux Skill and CLI dispatch path can support a development task without editing files. Inspect AGENTS.md, docs/progress/status.md, src/core/process-runner.ts, src/providers/codex.ts, src/commands/dispatch.ts, and tests/core/process-runner.test.ts if available. Do not modify files. Return: 1. provider identity, 2. whether the task completed, 3. evidence from files or command behavior, 4. plugin/provider risks, 5. one concrete next validation."
    },
    {
      "id": "claude-plugin-path-review",
      "title": "Claude plugin path review",
      "provider": "claude",
      "role": "reviewer",
      "writePolicy": "readonly",
      "task": "Review the current RoleMux repository as a read-only Claude worker. Focus on whether the installed RoleMux Skill and CLI dispatch path can support a development task without editing files. Inspect AGENTS.md, docs/progress/status.md, src/core/process-runner.ts, src/providers/claude.ts, src/commands/dispatch.ts, and tests/core/process-runner.test.ts if available. Do not modify files. Return: 1. provider identity, 2. whether the task completed, 3. evidence from files or command behavior, 4. plugin/provider risks, 5. one concrete next validation."
    },
    {
      "id": "agy-plugin-path-review",
      "title": "Agy plugin path review",
      "provider": "agy",
      "role": "reviewer",
      "writePolicy": "readonly",
      "task": "Review the current RoleMux repository as a read-only Agy worker. Focus on whether the installed RoleMux Skill and CLI dispatch path can support a development task without editing files. Inspect AGENTS.md, docs/progress/status.md, src/core/process-runner.ts, src/providers/agy.ts, src/commands/dispatch.ts, and tests/core/process-runner.test.ts if available. Do not modify files. Return: 1. provider identity, 2. whether the task completed, 3. evidence from files or command behavior, 4. plugin/provider risks, 5. one concrete next validation."
    }
  ]
}
```

## Task 1: Baseline And Manifest Validation

**Files:**
- Read: `AGENTS.md`
- Read: `docs/progress/status.md`
- Read: `src/core/process-runner.ts`
- Read: `src/commands/dispatch.ts`
- Read: `src/core/subtask-manifest.ts`
- Write: `docs/superpowers/plans/2026-06-06-three-cli-dispatch-plugin-validation.manifest.json`

- [ ] **Step 1: Confirm current dirty worktree scope**

Run:

```powershell
git status --short
```

Expected: existing uncommitted process-runner/test/progress changes may be present; no unrelated generated secrets or provider output should be tracked.

- [ ] **Step 1a: Record provider availability**

Run:

```powershell
rolemux doctor
rolemux doctor --providers 'codex,claude,agy'
```

Expected: both commands report `ok: true` and all three selected providers are available. Quote comma-separated provider values in PowerShell.

- [ ] **Step 2: Write the manifest file**

Create the JSON manifest exactly as shown in the "Test Manifest" section.

- [ ] **Step 3: Validate manifest schema**

Run:

```powershell
rolemux manifest validate --manifest .\docs\superpowers\plans\2026-06-06-three-cli-dispatch-plugin-validation.manifest.json
```

Expected: JSON status `success`, `subtaskCount: 3`.

## Task 2: Dry-Run Dispatch Preview

**Files:**
- Read: `docs/superpowers/plans/2026-06-06-three-cli-dispatch-plugin-validation.manifest.json`
- No source writes.

- [ ] **Step 1: Run dry-run dispatch**

Run:

```powershell
rolemux dispatch --manifest .\docs\superpowers\plans\2026-06-06-three-cli-dispatch-plugin-validation.manifest.json --providers 'codex:1,claude:1,agy:1' --workdir . --dry-run
```

Expected:

- status is `dry-run`
- workerCount is `3`
- assignments include `codex-plugin-path-review -> codex`, `claude-plugin-path-review -> claude`, `agy-plugin-path-review -> agy`
- no provider worker executes

## Task 3: Real Three-Provider Dispatch

**Files:**
- Read: `docs/superpowers/plans/2026-06-06-three-cli-dispatch-plugin-validation.manifest.json`
- Runtime write: `.rolemux/tasks/{parent-task-id}/`
- No source writes expected.

- [ ] **Step 1: Run real dispatch**

Before running, capture the tracked-file state:

```powershell
git status --short
```

Run:

```powershell
rolemux dispatch --manifest .\docs\superpowers\plans\2026-06-06-three-cli-dispatch-plugin-validation.manifest.json --providers 'codex:1,claude:1,agy:1' --workdir .
```

Expected:

- command exits 0 if all providers complete
- JSON includes `parentTaskId` and `artifactDir`
- status is `success`, `failed`, or `timeout`; any non-success must be analyzed through nested subtask artifacts

After running, capture tracked-file state again:

```powershell
git status --short
```

Expected: no source changes caused by provider workers. New `.rolemux/tasks/` artifacts are ignored by git.

- [ ] **Step 2: Resume dispatch**

Run with the returned parent task id:

```powershell
rolemux dispatch --resume <parent-task-id> --workdir .
```

Expected:

- subtaskCount is `3`
- each subtask has provider, role, artifactDir, outputPath, stderrPath, status, and exitCode

## Task 4: Artifact Inspection And Plugin Issue Analysis

**Files:**
- Read: `.rolemux/tasks/{parent-task-id}/metadata.json`
- Read: `.rolemux/tasks/{parent-task-id}/subtasks/*/metadata.json`
- Read: `.rolemux/tasks/{parent-task-id}/subtasks/*/output.md`
- Read: `.rolemux/tasks/{parent-task-id}/subtasks/*/stderr.log`
- Write: `docs/progress/logs/2026-06-06.md`
- Modify: `docs/progress/status.md`
- Modify: `docs/progress/timeline.md`

- [ ] **Step 1: Inspect parent and subtask artifacts**

Run:

```powershell
Get-ChildItem -Recurse -LiteralPath .\.rolemux\tasks\<parent-task-id> -File | Select-Object FullName,Length
```

Expected: parent artifacts plus three nested subtask artifact directories.

- [ ] **Step 1a: Check prompt artifacts**

Run:

```powershell
Get-Content .\.rolemux\tasks\<parent-task-id>\subtasks\codex-plugin-path-review\prompt.md
Get-Content .\.rolemux\tasks\<parent-task-id>\subtasks\claude-plugin-path-review\prompt.md
Get-Content .\.rolemux\tasks\<parent-task-id>\subtasks\agy-plugin-path-review\prompt.md
```

Expected: each prompt includes the `reviewer` role and the task instruction `Do not modify files`.

- [ ] **Step 2: Extract completion summary**

Read each subtask `metadata.json`, `output.md`, and `stderr.log`. Record:

- provider
- role
- status
- exitCode
- output length and whether output contains the requested five-part structure
- stderr warnings or errors

- [ ] **Step 2a: Run artifact assertion summary**

Run:

```powershell
$parent = '.rolemux\tasks\<parent-task-id>'
$rows = foreach ($dir in Get-ChildItem -LiteralPath (Join-Path $parent 'subtasks') -Directory) {
  $metadata = Get-Content -LiteralPath (Join-Path $dir.FullName 'metadata.json') -Raw | ConvertFrom-Json
  $output = Get-Content -LiteralPath (Join-Path $dir.FullName 'output.md') -Raw
  $stderr = Get-Content -LiteralPath (Join-Path $dir.FullName 'stderr.log') -Raw
  $prompt = Get-Content -LiteralPath (Join-Path $dir.FullName 'prompt.md') -Raw
  [pscustomobject]@{
    Subtask = $dir.Name
    Provider = $metadata.provider
    Status = $metadata.status
    ExitCode = $metadata.exitCode
    OutputLength = ($output ?? '').Length
    StderrLength = ($stderr ?? '').Length
    PromptHasNoModify = $prompt -match 'Do not modify files'
    PromptHasReviewer = $prompt -match '# Role\s*\r?\nreviewer'
  }
}
$rows | ConvertTo-Json -Depth 5
```

Expected: three rows, all status `success`, all prompts include no-modify and reviewer markers, all outputs are non-empty. Empty output with exit code 0 must be recorded as a provider/plugin issue.

- [ ] **Step 3: Update progress records**

Append a 2026-06-06 log entry and update status/timeline with:

- commands run
- parent task id
- per-provider outcome
- plugin/provider issues found
- residual risks

## Validation Commands

Run after execution:

```powershell
npm run typecheck
npm test
git diff --check
```

Expected:

- typecheck passes
- unit tests pass
- whitespace check passes

## Self-Review

Spec coverage:

- Multi-provider RoleMux dispatch is covered by Tasks 2 and 3.
- Completion retrieval is covered by Task 3 resume and Task 4 artifact inspection.
- Plugin issue analysis is covered by Task 4.
- Safety boundaries are covered by readonly subtasks and explicit no-edit task text.

Placeholder scan:

- No TBD/TODO placeholders are present.
- All commands and paths are concrete except `<parent-task-id>`, which is runtime output by design.

Type consistency:

- Manifest uses `version`, `parentTask`, `defaults`, `subtasks`, `provider`, `role`, `writePolicy`, and `task`, matching `src/core/subtask-manifest.ts`.

## Subagent Review Notes

A read-only spec reviewer checked this plan and highlighted these risks:

- `writePolicy: readonly` is not OS-level or git-worktree isolation; it relies on prompt discipline. The plan now records `git status --short` before and after real dispatch.
- Provider availability should be recorded before real dispatch. The plan now runs `rolemux doctor` and quoted `rolemux doctor --providers 'codex,claude,agy'`.
- Artifact inspection must include `prompt.md`, not only output/stderr. The plan now checks prompts for reviewer role and no-modify text.
- Completion checks need a structured summary. The plan now includes a PowerShell assertion summary for provider/status/output/stderr/prompt markers.
