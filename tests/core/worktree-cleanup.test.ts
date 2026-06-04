import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { cleanupWorktrees, loadWorktreeCleanupPreview } from '../../src/core/worktree-cleanup.js';
import { createIsolatedWorktree } from '../../src/core/git-worktree.js';
import { runProcess } from '../../src/core/process-runner.js';

describe('worktree cleanup', () => {
  test('previews recorded dispatch worktrees', async () => {
    const workdir = await mkdtemp(join(tmpdir(), 'rolemux worktree preview '));
    await initRepo(workdir);
    const worktree = await createIsolatedWorktree({ workdir, parentTaskId: 'parent', subtaskId: 'one' });
    await writeWorktreeArtifact(workdir, 'parent', 'one', worktree.worktreePath);

    const preview = await loadWorktreeCleanupPreview({ workdir, parentTaskId: 'parent' });

    expect(preview.status).toBe('dry-run');
    expect(preview.targets).toHaveLength(1);
    expect(preview.targets[0]?.subtaskId).toBe('one');
    expect(preview.targets[0]?.status).toBe('pending');
    expect(preview.targets[0]?.exists).toBe(true);
  });

  test('removes recorded dispatch worktrees', async () => {
    const workdir = await mkdtemp(join(tmpdir(), 'rolemux worktree cleanup '));
    await initRepo(workdir);
    const worktree = await createIsolatedWorktree({ workdir, parentTaskId: 'parent', subtaskId: 'one' });
    await writeFile(join(worktree.worktreePath, 'dirty.txt'), 'worker scratch\n', 'utf8');
    await writeWorktreeArtifact(workdir, 'parent', 'one', worktree.worktreePath);

    const result = await cleanupWorktrees({ workdir, parentTaskId: 'parent' });

    expect(result.status).toBe('cleaned');
    expect(result.targets[0]?.status).toBe('removed');
    expect(existsSync(worktree.worktreePath)).toBe(false);
  });

  test('reports missing recorded worktrees without failing', async () => {
    const workdir = await mkdtemp(join(tmpdir(), 'rolemux worktree missing '));
    await initRepo(workdir);
    const missingPath = join(workdir, '.rolemux', 'worktrees', 'parent', 'one');
    await writeWorktreeArtifact(workdir, 'parent', 'one', missingPath);

    const result = await cleanupWorktrees({ workdir, parentTaskId: 'parent' });

    expect(result.targets[0]?.status).toBe('missing');
    expect(result.targets[0]?.exists).toBe(false);
  });

  test('rejects worktree artifact paths outside .rolemux worktrees', async () => {
    const workdir = await mkdtemp(join(tmpdir(), 'rolemux worktree unsafe '));
    await initRepo(workdir);
    const unsafePath = join(tmpdir(), 'outside-rolemux-worktree');
    await writeWorktreeArtifact(workdir, 'parent', 'one', unsafePath);

    await expect(loadWorktreeCleanupPreview({ workdir, parentTaskId: 'parent' })).rejects.toMatchObject({
      code: 'WORKTREE_CLEANUP_UNSAFE_PATH'
    });
  });
});

async function initRepo(workdir: string): Promise<void> {
  await runProcess({ executable: 'git', args: ['init'], cwd: workdir });
  await runProcess({ executable: 'git', args: ['config', 'user.email', 'rolemux@example.invalid'], cwd: workdir });
  await runProcess({ executable: 'git', args: ['config', 'user.name', 'RoleMux Test'], cwd: workdir });
  await writeFile(join(workdir, 'README.md'), 'baseline\n', 'utf8');
  await runProcess({ executable: 'git', args: ['add', 'README.md'], cwd: workdir });
  await runProcess({ executable: 'git', args: ['commit', '-m', 'baseline'], cwd: workdir });
}

async function writeWorktreeArtifact(workdir: string, parentTaskId: string, subtaskId: string, worktreePath: string): Promise<void> {
  const subtaskDir = join(workdir, '.rolemux', 'tasks', parentTaskId, 'subtasks', subtaskId);
  await mkdir(subtaskDir, { recursive: true });
  await writeFile(join(subtaskDir, 'worktree.txt'), `${worktreePath}\n`, 'utf8');
}
