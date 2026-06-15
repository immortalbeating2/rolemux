import { randomBytes } from 'node:crypto';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { CliError } from './cli-error.js';
import type { SubtaskManifest, SubtaskWritePolicy } from './subtask-manifest.js';
import type { ContextPackSkippedPath } from './context-pack.js';
import type { TaskMetadata, TaskRunStatus } from './task-metadata.js';
import type { ProviderName } from '../providers/index.js';

export interface DispatchArtifactAssignment {
  readonly subtaskId: string;
  readonly workerId: string;
  readonly provider: ProviderName;
  readonly role: string;
  readonly writePolicy: string;
}

export interface DispatchRunArtifactInput {
  readonly subtaskId: string;
  readonly title: string;
  readonly provider: ProviderName;
  readonly role: string;
  readonly workerId: string;
  readonly writePolicy: SubtaskWritePolicy;
  readonly task: string;
  readonly prompt: string;
  readonly output: string;
  readonly stderr: string;
  readonly status: TaskRunStatus;
  readonly exitCode: number | null;
  readonly startedAt?: string | undefined;
  readonly finishedAt?: string | undefined;
  readonly durationMs?: number | undefined;
  readonly diff?: string | undefined;
  readonly worktreePath?: string | undefined;
  readonly contextPack?: {
    readonly includedPaths: readonly string[];
    readonly skippedPaths: readonly ContextPackSkippedPath[];
    readonly runWorkdir?: string | undefined;
  } | undefined;
}

export interface CreateDispatchArtifactsInput {
  readonly workdir: string;
  readonly parentTaskId?: string | undefined;
  readonly manifestPath: string;
  readonly manifest: SubtaskManifest;
  readonly workerCount: number;
  readonly assignments: readonly DispatchArtifactAssignment[];
  readonly runs: readonly DispatchRunArtifactInput[];
}

export interface DispatchArtifactRecord {
  readonly parentTaskId: string;
  readonly parentTaskDir: string;
  readonly metadata: TaskMetadata;
}

