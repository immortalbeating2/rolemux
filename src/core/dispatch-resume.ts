import { access, readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { CliError } from './cli-error.js';
import { parseTaskMetadata } from './task-metadata.js';
import type { TaskRunStatus } from './task-metadata.js';

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

interface DispatchAttemptSummary {
  readonly subtaskId?: string | undefined;
  readonly title?: string | undefined;
  readonly writePolicy?: string | undefined;
}

/** Loads an existing dispatch parent task and summarizes nested subtask artifacts. */
export async function loadDispatchResume(options: LoadDispatchResumeOptions): Promise<DispatchResumeSummary> {
  const workdir = resolve(options.workdir);
  const parentTaskDir = resolve(workdir, '.rolemux', 'tasks', options.parentTaskId);
  const parentMetadataPath = join(parentTaskDir, 'metadata.json');
  const parentMetadata = parseTaskMetadata(await readJson(parentMetadataPath, options.parentTaskId));

  if (parentMetadata.command !== 'dispatch') {
    throw new CliError(`Dispatch parent task not found: ${options.parentTaskId}`, {
      code: 'NOT_FOUND',
      details: { parentTaskId: options.parentTaskId, parentTaskDir }
    });
  }

  const manifestPath = join(parentTaskDir, parentMetadata.artifacts.manifest ?? 'manifest.json');
  await readJson(manifestPath, options.parentTaskId);

  const subtasks = await loadSubtasks(parentTaskDir);
  const successCount = subtasks.filter(subtask => subtask.status === 'success').length;
  const failedCount = subtasks.filter(subtask => subtask.status === 'failed').length;
  const timeoutCount = subtasks.filter(subtask => subtask.status === 'timeout').length;
  const status: TaskRunStatus = failedCount > 0 ? 'failed' : timeoutCount > 0 ? 'timeout' : 'success';
  const nextCommands = buildNextCommands(options.parentTaskId, subtasks);
  const warnings = buildWarnings(failedCount, timeoutCount);

  return {
    status,
    parentTaskId: options.parentTaskId,
    parentTaskDir,
    manifestPath,
    subtaskCount: subtasks.length,
    successCount,
    failedCount,
    timeoutCount,
    subtasks,
    nextCommands,
    warnings,
    requiresUserAction: status !== 'success'
  };
}

async function loadSubtasks(parentTaskDir: string): Promise<DispatchResumeSubtask[]> {
  const subtaskRoot = join(parentTaskDir, 'subtasks');
  const entries = await readdir(subtaskRoot, { withFileTypes: true }).catch(error => {
    if (isNotFoundError(error)) {
      return [];
    }
    throw error;
  });
  const subtaskDirs = entries
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort((left, right) => left.localeCompare(right));

  return Promise.all(subtaskDirs.map(subtaskId => loadSubtask(parentTaskDir, subtaskId)));
}

async function loadSubtask(parentTaskDir: string, subtaskId: string): Promise<DispatchResumeSubtask> {
  const artifactDir = join(parentTaskDir, 'subtasks', subtaskId);
  const metadata = parseTaskMetadata(await readJson(join(artifactDir, 'metadata.json'), subtaskId));
  const attempt = readAttempt(metadata.attempts?.[0]);
  const outputPath = join(artifactDir, metadata.artifacts.output);
  const stderrPath = join(artifactDir, metadata.artifacts.stderr);
  const diffPath = metadata.artifacts.diff === undefined ? undefined : join(artifactDir, metadata.artifacts.diff);
  const worktreeRecordPath = metadata.artifacts.worktree === undefined ? undefined : join(artifactDir, metadata.artifacts.worktree);
  const worktreePath = worktreeRecordPath === undefined ? undefined : await readOptionalText(worktreeRecordPath);
  const hasDiff = diffPath !== undefined && await pathExists(diffPath);
  const hasWorktree = worktreePath !== undefined && worktreePath.length > 0;

  return {
    subtaskId: attempt.subtaskId ?? subtaskId,
    ...(attempt.title !== undefined ? { title: attempt.title } : {}),
    ...(metadata.provider !== undefined ? { provider: metadata.provider } : {}),
    ...(metadata.role !== undefined ? { role: metadata.role } : {}),
    ...(attempt.writePolicy !== undefined ? { writePolicy: attempt.writePolicy } : {}),
    status: metadata.status,
    exitCode: metadata.exitCode,
    artifactDir,
    outputPath,
    stderrPath,
    ...(diffPath !== undefined ? { diffPath } : {}),
    ...(worktreePath !== undefined ? { worktreePath } : {}),
    hasDiff,
    hasWorktree
  };
}

function readAttempt(value: unknown): DispatchAttemptSummary {
  if (typeof value !== 'object' || value === null) {
    return {};
  }
  const record = value as Record<string, unknown>;
  return {
    ...(typeof record.subtaskId === 'string' ? { subtaskId: record.subtaskId } : {}),
    ...(typeof record.title === 'string' ? { title: record.title } : {}),
    ...(typeof record.writePolicy === 'string' ? { writePolicy: record.writePolicy } : {})
  };
}

function buildNextCommands(parentTaskId: string, subtasks: readonly DispatchResumeSubtask[]): string[] {
  const commands: string[] = [];
  if (subtasks.some(subtask => subtask.hasDiff)) {
    commands.push(`rolemux merge --parent-task ${parentTaskId} --workdir . --dry-run`);
  }
  if (subtasks.some(subtask => subtask.hasWorktree)) {
    commands.push(`rolemux worktree cleanup --parent-task ${parentTaskId} --workdir . --dry-run`);
  }
  return commands;
}

function buildWarnings(failedCount: number, timeoutCount: number): string[] {
  if (failedCount === 0 && timeoutCount === 0) {
    return [];
  }
  return ['Some subtasks did not succeed; inspect subtask output artifacts before merging.'];
}

async function readJson(path: string, id: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as unknown;
  } catch (error) {
    if (isNotFoundError(error)) {
      throw new CliError(`Dispatch artifact not found: ${id}`, {
        code: 'NOT_FOUND',
        details: { path }
      });
    }
    throw error;
  }
}

async function readOptionalText(path: string): Promise<string | undefined> {
  try {
    return (await readFile(path, 'utf8')).trim();
  } catch (error) {
    if (isNotFoundError(error)) {
      return undefined;
    }
    throw error;
  }
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch (error) {
    if (isNotFoundError(error)) {
      return false;
    }
    throw error;
  }
}

function isNotFoundError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}
