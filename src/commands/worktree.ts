import { cleanupWorktrees, loadWorktreeCleanupPreview } from '../core/worktree-cleanup.js';
import type { WorktreeCleanupResult } from '../core/worktree-cleanup.js';

export interface WorktreeCleanupCommandOptions {
  readonly parentTask: string;
  readonly workdir?: string | undefined;
  readonly dryRun?: boolean | undefined;
}

/** Previews or removes managed dispatch worktrees recorded by a parent task. */
export async function worktreeCleanupCommand(options: WorktreeCleanupCommandOptions): Promise<WorktreeCleanupResult> {
  const workdir = options.workdir ?? process.cwd();
  const input = { workdir, parentTaskId: options.parentTask };
  if (options.dryRun === true) {
    return loadWorktreeCleanupPreview(input);
  }
  return cleanupWorktrees(input);
}
