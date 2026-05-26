import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, test } from 'vitest';

const execFileAsync = promisify(execFile);
const repoRoot = resolve('.');
const cliPath = join(repoRoot, 'dist', 'cli.js');
const mockProviderPath = join(repoRoot, 'tests', 'fixtures', 'mock-provider.mjs');

describe('release flow E2E', () => {
  test('runs install, mock provider execution, status, clean, and uninstall in isolated directories', async () => {
    const homeDir = await mkdtemp(join(tmpdir(), 'rolemux e2e home '));
    const workdir = await mkdtemp(join(tmpdir(), 'rolemux e2e workdir '));
    await writeFile(join(workdir, 'task.md'), 'Return a mock implementation summary.\n', 'utf8');

    const env = {
      ...process.env,
      HOME: homeDir,
      USERPROFILE: homeDir,
      ROLEMUX_PROVIDER_CODEX_COMMAND: process.execPath,
      ROLEMUX_PROVIDER_CODEX_ARGS_PREFIX: mockProviderPath
    };

    const install = await runCli(['install'], env);
    expect(install.status).toBe('installed');
    expect(existsSync(join(homeDir, '.codex', 'skills', 'rolemux-workflow', 'SKILL.md'))).toBe(true);

    const run = await runCli(['run', '--provider', 'codex', '--role', 'builder', '--task', 'task.md', '--workdir', workdir], env);
    expect(run.status).toBe('success');
    expect(run.provider).toBe('codex');
    expect(run.taskId).toBeTypeOf('string');

    const taskDirs = await readdir(join(workdir, '.rolemux', 'tasks'));
    expect(taskDirs).toHaveLength(1);
    const output = await readFile(join(workdir, '.rolemux', 'tasks', taskDirs[0]!, 'output.md'), 'utf8');
    expect(output).toContain('MOCK_PROVIDER_OUTPUT');

    const status = await runCli(['status', '--workdir', workdir], env);
    expect(status.tasks).toHaveLength(1);

    const clean = await runCli(['clean', '--workdir', workdir], env);
    expect(clean.status).toBe('cleaned');
    expect(await readdir(join(workdir, '.rolemux', 'tasks'))).toHaveLength(0);

    const uninstall = await runCli(['uninstall'], env);
    expect(uninstall.status).toBe('uninstalled');
    expect(existsSync(join(homeDir, '.codex', 'skills', 'rolemux-workflow'))).toBe(false);
  });
});

async function runCli(args: readonly string[], env: NodeJS.ProcessEnv): Promise<any> {
  const { stdout } = await execFileAsync(process.execPath, [cliPath, ...args], { env, cwd: repoRoot });
  return JSON.parse(stdout);
}
