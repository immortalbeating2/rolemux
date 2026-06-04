# Task Dispatch Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first executable RoleMux task-dispatch slice: manifest validation, `split` normalization, `dispatch --dry-run`, and `merge --dry-run`.

**Architecture:** Add a manifest schema in `src/core/subtask-manifest.ts`, keep provider worker parsing in `src/core/worker-pool.ts`, and keep CLI command handlers thin in `src/commands/`. This phase intentionally does not run worker provider processes or create git worktrees; it creates the stable contract and dry-run surface needed before real dispatch.

**Tech Stack:** TypeScript, Node.js 20+, Commander, zod, Vitest.

---

## File Structure

- Create `src/core/subtask-manifest.ts`: manifest types, zod schema, duplicate id validation, tasks-dir normalization, JSON load/write helpers.
- Create `src/core/worker-pool.ts`: provider quota parsing and `--workers` shortcut expansion.
- Create `src/commands/manifest.ts`: `manifest validate` command handler.
- Create `src/commands/split.ts`: `split --manifest` and `split --tasks-dir` command handler.
- Create `src/commands/dispatch.ts`: `dispatch --dry-run` command handler.
- Create `src/commands/merge.ts`: `merge --dry-run` command handler.
- Modify `src/cli.ts`: register `manifest validate`, `split`, `dispatch`, and `merge`.
- Modify `src/index.ts`: export new command handlers.
- Modify `.gitignore`: ignore `AGENTS - 副本.md`.
- Create `tests/core/subtask-manifest.test.ts`: schema and normalization tests.
- Create `tests/core/worker-pool.test.ts`: provider quota and worker shortcut tests.
- Create `tests/commands/task-dispatch.test.ts`: command handler tests.
- Create `tests/fixtures/subtasks/`: markdown files used by split tests.
- Modify `README.md`: add phase-1 command examples and limitations.
- Modify `spec/rolemux-development-spec.md`: add task dispatch command contract at spec level.
- Modify `docs/progress/status.md`, `docs/progress/timeline.md`, and `docs/progress/logs/2026-06-04.md`: record implementation and verification.

## Scope Boundary

This plan implements phase 1 from `docs/superpowers/specs/2026-06-04-task-dispatch-design.md`.

Included:

- Manifest schema.
- Duplicate subtask id rejection.
- `manifest validate`.
- `split --manifest`.
- `split --tasks-dir`.
- `dispatch --dry-run`.
- `merge --dry-run`.
- Stable JSON result shapes with `nextCommands`, `warnings`, and `requiresUserAction`.

Excluded from this phase:

- Real provider worker execution.
- Git worktree creation.
- Patch collection.
- `merge --auto-merge`.
- Planner provider automatic split.
- Herdr backend.
- MCP.

### Task 1: Ignore Local AGENTS Backup

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Add exact ignore entry**

Add this line under the editor noise section:

```gitignore
AGENTS - 副本.md
```

- [ ] **Step 2: Verify backup file is ignored**

Run:

```powershell
git status --short --ignored
```

Expected:

```text
!! "AGENTS - \345\211\257\346\234\254.md"
```

The exact byte escape may vary in PowerShell output, but the file must move from `??` to ignored.

### Task 2: Manifest Schema

**Files:**
- Create: `tests/core/subtask-manifest.test.ts`
- Create: `src/core/subtask-manifest.ts`

- [ ] **Step 1: Write failing manifest schema tests**

Create `tests/core/subtask-manifest.test.ts`:

