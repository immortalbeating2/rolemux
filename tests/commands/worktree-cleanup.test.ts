import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { worktreeCleanupCommand } from '../../src/commands/worktree.js';
import { createIsolatedWorktree } from '../../src/core/git-worktree.js';
import { runProcess } from '../../src/core/process-runner.js';

describe('worktree cleanup command', () => {
  test('previews recorded worktree cleanup targets', async () => {
    const workdir = await mkdtemp(join(tmpdir(), 'rolemux command worktree preview '));
    await initRepo(workdir);
    const worktree = await createIsolatedWorktree({ workdir, parentTaskId: 'parent', subtaskId: 'one' });
    await writeWorktreeArtifact(workdir, 'parent', 'one', worktree.worktreePath);

    const result = await worktreeCleanupCommand({ parentTask: 'parent', workdir, dryRun: true });

    expect(result.status).toBe('dry-run');
    expect(result.targets).toHaveLength(1);
    expect(result.targets[0]?.status).toBe('pending');
    expect(existsSync(worktree.worktreePath)).toBe(true);
  });

  test('removes recorded worktree cleanup targets', async () => {
    const workdir = await mkdtemp(join(tmpdir(), 'rolemux command worktree cleanup '));
    await initRepo(workdir);
    const worktree = await createIsolatedWorktree({ workdir, parentTaskId: 'parent', subtaskId: 'one' });
    await writeWorktreeArtifact(workdir, 'parent', 'one', worktree.worktreePath);

    const result = await worktreeCleanupCommand({ parentTask: 'parent', workdir, dryRun: false });

    expect(result.status).toBe('cleaned');
    expect(result.targets[0]?.status).toBe('removed');
    expect(existsSync(worktree.worktreePath)).toBe(false);
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