/** Writes parent and nested subtask artifacts for a dispatch workflow. */
export async function createDispatchArtifacts(input: CreateDispatchArtifactsInput): Promise<DispatchArtifactRecord> {
  const workdir = resolve(input.workdir);
  const rootDir = resolve(workdir, '.rolemux/tasks');
  await mkdir(rootDir, { recursive: true });
  const artifactStartedAt = new Date();
  const parentTaskId = input.parentTaskId ?? await createUniqueTaskId(rootDir, artifactStartedAt);
  const parentTaskDir = join(rootDir, parentTaskId);
  await mkdir(parentTaskDir, { recursive: true });

  const summary = renderSummary(input);
  const parentOutput = input.runs.map(run => `## ${run.subtaskId}\n\n${run.output}`).join('\n\n');
  const parentStderr = input.runs.map(run => run.stderr).filter(Boolean).join('\n\n');
  const artifactFinishedAt = new Date();
  const timing = computeDispatchTiming(input.runs, artifactStartedAt, artifactFinishedAt);
  const metadata = buildDispatchMetadata({
    input,
    parentTaskId,
    workdir,
    startedAt: timing.startedAt,
    finishedAt: timing.finishedAt
  });

  await writeFile(join(parentTaskDir, 'manifest.json'), `${JSON.stringify(input.manifest, null, 2)}\n`, 'utf8');
  await writeFile(join(parentTaskDir, 'summary.md'), summary, 'utf8');
  await writeFile(join(parentTaskDir, 'task.md'), input.manifest.parentTask.title, 'utf8');
  await writeFile(join(parentTaskDir, 'prompt.md'), `# Dispatch\n${input.manifest.parentTask.title}\n`, 'utf8');
  await writeFile(join(parentTaskDir, 'output.md'), parentOutput, 'utf8');
  await writeFile(join(parentTaskDir, 'stderr.log'), parentStderr, 'utf8');
  await writeFile(join(parentTaskDir, 'metadata.json'), `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');

  for (const run of input.runs) {
    const subtaskDir = join(parentTaskDir, 'subtasks', run.subtaskId);
    await mkdir(subtaskDir, { recursive: true });
    const runTiming = computeRunTiming(run, timing.startedAt, timing.finishedAt);
    const subtaskMetadata = buildSubtaskMetadata({
      run,
      parentTaskId,
      workdir,
      startedAt: runTiming.startedAt,
      finishedAt: runTiming.finishedAt,
      durationMs: runTiming.durationMs
    });
    await writeFile(join(subtaskDir, 'task.md'), run.task, 'utf8');
    await writeFile(join(subtaskDir, 'prompt.md'), run.prompt, 'utf8');
    await writeFile(join(subtaskDir, 'output.md'), run.output, 'utf8');
    await writeFile(join(subtaskDir, 'stderr.log'), run.stderr, 'utf8');
    if (run.diff !== undefined) {
      await writeFile(join(subtaskDir, 'diff.patch'), run.diff, 'utf8');
    }
    if (run.worktreePath !== undefined) {
      await writeFile(join(subtaskDir, 'worktree.txt'), `${run.worktreePath}\n`, 'utf8');
    }
    await writeFile(join(subtaskDir, 'metadata.json'), `${JSON.stringify(subtaskMetadata, null, 2)}\n`, 'utf8');
  }

  return {
    parentTaskId,
    parentTaskDir,
    metadata
  };
}

/** Allocates a dispatch parent task id before child worktrees need the stable id. */
export async function createDispatchTaskId(workdir: string): Promise<string> {
  const rootDir = resolve(workdir, '.rolemux/tasks');
  await mkdir(rootDir, { recursive: true });
  return createUniqueTaskId(rootDir, new Date());
}

function buildDispatchMetadata(options: {
  input: CreateDispatchArtifactsInput;
  parentTaskId: string;
  workdir: string;
  startedAt: Date;
  finishedAt: Date;
}): TaskMetadata {
  const successCount = options.input.runs.filter(run => run.status === 'success').length;
  const failedCount = options.input.runs.filter(run => run.status === 'failed').length;
  const timeoutCount = options.input.runs.filter(run => run.status === 'timeout').length;
  const canceledCount = options.input.runs.filter(run => run.status === 'canceled').length;
  const status: TaskRunStatus = failedCount > 0
    ? 'failed'
    : timeoutCount > 0
      ? 'timeout'
      : canceledCount > 0
        ? 'canceled'
        : 'success';

  return {
    taskId: options.parentTaskId,
    command: 'dispatch',
    workdir: options.workdir,
    startedAt: options.startedAt.toISOString(),
    finishedAt: options.finishedAt.toISOString(),
    durationMs: Math.max(0, options.finishedAt.getTime() - options.startedAt.getTime()),
    exitCode: failedCount > 0 || timeoutCount > 0 ? 1 : 0,
    status,
    artifacts: {
      task: 'task.md',
      prompt: 'prompt.md',
      output: 'output.md',
      stderr: 'stderr.log',
      manifest: 'manifest.json',
      summary: 'summary.md'
    },
    dispatch: {
      manifestPath: options.input.manifestPath,
      workerCount: options.input.workerCount,
      subtaskCount: options.input.runs.length,
      successCount,
      failedCount,
      timeoutCount
    }
  };
}

function buildSubtaskMetadata(options: {
  run: DispatchRunArtifactInput;
  parentTaskId: string;
  workdir: string;
  startedAt: Date;
  finishedAt: Date;
  durationMs: number;
}): TaskMetadata {
  return {
    taskId: `${options.parentTaskId}/${options.run.subtaskId}`,
    command: 'dispatch-subtask',
    provider: options.run.provider,
    role: options.run.role,
    workdir: options.workdir,
    startedAt: options.startedAt.toISOString(),
    finishedAt: options.finishedAt.toISOString(),
    durationMs: options.durationMs,
    exitCode: options.run.exitCode,
    status: options.run.status,
    artifacts: {
      task: 'task.md',
      prompt: 'prompt.md',
      output: 'output.md',
      stderr: 'stderr.log',
      ...(options.run.diff !== undefined ? { diff: 'diff.patch' } : {}),
      ...(options.run.worktreePath !== undefined ? { worktree: 'worktree.txt' } : {})
    },
    attempts: [
      {
        subtaskId: options.run.subtaskId,
        title: options.run.title,
        workerId: options.run.workerId,
        writePolicy: options.run.writePolicy,
        ...(options.run.contextPack !== undefined ? { contextPack: options.run.contextPack } : {}),
        ...(options.run.worktreePath !== undefined ? { worktreePath: options.run.worktreePath } : {}),
        ...(options.run.diff !== undefined ? { hasDiff: true } : {})
      }
    ]
  };
}

function computeDispatchTiming(
  runs: readonly DispatchRunArtifactInput[],
  fallbackStartedAt: Date,
  fallbackFinishedAt: Date
): { startedAt: Date; finishedAt: Date } {
  const timings = runs
    .map(run => computeRunTiming(run, fallbackStartedAt, fallbackFinishedAt))
    .filter(timing => timing.fromRun);

  if (timings.length === 0) {
    return { startedAt: fallbackStartedAt, finishedAt: fallbackFinishedAt };
  }

  const startedAt = new Date(Math.min(...timings.map(timing => timing.startedAt.getTime())));
  const finishedAt = new Date(Math.max(...timings.map(timing => timing.finishedAt.getTime())));
  return { startedAt, finishedAt };
}

function computeRunTiming(
  run: DispatchRunArtifactInput,
  fallbackStartedAt: Date,
  fallbackFinishedAt: Date
): { startedAt: Date; finishedAt: Date; durationMs: number; fromRun: boolean } {
  const startedAt = parseOptionalDate(run.startedAt);
  const finishedAt = parseOptionalDate(run.finishedAt);
  if (startedAt === undefined || finishedAt === undefined) {
    return {
      startedAt: fallbackStartedAt,
      finishedAt: fallbackFinishedAt,
      durationMs: Math.max(0, fallbackFinishedAt.getTime() - fallbackStartedAt.getTime()),
      fromRun: false
    };
  }

  return {
    startedAt,
    finishedAt,
    durationMs: run.durationMs ?? Math.max(0, finishedAt.getTime() - startedAt.getTime()),
    fromRun: true
  };
}

function parseOptionalDate(value: string | undefined): Date | undefined {
  if (value === undefined) {
    return undefined;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function renderSummary(input: CreateDispatchArtifactsInput): string {
  const lines = [
    `# ${input.manifest.parentTask.title}`,
    '',
    `Manifest: ${input.manifestPath}`,
    `Workers: ${input.workerCount}`,
    '',
    '## Subtasks',
    ''
  ];

  for (const run of input.runs) {
    lines.push(`- ${run.subtaskId}: ${run.status} via ${run.provider} (${run.workerId})`);
  }

  return `${lines.join('\n')}\n`;
}

async function createUniqueTaskId(rootDir: string, date: Date): Promise<string> {
  const prefix = formatTaskTimestamp(date);
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const taskId = `${prefix}-${randomBytes(3).toString('hex')}`;
    try {
      await readdir(join(rootDir, taskId));
    } catch (error) {
      if (isNotFoundError(error)) {
        return taskId;
      }
      throw error;
    }
  }
  throw new CliError('Unable to allocate a unique dispatch task id.', { code: 'TASK_STORE_ERROR' });
}

function formatTaskTimestamp(date: Date): string {
  const pad = (value: number): string => String(value).padStart(2, '0');
  return [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate()),
    'T',
    pad(date.getUTCHours()),
    pad(date.getUTCMinutes()),
    pad(date.getUTCSeconds())
  ].join('');
}

function isNotFoundError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}
