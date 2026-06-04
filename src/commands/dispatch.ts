import { readSubtaskManifest } from '../core/subtask-manifest.js';
import { buildWorkerPool } from '../core/worker-pool.js';
import { createDispatchArtifacts } from '../core/dispatch-artifacts.js';
import { CliError } from '../core/cli-error.js';
import { runWorkflow } from '../core/workflow-runner.js';
import type { ProviderName } from '../providers/index.js';
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

  assertReadonlyAssignments(assignments);

  const workdir = options.workdir ?? process.cwd();
  const runs = await Promise.all(assignments.map(async assignment => {
    const subtask = findSubtask(manifest, assignment.subtaskId);
    const workflow = await runWorkflow({
      provider: assignment.provider,
      role: assignment.role,
      task: subtask.task,
      workdir,
      dryRun: false
    });

    return {
      subtaskId: subtask.id,
      title: subtask.title,
      provider: assignment.provider,
      role: assignment.role,
      workerId: assignment.workerId,
      writePolicy: assignment.writePolicy,
      task: subtask.task,
      prompt: workflow.prompt,
      output: workflow.output,
      stderr: workflow.stderr,
      status: workflow.status as TaskRunStatus,
      exitCode: workflow.exitCode
    };
  }));

  const artifactRecord = await createDispatchArtifacts({
    workdir,
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

function assertReadonlyAssignments(assignments: readonly DispatchAssignment[]): void {
  const isolated = assignments.find(assignment => assignment.writePolicy !== 'readonly');
  if (isolated !== undefined) {
    throw new CliError('Real dispatch currently supports readonly subtasks only; isolated worktree execution is reserved for Phase 3.', {
      code: 'DISPATCH_UNSUPPORTED_WRITE_POLICY',
      details: {
        subtaskId: isolated.subtaskId,
        writePolicy: isolated.writePolicy
      }
    });
  }
}

function findSubtask(manifest: SubtaskManifest, subtaskId: string): SubtaskDefinition {
  const subtask = manifest.subtasks.find(item => item.id === subtaskId);
  if (subtask === undefined) {
    throw new Error(`Subtask not found: ${subtaskId}`);
  }
  return subtask;
}
