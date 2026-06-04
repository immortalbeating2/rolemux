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