```typescript
import { mkdtemp, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, test } from 'vitest';
import {
  normalizeTasksDirectory,
  parseSubtaskManifest,
  readSubtaskManifest
} from '../../src/core/subtask-manifest.js';

describe('subtask manifest', () => {
  test('parses a valid manifest and applies default role and write policy', () => {
    const manifest = parseSubtaskManifest({
      version: 1,
      parentTask: { title: 'Dispatch work', source: 'big-task.md' },
      defaults: { role: 'builder', writePolicy: 'isolated' },
      subtasks: [
        {
          id: 'schema',
          title: 'Define schema',
          task: 'Create the manifest schema.'
        }
      ]
    });

    expect(manifest.subtasks[0]?.role).toBe('builder');
    expect(manifest.subtasks[0]?.writePolicy).toBe('isolated');
  });

  test('rejects duplicate subtask ids', () => {
    expect(() => parseSubtaskManifest({
      version: 1,
      parentTask: { title: 'Dispatch work' },
      subtasks: [
        { id: 'same', title: 'One', task: 'First task.' },
        { id: 'same', title: 'Two', task: 'Second task.' }
      ]
    })).toThrow('Duplicate subtask id: same');
  });

  test('loads manifest JSON from disk', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'rolemux manifest '));
    const manifestPath = join(dir, 'rolemux-tasks.json');
    await writeFile(manifestPath, JSON.stringify({
      version: 1,
      parentTask: { title: 'Dispatch work' },
      subtasks: [{ id: 'one', title: 'One', task: 'Do one thing.' }]
    }), 'utf8');

    const manifest = await readSubtaskManifest(manifestPath);

    expect(manifest.parentTask.title).toBe('Dispatch work');
    expect(manifest.subtasks).toHaveLength(1);
  });

  test('normalizes a tasks directory into a manifest', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'rolemux tasks dir '));
    await writeFile(join(dir, 'api-contract.md'), '# API Contract\n\nDesign CLI arguments.', 'utf8');
    await writeFile(join(dir, 'tests.md'), 'Write tests for dispatch.', 'utf8');

    const manifest = await normalizeTasksDirectory({
      tasksDir: dir,
      title: 'Directory tasks',
      source: dir
    });

    expect(manifest.subtasks.map(subtask => subtask.id)).toEqual(['api-contract', 'tests']);
    expect(manifest.subtasks[0]?.title).toBe('API Contract');
    expect(manifest.subtasks[0]?.task).toContain('Design CLI arguments.');
  });
});
```

- [ ] **Step 2: Run tests and verify red**

Run:

```powershell
npx vitest run tests/core/subtask-manifest.test.ts
```

Expected: fail because `src/core/subtask-manifest.ts` does not exist.

- [ ] **Step 3: Implement manifest core**

Create `src/core/subtask-manifest.ts`:

```typescript
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { z } from 'zod';
import { CliError } from './cli-error.js';
import type { ProviderName } from '../providers/index.js';

export type SubtaskWritePolicy = 'readonly' | 'isolated';

export interface SubtaskManifest {
  readonly version: 1;
  readonly parentTask: {
    readonly title: string;
    readonly source?: string | undefined;
  };
  readonly defaults?: {
    readonly role?: string | undefined;
    readonly writePolicy?: SubtaskWritePolicy | undefined;
  } | undefined;
  readonly subtasks: readonly SubtaskDefinition[];
}

export interface SubtaskDefinition {
  readonly id: string;
  readonly title: string;
  readonly role: string;
  readonly provider?: ProviderName | undefined;
  readonly task: string;
  readonly allowedPaths?: readonly string[] | undefined;
  readonly writePolicy: SubtaskWritePolicy;
}

export interface NormalizeTasksDirectoryInput {
  readonly tasksDir: string;
  readonly title?: string | undefined;
  readonly source?: string | undefined;
}

const providerNameSchema = z.enum(['codex', 'claude', 'agy']);
const writePolicySchema = z.enum(['readonly', 'isolated']);

const rawManifestSchema = z.object({
  version: z.literal(1),
  parentTask: z.object({
    title: z.string().min(1),
    source: z.string().min(1).optional()
  }),
  defaults: z.object({
    role: z.string().min(1).optional(),
    writePolicy: writePolicySchema.optional()
  }).optional(),
  subtasks: z.array(z.object({
    id: z.string().min(1).regex(/^[a-z0-9][a-z0-9-]*$/),
    title: z.string().min(1),
    role: z.string().min(1).optional(),
    provider: providerNameSchema.optional(),
    task: z.string().min(1),
    allowedPaths: z.array(z.string().min(1)).optional(),
    writePolicy: writePolicySchema.optional()
  })).min(1)
});

/** Parses and normalizes the stable RoleMux subtask manifest contract. */
export function parseSubtaskManifest(value: unknown): SubtaskManifest {
  const raw = rawManifestSchema.parse(value);
  const seen = new Set<string>();
  const defaultRole = raw.defaults?.role ?? 'builder';
  const defaultWritePolicy = raw.defaults?.writePolicy ?? 'readonly';

  const subtasks = raw.subtasks.map(subtask => {
    if (seen.has(subtask.id)) {
      throw new CliError(`Duplicate subtask id: ${subtask.id}`, {
        code: 'SUBTASK_ID_DUPLICATED',
        details: { id: subtask.id }
      });
    }
    seen.add(subtask.id);
    return {
      ...subtask,
      role: subtask.role ?? defaultRole,
      writePolicy: subtask.writePolicy ?? defaultWritePolicy
    };
  });

  return {
    version: raw.version,
    parentTask: raw.parentTask,
    ...(raw.defaults === undefined ? {} : { defaults: raw.defaults }),
    subtasks
  };
}

/** Reads a manifest JSON file and validates it. */
export async function readSubtaskManifest(path: string): Promise<SubtaskManifest> {
  const raw = await readFile(resolve(path), 'utf8');
  return parseSubtaskManifest(JSON.parse(raw));
}

/** Writes a normalized manifest JSON file. */
export async function writeSubtaskManifest(path: string, manifest: SubtaskManifest): Promise<void> {
  await writeFile(resolve(path), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

/** Converts a directory of markdown task files into a manifest. */
export async function normalizeTasksDirectory(input: NormalizeTasksDirectoryInput): Promise<SubtaskManifest> {
  const tasksDir = resolve(input.tasksDir);
  const entries = await readdir(tasksDir, { withFileTypes: true });
  const markdownFiles = entries
    .filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith('.md'))
    .map(entry => entry.name)
    .sort();

  const subtasks = [];
  for (const fileName of markdownFiles) {
    const taskPath = join(tasksDir, fileName);
    const task = await readFile(taskPath, 'utf8');
    const id = toSubtaskId(fileName);
    subtasks.push({
      id,
      title: extractTitle(task) ?? id,
      task
    });
  }

  return parseSubtaskManifest({
    version: 1,
    parentTask: {
      title: input.title ?? basename(tasksDir),
      source: input.source ?? tasksDir
    },
    defaults: {
      role: 'builder',
      writePolicy: 'readonly'
    },
    subtasks
  });
}

function toSubtaskId(fileName: string): string {
  return basename(fileName, '.md')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'subtask';
}

function extractTitle(markdown: string): string | undefined {
  const firstHeading = markdown.split(/\r?\n/).find(line => line.startsWith('# '));
  return firstHeading?.replace(/^#\s+/, '').trim();
}
```

