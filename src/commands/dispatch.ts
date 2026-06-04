import { readSubtaskManifest } from '../core/subtask-manifest.js';
import { buildWorkerPool } from '../core/worker-pool.js';
import { createDispatchArtifacts, createDispatchTaskId } from '../core/dispatch-artifacts.js';
import { collectWorktreeDiff, createIsolatedWorktree } from '../core/git-worktree.js';
import { runWorkflow } from '../core/workflow-runner.js';
import type { ProviderName } from '../providers/index.js';
import type { DispatchRunArtifactInput } from '../core/dispatch-artifacts.js';
import type { SubtaskDefinition, SubtaskManifest, SubtaskWritePolicy } from '../core/subtask-manifest.js';
import type { TaskRunStatus } from '../core/task-metadata.js';

export interface DispatchCommandOptions {
  readonly manifest: string;
  readonly providers: string;
  readonly workers?: number | undefined;
  readonly workdir?: string | undefined;
  readonly dryRun?: boolean | undefined;
}

export interface DispatchAssignment {
  readonly subtaskId: string;
  readonly workerId: string;
  readonly provider: ProviderName;
  readonly role: string;
  readonly writePolicy: SubtaskWritePolicy;
}

export interface DispatchCommandResult {
  readonly status: 'dry-run' | 'success' | 'failed' | 'timeout';
  readonly manifestPath: string;
  readonly workerCount: number;
  readonly assignments: readonly DispatchAssignment[];
  readonly parentTaskId?: string | undefined;
  readonly artifactDir?: string | undefined;
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
  const parentTaskId = await createDispatchTaskId(workdir);
  const runs = await runAssignmentsWithProviderLimits({
    manifest,
    workers,
    assignments,
    workdir,
    parentTaskId
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
}): Promise<DispatchRunArtifactInput> {
  const isolatedWorktree = options.assignment.writePolicy === 'isolated'
    ? await createIsolatedWorktree({
        workdir: options.workdir,
        parentTaskId: options.parentTaskId,
        subtaskId: options.subtask.id
      })
    : undefined;
  const runWorkdir = isolatedWorktree?.worktreePath ?? options.workdir;
  const workflow = await runWorkflow({
    provider: options.assignment.provider,
    role: options.assignment.role,
    task: options.subtask.task,
    workdir: runWorkdir,
    dryRun: false
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
    ...(diff !== undefined ? { diff } : {}),
    ...(isolatedWorktree !== undefined ? { worktreePath: isolatedWorktree.worktreePath } : {})
  };
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
      options.runs[current.index] = await runDispatchAssignment({
        assignment: current.assignment,
        subtask,
        workdir: options.workdir,
        parentTaskId: options.parentTaskId
      });
    }
  }));
}

function findSubtask(manifest: SubtaskManifest, subtaskId: string): SubtaskDefinition {
  const subtask = manifest.subtasks.find(item => item.id === subtaskId);
  if (subtask === undefined) {
    throw new Error(`Subtask not found: ${subtaskId}`);
  }
  return subtask;
}
