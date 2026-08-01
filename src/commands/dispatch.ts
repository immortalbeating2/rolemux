import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readSubtaskManifest } from '../core/subtask-manifest.js';
import { buildWorkerPool } from '../core/worker-pool.js';
import { createDispatchArtifacts, createDispatchTaskId } from '../core/dispatch-artifacts.js';
import { buildContextPack } from '../core/context-pack.js';
import { appendMonitorEvent, ensureMonitorStore, isCancelRequested, updateMonitorAgent } from '../core/agents-monitor.js';
import { collectWorktreeDiff, createIsolatedWorktree } from '../core/git-worktree.js';
import { runWorkflow } from '../core/workflow-runner.js';
import { collectRunProvenance } from '../core/run-provenance.js';
import type { ProviderName } from '../providers/index.js';
import type { DispatchRunArtifactInput } from '../core/dispatch-artifacts.js';
import type { AgentsMonitorStore, MonitorAgentSeed } from '../core/agents-monitor.js';
import type { SubtaskDefinition, SubtaskManifest, SubtaskWritePolicy } from '../core/subtask-manifest.js';
import type { TaskRunStatus } from '../core/task-metadata.js';

export interface DispatchCommandOptions {
  readonly manifest: string;
  readonly providers: string;
  readonly workers?: number | undefined;
  readonly workdir?: string | undefined;
  readonly dryRun?: boolean | undefined;
  readonly detach?: boolean | undefined;
  readonly parentTaskId?: string | undefined;
}

export interface DispatchAssignment {
  readonly subtaskId: string;
  readonly workerId: string;
  readonly provider: ProviderName;
  readonly role: string;
  readonly writePolicy: SubtaskWritePolicy;
}

export interface DispatchCommandResult {
  readonly status: 'dry-run' | 'success' | 'failed' | 'timeout' | 'canceled' | 'started';
  readonly manifestPath: string;
  readonly workerCount: number;
  readonly assignments: readonly DispatchAssignment[];
  readonly parentTaskId?: string | undefined;
  readonly artifactDir?: string | undefined;
  readonly agentsCommand?: string | undefined;
  readonly agentsJsonCommand?: string | undefined;
  readonly agentsTuiCommand?: string | undefined;
  readonly cancelCommand?: string | undefined;
  readonly nextCommands: readonly string[];
  readonly warnings: readonly string[];
  readonly requiresUserAction: boolean;
}

/** Builds or executes a subtask dispatch plan for a provider worker pool. */
export async function dispatchCommand(options: DispatchCommandOptions): Promise<DispatchCommandResult> {
  const manifest = await readSubtaskManifest(options.manifest);
  const workers = buildWorkerPool({ providers: options.providers, workers: options.workers });
  const assignments = buildAssignments(manifest, workers);

  if (options.dryRun === true) {
    return {
      status: 'dry-run',
      manifestPath: options.manifest,
      workerCount: workers.length,
      assignments,
      nextCommands: [`rolemux dispatch --manifest ${options.manifest} --providers ${options.providers}`],
      warnings: ['Dry-run only; no provider worker was executed.'],
      requiresUserAction: true
    };
  }

  const workdir = options.workdir ?? process.cwd();
  const parentTaskId = options.parentTaskId ?? await createDispatchTaskId(workdir);
  const monitorSeeds = buildMonitorSeeds(manifest, assignments);
  if (options.detach === true) {
    const monitor = await ensureMonitorStore({
      workdir,
      parentTaskId,
      title: manifest.parentTask.title,
      manifestPath: options.manifest,
      agents: monitorSeeds
    });
    await appendMonitorEvent(monitor, { type: 'dispatch-started', message: 'detached background runner requested' });
    startDetachedDispatchRunner({
      manifest: options.manifest,
      providers: options.providers,
      workers: options.workers,
      workdir,
      parentTaskId
    });
    const agentsCommand = `rolemux agents --parent-task ${parentTaskId}`;
    const agentsJsonCommand = `${agentsCommand} --json`;
    const agentsTuiCommand = `${agentsCommand} --tui`;
    const cancelCommand = `rolemux cancel --parent-task ${parentTaskId}`;
    return {
      status: 'started',
      manifestPath: options.manifest,
      workerCount: workers.length,
      assignments,
      parentTaskId,
      artifactDir: monitor.parentTaskDir,
      agentsCommand,
      agentsJsonCommand,
      agentsTuiCommand,
      cancelCommand,
      nextCommands: [agentsCommand, cancelCommand],
      warnings: [],
      requiresUserAction: false
    };
  }
  const monitor = await ensureMonitorStore({
    workdir,
    parentTaskId,
    title: manifest.parentTask.title,
    manifestPath: options.manifest,
    agents: monitorSeeds
  });
  await appendMonitorEvent(monitor, { type: 'dispatch-running', message: 'provider dispatch started' });
  const runs = await runAssignmentsWithProviderLimits({
    manifest,
    workers,
    assignments,
    workdir,
    parentTaskId,
    monitor
  });

  const artifactRecord = await createDispatchArtifacts({
    workdir,
    parentTaskId,
    manifestPath: options.manifest,
    manifest,
    workerCount: workers.length,
    assignments,
    runs
  });
  await finalizeMonitorFromRuns(monitor, runs);

  return {
    status: artifactRecord.metadata.status,
    manifestPath: options.manifest,
    workerCount: workers.length,
    assignments,
    parentTaskId: artifactRecord.parentTaskId,
    artifactDir: artifactRecord.parentTaskDir,
    nextCommands: [`rolemux merge --parent-task ${artifactRecord.parentTaskId} --dry-run`],
    warnings: [],
    requiresUserAction: artifactRecord.metadata.status !== 'success'
  };
}