- [ ] **Step 4: Run tests and verify green**

Run:

```powershell
npx vitest run tests/core/subtask-manifest.test.ts
```

Expected: pass.

### Task 3: Worker Pool Parsing

**Files:**
- Create: `tests/core/worker-pool.test.ts`
- Create: `src/core/worker-pool.ts`

- [ ] **Step 1: Write failing worker pool tests**

Create `tests/core/worker-pool.test.ts`:

```typescript
import { describe, expect, test } from 'vitest';
import { buildWorkerPool, parseProviderQuotas } from '../../src/core/worker-pool.js';

describe('worker pool', () => {
  test('parses provider quotas', () => {
    expect(parseProviderQuotas('codex:2,claude:1,agy:1')).toEqual([
      { provider: 'codex', count: 2 },
      { provider: 'claude', count: 1 },
      { provider: 'agy', count: 1 }
    ]);
  });

  test('rejects invalid provider quota values', () => {
    expect(() => parseProviderQuotas('codex:0')).toThrow('Invalid worker count for provider: codex');
    expect(() => parseProviderQuotas('nope:1')).toThrow('Unknown provider: nope');
  });

  test('expands workers shortcut by round robin provider order', () => {
    expect(buildWorkerPool({ providers: 'codex,claude', workers: 4 })).toEqual([
      { id: 'codex-1', provider: 'codex' },
      { id: 'claude-1', provider: 'claude' },
      { id: 'codex-2', provider: 'codex' },
      { id: 'claude-2', provider: 'claude' }
    ]);
  });

  test('expands explicit provider quotas into workers', () => {
    expect(buildWorkerPool({ providers: 'codex:2,agy:1' })).toEqual([
      { id: 'codex-1', provider: 'codex' },
      { id: 'codex-2', provider: 'codex' },
      { id: 'agy-1', provider: 'agy' }
    ]);
  });
});
```

- [ ] **Step 2: Run tests and verify red**

Run:

```powershell
npx vitest run tests/core/worker-pool.test.ts
```

