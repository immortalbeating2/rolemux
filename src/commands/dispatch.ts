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
  const runs = await Promise.all(assignments.map(assignment => {
    const subtask = findSubtask(manifest, assignment.subtaskId);
    return runDispatchAssignment({ assignment, subtask, workdir, parentTaskId });
  }));

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

function findSubtask(manifest: SubtaskManifest, subtaskId: string): SubtaskDefinition {
  const subtask = manifest.subtasks.find(item => item.id === subtaskId);
  if (subtask === undefined) {
    throw new Error(`Subtask not found: ${subtaskId}`);
  }
  return subtask;
}