async function runDispatchAssignment(options: {
  assignment: DispatchAssignment;
  subtask: SubtaskDefinition;
  workdir: string;
  parentTaskId: string;
  signal?: AbortSignal | undefined;
}): Promise<DispatchRunArtifactInput> {
  const isolatedWorktree = options.assignment.writePolicy === 'isolated'
    ? await createIsolatedWorktree({
        workdir: options.workdir,
        parentTaskId: options.parentTaskId,
        subtaskId: options.subtask.id
      })
    : undefined;
  const contextSourceWorkdir = isolatedWorktree?.worktreePath ?? options.workdir;
  const contextPack = await buildDispatchContextPack({
    provider: options.assignment.provider,
    writePolicy: options.assignment.writePolicy,
    workdir: contextSourceWorkdir,
    allowedPaths: options.subtask.allowedPaths
  });
  const runWorkdir = contextPack === undefined ? contextSourceWorkdir : await createCodexContextPackWorkdir();
  const workflow = await runWorkflow({
    provider: options.assignment.provider,
    role: options.assignment.role,
    task: options.subtask.task,
    workdir: runWorkdir,
    ...(contextPack === undefined ? {} : { context: contextPack.context }),
    ...(options.signal === undefined ? {} : { signal: options.signal }),
    dryRun: false
  });
  const provenance = await collectRunProvenance({
    provider: options.assignment.provider,
    role: options.assignment.role,
    workdir: contextSourceWorkdir,
    prompt: workflow.prompt,
    command: workflow.command,
    structuredResult: false
  });
  const diff = isolatedWorktree === undefined ? undefined : await collectWorktreeDiff(isolatedWorktree.worktreePath);

  return {
    subtaskId: options.subtask.id,
    title: options.subtask.title,
    provider: options.assignment.provider,
    role: options.assignment.role,
    workerId: options.assignment.workerId,
    writePolicy: options.assignment.writePolicy,
    task: options.subtask.task,
    prompt: workflow.prompt,
    output: workflow.output,
    stderr: workflow.stderr,
    status: workflow.status as TaskRunStatus,
    exitCode: workflow.exitCode,
    startedAt: workflow.startedAt,
    finishedAt: workflow.finishedAt,
    durationMs: workflow.durationMs,
    provenance,
    ...(contextPack === undefined
      ? {}
      : {
          contextPack: {
            includedPaths: contextPack.includedPaths,
            skippedPaths: contextPack.skippedPaths,
            runWorkdir
          }
        }),
    ...(diff !== undefined ? { diff } : {}),
    ...(isolatedWorktree !== undefined ? { worktreePath: isolatedWorktree.worktreePath } : {})
  };
}

function buildCanceledRun(options: {
  assignment: DispatchAssignment;
  subtask: SubtaskDefinition;
}): DispatchRunArtifactInput {
  const now = new Date().toISOString();
  return {
    subtaskId: options.subtask.id,
    title: options.subtask.title,
    provider: options.assignment.provider,
    role: options.assignment.role,
    workerId: options.assignment.workerId,
    writePolicy: options.assignment.writePolicy,
    task: options.subtask.task,
    prompt: '',
    output: '',
    stderr: 'Canceled before provider execution completed.',
    status: 'canceled',
    exitCode: null,
    startedAt: now,
    finishedAt: now,
    durationMs: 0
  };
}

