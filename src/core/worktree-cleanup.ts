import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { CliError } from './cli-error.js';
import { runProcess } from './process-runner.js';

export interface WorktreeCleanupInput {
  readonly workdir: string;
  readonly parentTaskId: string;
}

export type WorktreeCleanupTargetStatus = 'pending' | 'removed' | 'missing';

export interface WorktreeCleanupTarget {
  readonly subtaskId: string;
  readonly worktreePath: string;
  readonly exists: boolean;
  readonly status: WorktreeCleanupTargetStatus;
}

export interface WorktreeCleanupResult {
  readonly status: 'dry-run' | 'cleaned';
  readonly parentTaskId: string;
  readonly parentTaskDir: string;
  readonly targets: readonly WorktreeCleanupTarget[];
  readonly warnings: readonly string[];
}

/** Loads managed dispatch worktrees from parent task artifacts without removing anything. */
export async function loadWorktreeCleanupPreview(input: WorktreeCleanupInput): Promise<WorktreeCleanupResult> {
  const workdir = resolve(input.workdir);
  const parentTaskDir = join(workdir, '.rolemux', 'tasks', input.parentTaskId);
  if (!existsSync(parentTaskDir)) {
    throw new CliError(`Parent task not found: ${input.parentTaskId}`, {
      code: 'NOT_FOUND',
      details: { parentTaskId: input.parentTaskId, parentTaskDir }
    });
  }

  const subtasksDir = join(parentTaskDir, 'subtasks');
  if (!existsSync(subtasksDir)) {
    return {
      status: 'dry-run',
      parentTaskId: input.parentTaskId,
      parentTaskDir,
      targets: [],
      warnings: [`No subtask directory found for parent task ${input.parentTaskId}.`]
    };
  }

  const targets = [];
  for (const subtaskId of await listDirectoryNames(subtasksDir)) {
    const artifactPath = join(subtasksDir, subtaskId, 'worktree.txt');
    if (!existsSync(artifactPath)) {
      continue;
    }
    const worktreePath = (await readFile(artifactPath, 'utf8')).trim();
    validateManagedWorktreePath(workdir, worktreePath);
    const exists = existsSync(worktreePath);
    targets.push({
      subtaskId,
      worktreePath,
      exists,
      status: exists ? 'pending' as const : 'missing' as const
    });
  }

  return {
    status: 'dry-run',
    parentTaskId: input.parentTaskId,
    parentTaskDir,
    targets,
    warnings: targets.length === 0 ? [`No worktree.txt artifacts found for parent task ${input.parentTaskId}.`] : []
  };
}

/** Removes existing managed dispatch worktrees while preserving task artifacts. */
export async function cleanupWorktrees(input: WorktreeCleanupInput): Promise<WorktreeCleanupResult> {
  const preview = await loadWorktreeCleanupPreview(input);
  const workdir = resolve(input.workdir);
  const targets = [];

  for (const target of preview.targets) {
    if (!target.exists) {
      targets.push({ ...target, status: 'missing' as const });
      continue;
    }

    const result = await runProcess({
      executable: 'git',
      args: ['worktree', 'remove', '--force', target.worktreePath],
      cwd: workdir
    });
    if (result.status !== 'success') {
      throw new CliError(`Failed to remove worktree for subtask: ${target.subtaskId}`, {
        code: 'WORKTREE_CLEANUP_FAILED',
        details: {
          subtaskId: target.subtaskId,
          worktreePath: target.worktreePath,
          stderr: result.stderr.trim()
        }
      });
    }
    targets.push({
      ...target,
      exists: false,
      status: 'removed' as const
    });
  }

  return {
    status: 'cleaned',
    parentTaskId: preview.parentTaskId,
    parentTaskDir: preview.parentTaskDir,
    targets,
    warnings: preview.warnings
  };
}

function validateManagedWorktreePath(workdir: string, worktreePath: string): void {
  const managedRoot = resolve(workdir, '.rolemux', 'worktrees');
  const resolvedWorktreePath = resolve(worktreePath);
  const normalizedRoot = normalizeForCompare(managedRoot.endsWith(sep) ? managedRoot : `${managedRoot}${sep}`);
  const normalizedWorktreePath = normalizeForCompare(resolvedWorktreePath);

  if (!normalizedWorktreePath.startsWith(normalizedRoot)) {
    throw new CliError('Refusing to clean a worktree outside .rolemux/worktrees.', {
      code: 'WORKTREE_CLEANUP_UNSAFE_PATH',
      details: {
        workdir,
        worktreePath,
        managedRoot
      }
    });
  }
}

function normalizeForCompare(path: string): string {
  return process.platform === 'win32' ? path.toLowerCase() : path;
}

async function listDirectoryNames(path: string): Promise<string[]> {
  const entries = await readdir(path, { withFileTypes: true });
  return entries.filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
}
