import { mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { CliError } from './cli-error.js';
import { runProcess } from './process-runner.js';

export interface CreateIsolatedWorktreeInput {
  readonly workdir: string;
  readonly parentTaskId: string;
  readonly subtaskId: string;
}

export interface IsolatedWorktree {
  readonly branchName: string;
  readonly worktreePath: string;
}

/** Ensures isolated dispatch can use git worktree features in the target directory. */
export async function ensureGitRepository(workdir: string): Promise<void> {
  const result = await runProcess({
    executable: 'git',
    args: ['rev-parse', '--is-inside-work-tree'],
    cwd: workdir
  });

  if (result.status !== 'success' || result.stdout.trim() !== 'true') {
    throw new CliError('Isolated dispatch requires a git work tree.', {
      code: 'WORKTREE_NOT_AVAILABLE',
      details: {
        workdir,
        stderr: result.stderr.trim()
      }
    });
  }
}

/** Creates a per-subtask git worktree for an isolated dispatch worker. */
export async function createIsolatedWorktree(input: CreateIsolatedWorktreeInput): Promise<IsolatedWorktree> {
  const workdir = resolve(input.workdir);
  await ensureGitRepository(workdir);

  const parentTaskId = sanitizeRefSegment(input.parentTaskId);
  const subtaskId = sanitizeRefSegment(input.subtaskId);
  const branchName = `rolemux/${parentTaskId}-${subtaskId}`;
  const worktreePath = join(workdir, '.rolemux', 'worktrees', parentTaskId, subtaskId);
  await mkdir(join(workdir, '.rolemux', 'worktrees', parentTaskId), { recursive: true });

  const result = await runProcess({
    executable: 'git',
    args: ['worktree', 'add', '-b', branchName, worktreePath, 'HEAD'],
    cwd: workdir
  });

  if (result.status !== 'success') {
    throw new CliError('Failed to create isolated git worktree.', {
      code: 'WORKTREE_CREATE_FAILED',
      details: {
        branchName,
        worktreePath,
        stderr: result.stderr.trim()
      }
    });
  }

  return { branchName, worktreePath };
}

/** Collects a binary patch from a worktree, including files that are still untracked. */
export async function collectWorktreeDiff(worktreePath: string): Promise<string> {
  await runProcess({
    executable: 'git',
    args: ['add', '-N', '.'],
    cwd: worktreePath
  });

  const result = await runProcess({
    executable: 'git',
    args: ['diff', '--binary', 'HEAD'],
    cwd: worktreePath
  });

  if (result.status !== 'success') {
    throw new CliError('Failed to collect isolated worktree diff.', {
      code: 'WORKTREE_CREATE_FAILED',
      details: {
        worktreePath,
        stderr: result.stderr.trim()
      }
    });
  }

  return result.stdout;
}

function sanitizeRefSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'task';
}