async function buildDispatchContextPack(options: {
  provider: ProviderName;
  writePolicy: SubtaskWritePolicy;
  workdir: string;
  allowedPaths?: readonly string[] | undefined;
}): Promise<Awaited<ReturnType<typeof buildContextPack>> | undefined> {
  if (options.provider !== 'codex' || options.writePolicy !== 'readonly' || options.allowedPaths === undefined || options.allowedPaths.length === 0) {
    return undefined;
  }

  return buildContextPack({
    workdir: options.workdir,
    allowedPaths: options.allowedPaths
  });
}

async function createCodexContextPackWorkdir(): Promise<string> {
  // Codex 会在当前目录自动吸收项目级上下文；context-pack worker 需要干净目录，只使用显式注入内容。
  return mkdtemp(join(tmpdir(), 'rolemux-codex-context-pack-'));
}

function buildAssignments(manifest: SubtaskManifest, workers: readonly { id: string; provider: ProviderName }[]): DispatchAssignment[] {
  return manifest.subtasks.map((subtask, index) => {
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
}

async function runAssignmentsWithProviderLimits(options: {
  manifest: SubtaskManifest;
  workers: readonly { id: string; provider: ProviderName }[];
  assignments: readonly DispatchAssignment[];
  workdir: string;
  parentTaskId: string;
  monitor: AgentsMonitorStore;
}): Promise<DispatchRunArtifactInput[]> {
  const providerLimits = buildProviderLimits(options.workers, options.assignments);
  const queues = groupAssignmentsByProvider(options.assignments);
  const runs: Array<DispatchRunArtifactInput | undefined> = new Array(options.assignments.length);

  await Promise.all([...queues.entries()].map(([provider, queue]) => {
    const limit = providerLimits.get(provider) ?? 1;
    return runProviderQueue({
      queue,
      limit,
      manifest: options.manifest,
      workdir: options.workdir,
      parentTaskId: options.parentTaskId,
      monitor: options.monitor,
      runs
    });
  }));

  return runs.map((run, index) => {
    if (run === undefined) {
      throw new Error(`Dispatch run missing for assignment index ${index}.`);
    }
    return run;
  });
}

function buildProviderLimits(
  workers: readonly { provider: ProviderName }[],
  assignments: readonly DispatchAssignment[]
): Map<ProviderName, number> {
  // Provider quota 是真实执行并发上限；固定 provider 子任务也进入同一 provider 队列。
  const limits = new Map<ProviderName, number>();
  for (const worker of workers) {
    limits.set(worker.provider, (limits.get(worker.provider) ?? 0) + 1);
  }
  for (const assignment of assignments) {
    if (!limits.has(assignment.provider)) {
      limits.set(assignment.provider, 1);
    }
  }
  return limits;
}

function groupAssignmentsByProvider(assignments: readonly DispatchAssignment[]): Map<ProviderName, Array<{
  assignment: DispatchAssignment;
  index: number;
}>> {
  const queues = new Map<ProviderName, Array<{ assignment: DispatchAssignment; index: number }>>();
  assignments.forEach((assignment, index) => {
    const queue = queues.get(assignment.provider) ?? [];
    queue.push({ assignment, index });
    queues.set(assignment.provider, queue);
  });
  return queues;
}

async function runProviderQueue(options: {
  queue: readonly { assignment: DispatchAssignment; index: number }[];
  limit: number;
  manifest: SubtaskManifest;
  workdir: string;
  parentTaskId: string;
  monitor: AgentsMonitorStore;
  runs: Array<DispatchRunArtifactInput | undefined>;
}): Promise<void> {
  let cursor = 0;
  const workerCount = Math.max(1, options.limit);

  await Promise.all(Array.from({ length: workerCount }, async () => {
    for (;;) {
      const current = options.queue[cursor];
      cursor += 1;
      if (current === undefined) {
        return;
      }
      const subtask = findSubtask(options.manifest, current.assignment.subtaskId);
      if (isCancelRequested(options.monitor)) {
        await appendMonitorEvent(options.monitor, {
          agentId: current.assignment.subtaskId,
          type: 'agent-canceled',
          message: 'cancel requested before provider start'
        });
        await updateMonitorAgent(options.monitor, current.assignment.subtaskId, {
          status: 'canceled',
          lastEvent: 'cancel requested before provider start'
        });
        options.runs[current.index] = buildCanceledRun({ assignment: current.assignment, subtask });
        continue;
      }
      const controller = new AbortController();
      const cancelPoll = setInterval(() => {
        if (isCancelRequested(options.monitor)) {
          controller.abort();
        }
      }, 250);
      await appendMonitorEvent(options.monitor, {
        agentId: current.assignment.subtaskId,
        type: 'agent-running',
        message: 'provider process started'
      });
      await updateMonitorAgent(options.monitor, current.assignment.subtaskId, {
        status: 'running',
        lastEvent: 'provider process started'
      });
      try {
        options.runs[current.index] = await runDispatchAssignment({
          assignment: current.assignment,
          subtask,
          workdir: options.workdir,
          parentTaskId: options.parentTaskId,
          signal: controller.signal
        });
      } finally {
        clearInterval(cancelPoll);
      }
    }
  }));
}

async function finalizeMonitorFromRuns(monitor: AgentsMonitorStore, runs: readonly DispatchRunArtifactInput[]): Promise<void> {
  for (const run of runs) {
    const status = toMonitorStatus(run.status);
    const lastEvent = status === 'success'
      ? 'output.md written'
      : status === 'canceled'
        ? 'canceled'
        : `${status} artifact written`;
    await appendMonitorEvent(monitor, {
      agentId: run.subtaskId,
      type: `agent-${status}`,
      message: lastEvent
    });
    await updateMonitorAgent(monitor, run.subtaskId, {
      status,
      lastEvent,
      hasDiff: run.diff !== undefined,
      stderrSummary: summarizeStderr(run.stderr)
    });
  }
}

function toMonitorStatus(status: TaskRunStatus): 'success' | 'failed' | 'timeout' | 'canceled' {
  if (status === 'success' || status === 'failed' || status === 'timeout' || status === 'canceled') {
    return status;
  }
  return 'failed';
}

function summarizeStderr(stderr: string): string | undefined {
  const firstLine = stderr.trim().split(/\r?\n/).find(Boolean);
  return firstLine === undefined ? undefined : firstLine.slice(0, 180);
}

function buildMonitorSeeds(manifest: SubtaskManifest, assignments: readonly DispatchAssignment[]): MonitorAgentSeed[] {
  return assignments.map(assignment => {
    const subtask = findSubtask(manifest, assignment.subtaskId);
    return {
      id: assignment.subtaskId,
      title: subtask.title,
      cli: assignment.provider,
      role: assignment.role,
      writePolicy: assignment.writePolicy
    };
  });
}

function startDetachedDispatchRunner(options: {
  readonly manifest: string;
  readonly providers: string;
  readonly workers?: number | undefined;
  readonly workdir: string;
  readonly parentTaskId: string;
}): void {
  const launch = resolveDetachedRunnerLaunch();
  const args = [
    ...launch.args,
    '_dispatch-runner',
    '--manifest',
    resolve(options.manifest),
    '--providers',
    options.providers,
    '--workdir',
    resolve(options.workdir),
    '--parent-task',
    options.parentTaskId
  ];
  if (options.workers !== undefined) {
    args.push('--workers', String(options.workers));
  }
  const child = spawn(launch.executable, args, {
    cwd: resolve(options.workdir),
    env: process.env,
    detached: true,
    shell: false,
    stdio: 'ignore',
    windowsHide: true
  });
  child.unref();
}

function resolveDetachedRunnerLaunch(): { executable: string; args: string[] } {
  const currentFile = fileURLToPath(import.meta.url);
  const distCli = join(dirname(currentFile), '..', 'cli.js');
  if (currentFile.endsWith('.js') && existsSync(distCli)) {
    return { executable: process.execPath, args: [distCli] };
  }

  const sourceCli = resolve('src', 'cli.ts');
  const tsxCli = resolve('node_modules', 'tsx', 'dist', 'cli.mjs');
  if (existsSync(sourceCli) && existsSync(tsxCli)) {
    return { executable: process.execPath, args: [tsxCli, sourceCli] };
  }

  return { executable: process.execPath, args: [distCli] };
}

function findSubtask(manifest: SubtaskManifest, subtaskId: string): SubtaskDefinition {
  const subtask = manifest.subtasks.find(item => item.id === subtaskId);
  if (subtask === undefined) {
    throw new Error(`Subtask not found: ${subtaskId}`);
  }
  return subtask;
}
