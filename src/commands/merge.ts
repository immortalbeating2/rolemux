import { applyMergePatches, loadMergePreview } from '../core/merge-patches.js';
import type { MergePatchPreview } from '../core/merge-patches.js';

export interface MergeCommandOptions {
  readonly parentTask: string;
  readonly workdir?: string | undefined;
  readonly dryRun?: boolean | undefined;
  readonly autoMerge?: boolean | undefined;
  readonly subtasks?: readonly string[] | undefined;
}

export interface MergeCommandResult {
  readonly status: 'dry-run' | 'success';
  readonly parentTaskId: string;
  readonly artifactDir: string;
  readonly patches: readonly MergePatchPreview[];
  readonly nextCommands: readonly string[];
  readonly warnings: readonly string[];
  readonly requiresUserAction: boolean;
}

/** Previews or explicitly applies dispatch patch artifacts for a parent task. */
export async function mergeCommand(options: MergeCommandOptions): Promise<MergeCommandResult> {
  const workdir = options.workdir ?? process.cwd();
  if (options.autoMerge === true) {
    const result = await applyMergePatches({ workdir, parentTaskId: options.parentTask, subtasks: options.subtasks });
    return {
      status: 'success',
      parentTaskId: options.parentTask,
      artifactDir: result.parentTaskDir,
      patches: result.patches,
      nextCommands: [],
      warnings: result.warnings,
      requiresUserAction: false
    };
  }

  const preview = await loadMergePreview({ workdir, parentTaskId: options.parentTask, subtasks: options.subtasks });
  const subtaskOption = options.subtasks === undefined || options.subtasks.length === 0
    ? ''
    : ` --subtasks ${options.subtasks.join(',')}`;
  return {
    status: 'dry-run',
    parentTaskId: options.parentTask,
    artifactDir: preview.parentTaskDir,
    patches: preview.patches,
    nextCommands: [`rolemux merge --parent-task ${options.parentTask} --workdir ${workdir}${subtaskOption} --auto-merge`],
    warnings: preview.warnings,
    requiresUserAction: true
  };
}
