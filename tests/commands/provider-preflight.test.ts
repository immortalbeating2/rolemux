import { existsSync } from 'node:fs';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, test } from 'vitest';
import { vi } from 'vitest';
import { main } from '../../src/cli.js';
import { dispatchCommand } from '../../src/commands/dispatch.js';
import { planCommand } from '../../src/commands/plan.js';
import { runCommand } from '../../src/commands/run.js';

describe('provider preflight', () => {
  test('run blocks before creating artifacts when the required provider is unavailable', async () => {
    const workdir = await mkdtemp(join(tmpdir(), 'rolemux preflight missing '));
    const emptyPath = await mkdtemp(join(tmpdir(), 'rolemux preflight path '));
    const taskPath = join(workdir, 'task.md');
    const oldPath = process.env.PATH;
    const oldOverride = process.env.ROLEMUX_PROVIDER_CODEX_COMMAND;
    await writeFile(taskPath, 'Do not run.', 'utf8');
    process.env.PATH = emptyPath;
    delete process.env.ROLEMUX_PROVIDER_CODEX_COMMAND;

    try {
      await expect(runCommand({
        provider: 'codex',
        role: 'reviewer',
        task: taskPath,
        workdir
      })).rejects.toMatchObject({
        code: 'PROVIDER_PREFLIGHT_BLOCKED',
        details: {
          status: 'blocked',
          providers: [{ provider: 'codex', status: 'missing-executable' }]
        }
      });
      expect(existsSync(join(workdir, '.rolemux'))).toBe(false);
    } finally {
      restoreEnv('PATH', oldPath);
      restoreEnv('ROLEMUX_PROVIDER_CODEX_COMMAND', oldOverride);
    }
  });

  test('CLI prints a structured blocked result for plugin consumers', async () => {
    const workdir = await mkdtemp(join(tmpdir(), 'rolemux preflight cli '));
    const emptyPath = await mkdtemp(join(tmpdir(), 'rolemux preflight cli path '));
    const taskPath = join(workdir, 'task.md');
    const oldPath = process.env.PATH;
    const oldOverride = process.env.ROLEMUX_PROVIDER_CODEX_COMMAND;
    const oldExitCode = process.exitCode;
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await writeFile(taskPath, 'Do not run.', 'utf8');
    process.env.PATH = emptyPath;
    delete process.env.ROLEMUX_PROVIDER_CODEX_COMMAND;

    try {
      await main(['node', 'rolemux', 'run', '--provider', 'codex', '--role', 'reviewer', '--task', taskPath, '--workdir', workdir]);
      expect(JSON.parse(String(error.mock.calls[0]?.[0]))).toMatchObject({
        status: 'blocked',
        code: 'PROVIDER_PREFLIGHT_BLOCKED',
        providers: [{ provider: 'codex', status: 'missing-executable' }]
      });
      expect(process.exitCode).toBe(1);
    } finally {
      error.mockRestore();
      process.exitCode = oldExitCode;
      restoreEnv('PATH', oldPath);
      restoreEnv('ROLEMUX_PROVIDER_CODEX_COMMAND', oldOverride);
    }
  });

  test('dispatch blocks every assignment before creating a monitor', async () => {
    const workdir = await mkdtemp(join(tmpdir(), 'rolemux preflight dispatch '));
    const emptyPath = await mkdtemp(join(tmpdir(), 'rolemux preflight dispatch path '));
    const manifestPath = join(workdir, 'tasks.json');
    const oldPath = process.env.PATH;
    const oldOverride = process.env.ROLEMUX_PROVIDER_CODEX_COMMAND;
    await writeFile(manifestPath, JSON.stringify({
      version: 1,
      parentTask: { title: 'Blocked dispatch' },
      subtasks: [{ id: 'one', title: 'One', task: 'Do not run.', provider: 'codex' }]
    }), 'utf8');
    process.env.PATH = emptyPath;
    delete process.env.ROLEMUX_PROVIDER_CODEX_COMMAND;

    try {
      await expect(dispatchCommand({
        manifest: manifestPath,
        providers: 'codex:1',
        workdir,
        detach: true
      })).rejects.toMatchObject({ code: 'PROVIDER_PREFLIGHT_BLOCKED' });
      expect(existsSync(join(workdir, '.rolemux'))).toBe(false);
    } finally {
      restoreEnv('PATH', oldPath);
      restoreEnv('ROLEMUX_PROVIDER_CODEX_COMMAND', oldOverride);
    }
  });

  test('CLI prints native-agent capability blocks as structured JSON', async () => {
    const workdir = await mkdtemp(join(tmpdir(), 'rolemux native capability cli '));
    const manifestPath = join(workdir, 'tasks.json');
    const oldCommand = process.env.ROLEMUX_PROVIDER_GROK_COMMAND;
    const oldExitCode = process.exitCode;
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    process.env.ROLEMUX_PROVIDER_GROK_COMMAND = process.execPath;
    await writeFile(manifestPath, JSON.stringify({
      version: 1,
      parentTask: { title: 'Blocked native dispatch' },
      subtasks: [{ id: 'one', title: 'One', task: 'Do not run.', provider: 'grok' }]
    }), 'utf8');

    try {
      await main([
        'node', 'rolemux', 'dispatch', '--manifest', manifestPath, '--providers', 'grok:1',
        '--workdir', workdir, '--native-agents'
      ]);
      expect(JSON.parse(String(error.mock.calls[0]?.[0]))).toMatchObject({
        status: 'blocked',
        code: 'PROVIDER_NATIVE_AGENTS_UNSUPPORTED',
        providers: ['grok']
      });
      expect(process.exitCode).toBe(1);
      expect(existsSync(join(workdir, '.rolemux'))).toBe(false);
    } finally {
      error.mockRestore();
      process.exitCode = oldExitCode;
      restoreEnv('ROLEMUX_PROVIDER_GROK_COMMAND', oldCommand);
    }
  });

  test('plan checks every provider before starting any parallel run', async () => {
    const workdir = await mkdtemp(join(tmpdir(), 'rolemux preflight plan '));
    const emptyPath = await mkdtemp(join(tmpdir(), 'rolemux preflight plan path '));
    const taskPath = join(workdir, 'task.md');
    const providerLog = join(workdir, 'provider.jsonl');
    const oldPath = process.env.PATH;
    const oldCodexCommand = process.env.ROLEMUX_PROVIDER_CODEX_COMMAND;
    const oldCodexArgs = process.env.ROLEMUX_PROVIDER_CODEX_ARGS_PREFIX;
    const oldClaudeCommand = process.env.ROLEMUX_PROVIDER_CLAUDE_COMMAND;
    const oldProviderLog = process.env.ROLEMUX_SLOW_PROVIDER_LOG;
    const oldProviderDelay = process.env.ROLEMUX_SLOW_PROVIDER_DELAY_MS;
    await writeFile(taskPath, 'Do not partially run.', 'utf8');
    process.env.PATH = emptyPath;
    process.env.ROLEMUX_PROVIDER_CODEX_COMMAND = process.execPath;
    process.env.ROLEMUX_PROVIDER_CODEX_ARGS_PREFIX = resolve('tests/fixtures/slow-provider.mjs');
    process.env.ROLEMUX_SLOW_PROVIDER_LOG = providerLog;
    process.env.ROLEMUX_SLOW_PROVIDER_DELAY_MS = '300';
    delete process.env.ROLEMUX_PROVIDER_CLAUDE_COMMAND;

    try {
      await expect(planCommand({
        providers: ['codex', 'claude'],
        task: taskPath,
        workdir
      })).rejects.toMatchObject({ code: 'PROVIDER_PREFLIGHT_BLOCKED' });
      await new Promise(resolvePromise => setTimeout(resolvePromise, 100));
      expect(existsSync(providerLog)).toBe(false);
      expect(existsSync(join(workdir, '.rolemux'))).toBe(false);
    } finally {
      restoreEnv('PATH', oldPath);
      restoreEnv('ROLEMUX_PROVIDER_CODEX_COMMAND', oldCodexCommand);
      restoreEnv('ROLEMUX_PROVIDER_CODEX_ARGS_PREFIX', oldCodexArgs);
      restoreEnv('ROLEMUX_PROVIDER_CLAUDE_COMMAND', oldClaudeCommand);
      restoreEnv('ROLEMUX_SLOW_PROVIDER_LOG', oldProviderLog);
      restoreEnv('ROLEMUX_SLOW_PROVIDER_DELAY_MS', oldProviderDelay);
    }
  });
});

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
}