Expected: fail because `src/core/worker-pool.ts` does not exist.

- [ ] **Step 3: Implement worker pool core**

Create `src/core/worker-pool.ts`:

```typescript
import { CliError } from './cli-error.js';
import type { ProviderName } from '../providers/index.js';

export interface ProviderQuota {
  readonly provider: ProviderName;
  readonly count: number;
}

export interface WorkerDefinition {
  readonly id: string;
  readonly provider: ProviderName;
}

export interface BuildWorkerPoolInput {
  readonly providers: string;
  readonly workers?: number | undefined;
}

/** Parses provider quota syntax like codex:2,claude:1. */
export function parseProviderQuotas(value: string): ProviderQuota[] {
  return value.split(',').map(item => item.trim()).filter(Boolean).map(item => {
    const [providerRaw, countRaw] = item.split(':');
    const provider = parseProviderName(providerRaw ?? '');
    const count = countRaw === undefined ? 1 : Number.parseInt(countRaw, 10);
    if (!Number.isInteger(count) || count < 1) {
      throw new CliError(`Invalid worker count for provider: ${provider}`, {
        code: 'WORKER_POOL_INVALID',
        details: { provider, countRaw }
      });
    }
    return { provider, count };
  });
}

/** Builds concrete worker definitions from quotas or --workers shortcut syntax. */
export function buildWorkerPool(input: BuildWorkerPoolInput): WorkerDefinition[] {
  const quotas = parseProviderQuotas(input.providers);
  if (input.workers !== undefined) {
    if (!Number.isInteger(input.workers) || input.workers < 1) {
      throw new CliError('Invalid workers value.', {
        code: 'WORKER_POOL_INVALID',
        details: { workers: input.workers }
      });
    }
    return buildRoundRobinWorkers(quotas.map(quota => quota.provider), input.workers);
  }

  const counts = new Map<ProviderName, number>();
  const workers: WorkerDefinition[] = [];
  for (const quota of quotas) {
    for (let index = 0; index < quota.count; index += 1) {
      const nextCount = (counts.get(quota.provider) ?? 0) + 1;
      counts.set(quota.provider, nextCount);
      workers.push({ id: `${quota.provider}-${nextCount}`, provider: quota.provider });
    }
  }
  return workers;
}

function buildRoundRobinWorkers(providers: ProviderName[], workersCount: number): WorkerDefinition[] {
  const counts = new Map<ProviderName, number>();
  const workers: WorkerDefinition[] = [];
  for (let index = 0; index < workersCount; index += 1) {
    const provider = providers[index % providers.length];
    if (provider === undefined) {
      throw new CliError('At least one provider is required.', { code: 'WORKER_POOL_INVALID' });
    }
    const nextCount = (counts.get(provider) ?? 0) + 1;
    counts.set(provider, nextCount);
    workers.push({ id: `${provider}-${nextCount}`, provider });
  }
  return workers;
}

function parseProviderName(value: string): ProviderName {
  if (value === 'codex' || value === 'claude' || value === 'agy') {
    return value;
  }
  throw new CliError(`Unknown provider: ${value}`, {
    code: 'WORKER_POOL_INVALID',
    details: { provider: value }
  });
}
```

- [ ] **Step 4: Run tests and verify green**

Run:

```powershell
npx vitest run tests/core/worker-pool.test.ts
```

Expected: pass.

### Task 4: Command Handlers

**Files:**
- Create: `tests/commands/task-dispatch.test.ts`
- Create: `tests/fixtures/subtasks/api-contract.md`
- Create: `tests/fixtures/subtasks/tests.md`
- Create: `src/commands/manifest.ts`
- Create: `src/commands/split.ts`
- Create: `src/commands/dispatch.ts`
- Create: `src/commands/merge.ts`

- [ ] **Step 1: Write failing command handler tests**

Create `tests/fixtures/subtasks/api-contract.md`:

```markdown
# API Contract

Define the split, dispatch, and merge command contracts.
```

Create `tests/fixtures/subtasks/tests.md`:

```markdown
# Tests

Write tests for task dispatch dry-run behavior.
```

Create `tests/commands/task-dispatch.test.ts`:

```typescript
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, test } from 'vitest';
import { dispatchCommand } from '../../src/commands/dispatch.js';
import { manifestValidateCommand } from '../../src/commands/manifest.js';
import { mergeCommand } from '../../src/commands/merge.js';
import { splitCommand } from '../../src/commands/split.js';

describe('task dispatch commands', () => {
  test('validates a manifest and reports next commands', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'rolemux manifest command '));
    const manifestPath = join(dir, 'rolemux-tasks.json');
    await writeFile(manifestPath, JSON.stringify({
      version: 1,
      parentTask: { title: 'Dispatch work' },
      subtasks: [{ id: 'one', title: 'One', task: 'Do one thing.' }]
    }), 'utf8');

    const result = await manifestValidateCommand({ manifest: manifestPath });

    expect(result.status).toBe('success');
    expect(result.subtaskCount).toBe(1);
    expect(result.nextCommands[0]).toContain('rolemux dispatch');
  });

  test('normalizes tasks-dir into a manifest file', async () => {
    const outputDir = await mkdtemp(join(tmpdir(), 'rolemux split output '));
    const out = join(outputDir, 'rolemux-tasks.json');

    const result = await splitCommand({
      tasksDir: 'tests/fixtures/subtasks',
      out,
      dryRun: false
    });

    const raw = await readFile(out, 'utf8');
    const manifest = JSON.parse(raw) as { subtasks: unknown[] };
    expect(result.status).toBe('success');
    expect(result.manifestPath).toBe(out);
    expect(manifest.subtasks).toHaveLength(2);
  });

  test('split dry-run returns the normalized manifest without writing output', async () => {
    const outputDir = await mkdtemp(join(tmpdir(), 'rolemux split dry output '));
    const out = join(outputDir, 'rolemux-tasks.json');

    const result = await splitCommand({
      tasksDir: 'tests/fixtures/subtasks',
      out,
      dryRun: true
    });

    expect(result.status).toBe('dry-run');
    expect(result.manifest.subtasks).toHaveLength(2);
    await expect(readFile(out, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
  });

  test('dispatch dry-run assigns subtasks to workers', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'rolemux dispatch command '));
    const manifestPath = join(dir, 'rolemux-tasks.json');
    await writeFile(manifestPath, JSON.stringify({
      version: 1,
      parentTask: { title: 'Dispatch work' },
      subtasks: [
        { id: 'one', title: 'One', task: 'Do one thing.' },
        { id: 'two', title: 'Two', task: 'Do another thing.' },
        { id: 'three', title: 'Three', provider: 'agy', task: 'Use fixed provider.' }
      ]
    }), 'utf8');

    const result = await dispatchCommand({
      manifest: manifestPath,
      providers: 'codex:2,claude:1',
      dryRun: true
    });

    expect(result.status).toBe('dry-run');
    expect(result.assignments.map(assignment => assignment.provider)).toEqual(['codex', 'codex', 'agy']);
    expect(result.nextCommands[0]).toContain('rolemux dispatch');
  });

  test('merge dry-run returns preview-only result', async () => {
    const result = await mergeCommand({
      parentTask: '20260604T120000-abc123',
      dryRun: true,
      autoMerge: false
    });

    expect(result.status).toBe('dry-run');
    expect(result.requiresUserAction).toBe(true);
    expect(result.nextCommands[0]).toContain('--auto-merge');
  });
});
```

- [ ] **Step 2: Run tests and verify red**

Run:

```powershell
npx vitest run tests/commands/task-dispatch.test.ts
```

Expected: fail because new command modules do not exist.

- [ ] **Step 3: Implement command handlers**

Create `src/commands/manifest.ts`:

```typescript
import { readSubtaskManifest } from '../core/subtask-manifest.js';

export interface ManifestValidateCommandOptions {
  readonly manifest: string;
}

export interface ManifestValidateCommandResult {
  readonly status: 'success';
  readonly manifestPath: string;
  readonly parentTitle: string;
  readonly subtaskCount: number;
  readonly nextCommands: readonly string[];
  readonly warnings: readonly string[];
  readonly requiresUserAction: boolean;
}

/** Validates a RoleMux subtask manifest and returns AI-friendly next commands. */
export async function manifestValidateCommand(options: ManifestValidateCommandOptions): Promise<ManifestValidateCommandResult> {
  const manifest = await readSubtaskManifest(options.manifest);
  return {
    status: 'success',
    manifestPath: options.manifest,
    parentTitle: manifest.parentTask.title,
    subtaskCount: manifest.subtasks.length,
    nextCommands: [`rolemux dispatch --manifest ${options.manifest} --providers codex:1 --dry-run`],
    warnings: [],
    requiresUserAction: false
  };
}
```

