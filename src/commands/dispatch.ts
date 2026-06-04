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
