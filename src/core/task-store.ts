import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { randomBytes } from 'node:crypto';
import { CliError } from './cli-error.js';
import { TaskArtifacts, TaskMetadata, TaskRunStatus, parseTaskMetadata } from './task-metadata.js';
import { renderHtmlReport } from '../report/html-report.js';

/** Input used to create a persisted task run. */
export interface CreateRunInput {
  readonly command: string;
  readonly provider?: string | undefined;
  readonly role?: string | undefined;
  readonly task: string;
  readonly prompt: string;
  readonly output: string;
  readonly stderr: string;
  readonly status: TaskRunStatus;
  readonly exitCode: number | null;
  readonly attempts?: readonly unknown[] | undefined;
  readonly startedAt?: string | undefined;
  readonly finishedAt?: string | undefined;
  readonly durationMs?: number | undefined;
}

/** Persisted task run record returned by the store. */
export interface TaskRecord {
  readonly taskId: string;
  readonly taskDir: string;
  readonly artifacts: TaskArtifacts;
  readonly metadata: TaskMetadata;
}

/** Task store API for RoleMux-managed task directories. */
export interface TaskStore {
  readonly rootDir: string;
  createRun(input: CreateRunInput): Promise<TaskRecord>;
  listRuns(limit?: number): Promise<TaskRecord[]>;
  clean(options?: { dryRun?: boolean }): Promise<{ status: 'dry-run' | 'cleaned'; paths: string[] }>;
}

/** Creates a task store rooted at workdir/.rolemux/tasks. */
export function createTaskStore(options: { workdir: string; taskDir?: string }): TaskStore {
  const workdir = resolve(options.workdir);
  const rootDir = resolve(workdir, options.taskDir ?? '.rolemux/tasks');

  return {
    rootDir,
    async createRun(input: CreateRunInput): Promise<TaskRecord> {
      await mkdir(rootDir, { recursive: true });
      const artifactStartedAt = new Date();
      const taskId = await createUniqueTaskId(rootDir, artifactStartedAt);
      const taskDir = join(rootDir, taskId);
      await mkdir(taskDir, { recursive: false });

      const reportArtifact = 'report.html';
      const artifacts: TaskArtifacts = {
        task: 'task.md',
        prompt: 'prompt.md',
        output: 'output.md',
        stderr: 'stderr.log',
        report: reportArtifact
      };

      const artifactFinishedAt = new Date();
      const timing = computeRunTiming(input, artifactStartedAt, artifactFinishedAt);
      const metadata = buildMetadata({
        input,
        taskId,
        workdir,
        startedAt: timing.startedAt,
        finishedAt: timing.finishedAt,
        durationMs: timing.durationMs,
        artifacts
      });

      await writeFile(join(taskDir, artifacts.task), input.task, 'utf8');
      await writeFile(join(taskDir, artifacts.prompt), input.prompt, 'utf8');
      await writeFile(join(taskDir, artifacts.output), input.output, 'utf8');
      await writeFile(join(taskDir, artifacts.stderr), input.stderr, 'utf8');
      const metadataJson = `${JSON.stringify(metadata, null, 2)}\n`;
      await writeFile(join(taskDir, 'metadata.json'), metadataJson, 'utf8');
      await writeFile(join(taskDir, reportArtifact), renderHtmlReport({
        title: `RoleMux ${input.command} ${taskId}`,
        status: input.status,
        taskId,
        provider: input.provider ?? '',
        role: input.role ?? '',
        task: input.task,
        output: input.output,
        stderr: input.stderr,
        metadataJson
      }), 'utf8');

      return { taskId, taskDir, artifacts, metadata };
    },
    async listRuns(limit = 20): Promise<TaskRecord[]> {
      try {
        const entries = await readdir(rootDir, { withFileTypes: true });
        const directories = entries
          .filter(entry => entry.isDirectory())
          .map(entry => entry.name)
          .sort()
          .reverse()
          .slice(0, limit);

        const records: TaskRecord[] = [];
        for (const taskId of directories) {
          const taskDir = join(rootDir, taskId);
          const metadataRaw = await readFile(join(taskDir, 'metadata.json'), 'utf8');
          const metadata = parseTaskMetadata(JSON.parse(metadataRaw));
          records.push({ taskId, taskDir, artifacts: metadata.artifacts, metadata });
        }
        return records;
      } catch (error) {
        if (isNotFoundError(error)) {
          return [];
        }
        throw error;
      }
    },
    async clean(options = {}): Promise<{ status: 'dry-run' | 'cleaned'; paths: string[] }> {
      const records = await this.listRuns(Number.MAX_SAFE_INTEGER);
      const paths = records.map(record => record.taskDir);
      if (options.dryRun) {
        return { status: 'dry-run', paths };
      }

      for (const path of paths) {
        ensureInsideRoot(rootDir, path);
        await rm(path, { recursive: true, force: true });
      }
      return { status: 'cleaned', paths };
    }
  };
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
  throw new CliError('Unable to allocate a unique task id.', { code: 'TASK_STORE_ERROR' });
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

function buildMetadata(options: {
  input: CreateRunInput;
  taskId: string;
  workdir: string;
  startedAt: Date;
  finishedAt: Date;
  durationMs: number;
  artifacts: TaskArtifacts;
}): TaskMetadata {
  const base: TaskMetadata = {
    taskId: options.taskId,
    command: options.input.command,
    workdir: options.workdir,
    startedAt: options.startedAt.toISOString(),
    finishedAt: options.finishedAt.toISOString(),
    durationMs: options.durationMs,
    exitCode: options.input.exitCode,
    status: options.input.status,
    artifacts: options.artifacts
  };

  return parseTaskMetadata({
    ...base,
    ...(options.input.provider !== undefined ? { provider: options.input.provider } : {}),
    ...(options.input.role !== undefined ? { role: options.input.role } : {}),
    ...(options.input.attempts !== undefined ? { attempts: options.input.attempts } : {})
  });
}

function computeRunTiming(
  input: CreateRunInput,
  fallbackStartedAt: Date,
  fallbackFinishedAt: Date
): { startedAt: Date; finishedAt: Date; durationMs: number } {
  const startedAt = parseOptionalDate(input.startedAt);
  const finishedAt = parseOptionalDate(input.finishedAt);
  if (startedAt === undefined || finishedAt === undefined) {
    return {
      startedAt: fallbackStartedAt,
      finishedAt: fallbackFinishedAt,
      durationMs: Math.max(0, fallbackFinishedAt.getTime() - fallbackStartedAt.getTime())
    };
  }

  return {
    startedAt,
    finishedAt,
    durationMs: input.durationMs ?? Math.max(0, finishedAt.getTime() - startedAt.getTime())
  };
}

function parseOptionalDate(value: string | undefined): Date | undefined {
  if (value === undefined) {
    return undefined;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function ensureInsideRoot(rootDir: string, path: string): void {
  const root = `${resolve(rootDir)}${sep}`;
  const target = resolve(path);
  const normalizedRoot = process.platform === 'win32' ? root.toLowerCase() : root;
  const normalizedTarget = process.platform === 'win32' ? target.toLowerCase() : target;
  if (!normalizedTarget.startsWith(normalizedRoot)) {
    throw new CliError('Refusing to clean a path outside the RoleMux task store.', {
      code: 'TASK_STORE_ERROR',
      details: { rootDir, path }
    });
  }
}

function isNotFoundError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}