Create `src/commands/split.ts`:

```typescript
import { normalizeTasksDirectory, readSubtaskManifest, SubtaskManifest, writeSubtaskManifest } from '../core/subtask-manifest.js';

export interface SplitCommandOptions {
  readonly manifest?: string | undefined;
  readonly tasksDir?: string | undefined;
  readonly out: string;
  readonly dryRun?: boolean | undefined;
}

export interface SplitCommandResult {
  readonly status: 'dry-run' | 'success';
  readonly manifestPath: string;
  readonly manifest: SubtaskManifest;
  readonly nextCommands: readonly string[];
  readonly warnings: readonly string[];
  readonly requiresUserAction: boolean;
}

/** Normalizes supported task inputs into the stable RoleMux subtask manifest. */
export async function splitCommand(options: SplitCommandOptions): Promise<SplitCommandResult> {
  const manifest = await buildManifest(options);
  if (options.dryRun !== true) {
    await writeSubtaskManifest(options.out, manifest);
  }
  return {
    status: options.dryRun === true ? 'dry-run' : 'success',
    manifestPath: options.out,
    manifest,
    nextCommands: [`rolemux dispatch --manifest ${options.out} --providers codex:1 --dry-run`],
    warnings: [],
    requiresUserAction: options.dryRun === true
  };
}

async function buildManifest(options: SplitCommandOptions): Promise<SubtaskManifest> {
  if (options.manifest !== undefined) {
    return readSubtaskManifest(options.manifest);
  }
  if (options.tasksDir !== undefined) {
    return normalizeTasksDirectory({ tasksDir: options.tasksDir });
  }
  throw new Error('split requires --manifest or --tasks-dir');
}
```

Create `src/commands/dispatch.ts`:

```typescript
import { readSubtaskManifest } from '../core/subtask-manifest.js';
import { buildWorkerPool } from '../core/worker-pool.js';
import type { ProviderName } from '../providers/index.js';

export interface DispatchCommandOptions {
  readonly manifest: string;
  readonly providers: string;
  readonly workers?: number | undefined;
  readonly dryRun?: boolean | undefined;
}

export interface DispatchAssignment {
  readonly subtaskId: string;
  readonly workerId: string;
  readonly provider: ProviderName;
  readonly role: string;
  readonly writePolicy: string;
}

export interface DispatchCommandResult {
  readonly status: 'dry-run';
  readonly manifestPath: string;
  readonly workerCount: number;
  readonly assignments: readonly DispatchAssignment[];
  readonly nextCommands: readonly string[];
  readonly warnings: readonly string[];
  readonly requiresUserAction: boolean;
}

/** Builds a dry-run assignment plan for a subtask manifest and provider worker pool. */
export async function dispatchCommand(options: DispatchCommandOptions): Promise<DispatchCommandResult> {
  if (options.dryRun !== true) {
    throw new Error('dispatch currently supports --dry-run only');
  }
  const manifest = await readSubtaskManifest(options.manifest);
  const workers = buildWorkerPool({ providers: options.providers, workers: options.workers });
  const assignments = manifest.subtasks.map((subtask, index) => {
    const worker = workers[index % workers.length];
    if (worker === undefined) {
      throw new Error('At least one worker is required.');
    }
    const provider = subtask.provider ?? worker.provider;
    return {
      subtaskId: subtask.id,
      workerId: subtask.provider === undefined ? worker.id : `${provider}-fixed`,
      provider,
      role: subtask.role,
      writePolicy: subtask.writePolicy
    };
  });

  return {
    status: 'dry-run',
    manifestPath: options.manifest,
    workerCount: workers.length,
    assignments,
    nextCommands: [`rolemux dispatch --manifest ${options.manifest} --providers ${options.providers}`],
    warnings: ['Phase 1 dispatch is preview-only; real worker execution is not implemented yet.'],
    requiresUserAction: true
  };
}
```

Create `src/commands/merge.ts`:

