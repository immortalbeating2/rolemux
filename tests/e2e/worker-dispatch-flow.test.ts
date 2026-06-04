import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, test } from 'vitest';

const execFileAsync = promisify(execFile);
const repoRoot = resolve('.');
const cliPath = join(repoRoot, 'dist', 'cli.js');
const mockProviderPath = join(repoRoot, 'tests', 'fixtures', 'mock-provider.mjs');
const writeFileProviderPath = join(repoRoot, 'tests', 'fixtures', 'write-file-provider.mjs');

describe('worker dispatch flow E2E', () => {
  test('validates, dispatches, resumes, selectively merges, and previews worktree cleanup', async () => {
    const workdir = await mkdtemp(join(tmpdir(), 'rolemux worker flow '));
    await initRepo(workdir);

    const manifestPath = join(workdir, 'rolemux-tasks.json');
    await writeFile(manifestPath, JSON.stringify({
      version: 1,
      parentTask: { title: 'Worker dispatch flow' },
      subtasks: [
        {
          id: 'read',
          title: 'Read-only review',
          provider: 'claude',
          role: 'reviewer',
          task: 'Read the repo and summarize without editing files.',
          writePolicy: 'readonly'
        },
        {
          id: 'write',
          title: 'Isolated implementation',
          provider: 'codex',
          role: 'builder',
          task: 'Create worker-output.txt in the isolated worktree.',
          writePolicy: 'isolated'
        }
      ]
    }), 'utf8');

    const env = {
      ...process.env,
      ROLEMUX_PROVIDER_CODEX_COMMAND: process.execPath,
      ROLEMUX_PROVIDER_CODEX_ARGS_PREFIX: writeFileProviderPath,
      ROLEMUX_PROVIDER_CLAUDE_COMMAND: process.execPath,
      ROLEMUX_PROVIDER_CLAUDE_ARGS_PREFIX: mockProviderPath
    };

    const validation = await runCli(['manifest', 'validate', '--manifest', manifestPath], env);
    expect(validation.status).toBe('success');
    expect(validation.subtaskCount).toBe(2);

    const dispatch = await runCli([
      'dispatch',
      '--manifest',
      manifestPath,
      '--providers',
      'codex:1,claude:1',
      '--workdir',
      workdir
    ], env);
    expect(dispatch.status).toBe('success');
    expect(dispatch.parentTaskId).toBeTypeOf('string');
    expect(existsSync(join(workdir, 'worker-output.txt'))).toBe(false);

    const resume = await runCli(['dispatch', '--resume', dispatch.parentTaskId, '--workdir', workdir], env);
    expect(resume.parentTaskId).toBe(dispatch.parentTaskId);
    expect(resume.subtaskCount).toBe(2);
    expect(resume.successCount).toBe(2);

    const dryRunMerge = await runCli([
      'merge',
      '--parent-task',
      dispatch.parentTaskId,
      '--workdir',
      workdir,
      '--subtasks',
      'write',
      '--dry-run'
    ], env);
    expect(dryRunMerge.status).toBe('dry-run');
    expect(dryRunMerge.patches.map((patch: { subtaskId: string }) => patch.subtaskId)).toEqual(['write']);
    expect(existsSync(join(workdir, 'worker-output.txt'))).toBe(false);

    const merge = await runCli([
      'merge',
      '--parent-task',
      dispatch.parentTaskId,
      '--workdir',
      workdir,
      '--subtasks',
      'write',
      '--auto-merge'
    ], env);
    expect(merge.status).toBe('success');
    expect(await readFile(join(workdir, 'worker-output.txt'), 'utf8')).toContain('created by isolated worker');

    const cleanup = await runCli([
      'worktree',
      'cleanup',
      '--parent-task',
      dispatch.parentTaskId,
      '--workdir',
      workdir,
      '--dry-run'
    ], env);
    expect(cleanup.status).toBe('dry-run');
    expect(cleanup.targets).toHaveLength(1);
    expect(cleanup.targets[0].subtaskId).toBe('write');
  });
});

async function runCli(args: readonly string[], env: NodeJS.ProcessEnv): Promise<any> {
  const { stdout } = await execFileAsync(process.execPath, [cliPath, ...args], { env, cwd: repoRoot });
  return JSON.parse(stdout);
}

async function initRepo(workdir: string): Promise<void> {
  await execFileAsync('git', ['init'], { cwd: workdir });
  await execFileAsync('git', ['config', 'user.email', 'rolemux@example.invalid'], { cwd: workdir });
  await execFileAsync('git', ['config', 'user.name', 'RoleMux Test'], { cwd: workdir });
  await writeFile(join(workdir, 'README.md'), 'baseline\n', 'utf8');
  await execFileAsync('git', ['add', 'README.md'], { cwd: workdir });
  await execFileAsync('git', ['commit', '-m', 'baseline'], { cwd: workdir });
}
