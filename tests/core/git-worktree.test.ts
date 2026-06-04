import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { collectWorktreeDiff, createIsolatedWorktree, ensureGitRepository } from '../../src/core/git-worktree.js';
import { runProcess } from '../../src/core/process-runner.js';

describe('git worktree isolation', () => {
  test('creates an isolated worktree and collects diff', async () => {
    const repo = await mkdtemp(join(tmpdir(), 'rolemux git repo '));
    await initRepo(repo);

    const worktree = await createIsolatedWorktree({
      workdir: repo,
      parentTaskId: '20260605T000000-test01',
      subtaskId: 'write-code'
    });

    expect(existsSync(worktree.worktreePath)).toBe(true);
    await writeFile(join(worktree.worktreePath, 'feature.txt'), 'created by worker\n', 'utf8');

    const diff = await collectWorktreeDiff(worktree.worktreePath);

    expect(diff).toContain('feature.txt');
    expect(diff).toContain('created by worker');
  });

  test('rejects isolated worktree creation outside a git repository', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'rolemux no git '));

    await expect(ensureGitRepository(dir)).rejects.toMatchObject({ code: 'WORKTREE_NOT_AVAILABLE' });
  });
});

async function initRepo(repo: string): Promise<void> {
  await runProcess({ executable: 'git', args: ['init'], cwd: repo });
  await runProcess({ executable: 'git', args: ['config', 'user.email', 'rolemux@example.invalid'], cwd: repo });
  await runProcess({ executable: 'git', args: ['config', 'user.name', 'RoleMux Test'], cwd: repo });
  await writeFile(join(repo, 'README.md'), 'baseline\n', 'utf8');
  await runProcess({ executable: 'git', args: ['add', 'README.md'], cwd: repo });
  await runProcess({ executable: 'git', args: ['commit', '-m', 'baseline'], cwd: repo });
  await mkdir(join(repo, '.rolemux'), { recursive: true });
}