```typescript
export interface MergeCommandOptions {
  readonly parentTask: string;
  readonly dryRun?: boolean | undefined;
  readonly autoMerge?: boolean | undefined;
}

export interface MergeCommandResult {
  readonly status: 'dry-run';
  readonly parentTaskId: string;
  readonly patches: readonly unknown[];
  readonly nextCommands: readonly string[];
  readonly warnings: readonly string[];
  readonly requiresUserAction: boolean;
}

/** Previews merge intent for a parent task; auto-merge is reserved for a later phase. */
export async function mergeCommand(options: MergeCommandOptions): Promise<MergeCommandResult> {
  if (options.autoMerge === true) {
    throw new Error('merge --auto-merge is not implemented in phase 1');
  }
  return {
    status: 'dry-run',
    parentTaskId: options.parentTask,
    patches: [],
    nextCommands: [`rolemux merge --parent-task ${options.parentTask} --auto-merge`],
    warnings: ['Phase 1 merge is preview-only; patch collection is not implemented yet.'],
    requiresUserAction: true
  };
}
```

- [ ] **Step 4: Run tests and verify green**

Run:

```powershell
npx vitest run tests/commands/task-dispatch.test.ts
```

Expected: pass.

### Task 5: CLI Registration

**Files:**
- Modify: `src/cli.ts`
- Modify: `src/index.ts`
- Modify: `tests/cli-smoke.test.ts`

- [ ] **Step 1: Write failing CLI smoke expectations**

In `tests/cli-smoke.test.ts`, update the command registration test to expect:

```typescript
expect(commandNames).toEqual(expect.arrayContaining([
  'install',
  'uninstall',
  'manifest',
  'split',
  'dispatch',
  'merge'
]));
```

- [ ] **Step 2: Run test and verify red**

Run:

```powershell
npx vitest run tests/cli-smoke.test.ts
```

Expected: fail because new commands are not registered.

- [ ] **Step 3: Register CLI commands**

In `src/cli.ts`, add imports:

```typescript
import { dispatchCommand } from './commands/dispatch.js';
import { manifestValidateCommand } from './commands/manifest.js';
import { mergeCommand } from './commands/merge.js';
import { splitCommand } from './commands/split.js';
```

Add command registration before `run`:

```typescript
const manifest = cli.command('manifest')
  .description('work with RoleMux subtask manifests');

manifest.command('validate')
  .description('validate a RoleMux subtask manifest')
  .requiredOption('--manifest <manifest>', 'manifest JSON path')
  .action(async options => {
    printJson(await manifestValidateCommand({ manifest: options.manifest }));
  });

cli.command('split')
  .description('normalize task inputs into a RoleMux subtask manifest')
  .option('--manifest <manifest>', 'existing manifest JSON path')
  .option('--tasks-dir <tasksDir>', 'directory of markdown subtask files')
  .requiredOption('--out <out>', 'output manifest JSON path')
  .option('--dry-run', 'preview normalized manifest without writing files')
  .action(async options => {
    printJson(await splitCommand({
      manifest: options.manifest,
      tasksDir: options.tasksDir,
      out: options.out,
      dryRun: options.dryRun === true
    }));
  });

cli.command('dispatch')
  .description('preview subtask dispatch assignments')
  .requiredOption('--manifest <manifest>', 'manifest JSON path')
  .requiredOption('--providers <providers>', 'provider quotas or provider list')
  .option('--workers <workers>', 'worker count for provider-list shortcut', parseInteger)
  .option('--dry-run', 'preview dispatch without executing providers')
  .action(async options => {
    printJson(await dispatchCommand({
      manifest: options.manifest,
      providers: options.providers,
      workers: options.workers,
      dryRun: options.dryRun === true
    }));
  });

cli.command('merge')
  .description('preview merge for a parent dispatch task')
  .requiredOption('--parent-task <parentTask>', 'parent task id')
  .option('--dry-run', 'preview merge without applying patches')
  .option('--auto-merge', 'apply clean patches automatically')
  .action(async options => {
    printJson(await mergeCommand({
      parentTask: options.parentTask,
      dryRun: options.dryRun === true,
      autoMerge: options.autoMerge === true
    }));
  });
```

In `src/index.ts`, add:

```typescript
export { dispatchCommand } from './commands/dispatch.js';
export { manifestValidateCommand } from './commands/manifest.js';
export { mergeCommand } from './commands/merge.js';
export { splitCommand } from './commands/split.js';
```

- [ ] **Step 4: Run CLI smoke test and command handler tests**

Run:

```powershell
npx vitest run tests/cli-smoke.test.ts tests/commands/task-dispatch.test.ts
```

Expected: pass.

### Task 6: Documentation and Progress

**Files:**
- Modify: `README.md`
- Modify: `spec/rolemux-development-spec.md`
- Modify: `docs/progress/status.md`
- Modify: `docs/progress/timeline.md`
- Modify: `docs/progress/logs/2026-06-04.md`

- [ ] **Step 1: Update README examples**

Add a short section after workflow command examples:

```markdown
## 大任务拆分与分发预览

RoleMux 的任务分发第一阶段提供 manifest 校验、任务目录规范化、dispatch dry-run 和 merge dry-run。

```powershell
rolemux split --tasks-dir .\tasks --out .\rolemux-tasks.json --dry-run
rolemux manifest validate --manifest .\rolemux-tasks.json
rolemux dispatch --manifest .\rolemux-tasks.json --providers codex:2,claude:1 --dry-run
rolemux merge --parent-task <parent-task-id> --dry-run
```

当前阶段不会真实启动 worker、创建 git worktree 或自动合并 patch；这些能力会在后续阶段实现。
```

- [ ] **Step 2: Update spec command list**

In `spec/rolemux-development-spec.md`, add phase-1 command bullets near the MVP/enhanced command list:

```markdown
- `rolemux manifest validate`：校验标准 subtask manifest。
- `rolemux split`：把目录或已有 manifest 规范化为标准 subtask manifest。
- `rolemux dispatch --dry-run`：预览 provider worker pool 分发结果。
- `rolemux merge --dry-run`：预览父任务 patch 合并入口。
```

- [ ] **Step 3: Update progress docs**

Record implemented phase-1 scope and verification commands in:

```text
docs/progress/status.md
docs/progress/timeline.md
docs/progress/logs/2026-06-04.md
```

- [ ] **Step 4: Run documentation checks**

Run:

```powershell
Select-String -LiteralPath README.md -Pattern 'rolemux split','rolemux dispatch','rolemux merge'
Select-String -LiteralPath spec\rolemux-development-spec.md -Pattern 'manifest validate','dispatch --dry-run','merge --dry-run'
```

Expected: each pattern is found.

### Task 7: Final Verification

**Files:**
- All files touched by Tasks 1-6

- [ ] **Step 1: Run targeted tests**

Run:

```powershell
npx vitest run tests/core/subtask-manifest.test.ts tests/core/worker-pool.test.ts tests/commands/task-dispatch.test.ts tests/cli-smoke.test.ts
```

Expected: pass.

- [ ] **Step 2: Run full verification**

Run:

```powershell
npm run typecheck
npm test
npm run build
node .\dist\cli.js split --tasks-dir .\tests\fixtures\subtasks --out .\rolemux-tasks.json --dry-run
node .\dist\cli.js dispatch --manifest .\rolemux-tasks.json --providers codex:2,claude:1 --dry-run
node .\dist\cli.js merge --parent-task 20260604T120000-abc123 --dry-run
git diff --check
```

Expected:

- Typecheck exits 0.
- All tests pass.
- Build exits 0.
- CLI dry-runs print JSON.
- `git diff --check` exits 0.

- [ ] **Step 3: Clean dry-run output if created**

If `rolemux-tasks.json` exists from a non-dry-run local check, remove it before committing.

Run:

```powershell
Test-Path -LiteralPath .\rolemux-tasks.json
```

Expected: `False` for final commit state.

- [ ] **Step 4: Commit phase 1**

Run:

```powershell
git add .gitignore src tests README.md spec docs
git commit -m "feat: 增加任务分发 dry-run 契约"
```

Expected: commit succeeds and does not include local runtime artifacts.

## Self-Review

Spec coverage:

- Manifest schema: Task 2.
- `split`: Task 4 and Task 5.
- Worker pool quotas and `--workers`: Task 3 and Task 4.
- `dispatch --dry-run`: Task 4 and Task 5.
- `merge --dry-run`: Task 4 and Task 5.
- AI-friendly JSON fields: Task 4.
- Docs/progress: Task 6.

Known phase gaps intentionally deferred:

- Real dispatch execution.
- Git worktree isolation.
- Patch collection.
- `merge --auto-merge`.
- Planner provider split.
- Herdr backend.
