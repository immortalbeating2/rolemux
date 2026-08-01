import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, test } from 'vitest';
import { runCommand } from '../../src/commands/run.js';

describe('run command fallback', () => {
  test('executes each provider once when the primary fails', async () => {
    const workdir = await mkdtemp(join(tmpdir(), 'rolemux fallback '));
    const taskPath = join(workdir, 'task.md');
    const logPath = join(workdir, 'providers.log');
    const fixture = resolve('tests/fixtures/counting-provider.mjs');
    await writeFile(taskPath, 'Return a fallback result.', 'utf8');

    const oldValues = new Map<string, string | undefined>();
    const overrides = {
      ROLEMUX_COUNTING_PROVIDER_LOG: logPath,
      ROLEMUX_PROVIDER_OPENCODE_COMMAND: process.execPath,
      ROLEMUX_PROVIDER_OPENCODE_ARGS_PREFIX: `${fixture};opencode;failed`,
      ROLEMUX_PROVIDER_CODEX_COMMAND: process.execPath,
      ROLEMUX_PROVIDER_CODEX_ARGS_PREFIX: `${fixture};codex;success`
    };
    for (const [name, value] of Object.entries(overrides)) {
      oldValues.set(name, process.env[name]);
      process.env[name] = value;
    }

    try {
      const result = await runCommand({
        provider: 'opencode',
        fallbackProviders: ['codex'],
        role: 'summarizer',
        task: taskPath,
        workdir
      });

      const providers = (await readFile(logPath, 'utf8')).trim().split(/\r?\n/);
      expect(providers).toEqual(['opencode', 'codex']);
      expect(result.status).toBe('success');
      expect(result.provider).toBe('codex');
      expect(result.attempts).toHaveLength(2);
    } finally {
      for (const [name, value] of oldValues) {
        if (value === undefined) {
          delete process.env[name];
        } else {
          process.env[name] = value;
        }
      }
    }
  });

  test('stops before fallback providers when maxAttempts is exhausted', async () => {
    const workdir = await mkdtemp(join(tmpdir(), 'rolemux fallback budget '));
    const taskPath = join(workdir, 'task.md');
    const logPath = join(workdir, 'providers.log');
    const fixture = resolve('tests/fixtures/counting-provider.mjs');
    await writeFile(taskPath, 'Respect the attempt budget.', 'utf8');
    const overrides = {
      ROLEMUX_COUNTING_PROVIDER_LOG: logPath,
      ROLEMUX_PROVIDER_OPENCODE_COMMAND: process.execPath,
      ROLEMUX_PROVIDER_OPENCODE_ARGS_PREFIX: `${fixture};opencode;failed`,
      ROLEMUX_PROVIDER_CODEX_COMMAND: process.execPath,
      ROLEMUX_PROVIDER_CODEX_ARGS_PREFIX: `${fixture};codex;success`
    };
    const oldValues = new Map<string, string | undefined>();
    for (const [name, value] of Object.entries(overrides)) {
      oldValues.set(name, process.env[name]);
      process.env[name] = value;
    }

    try {
      const result = await runCommand({
        provider: 'opencode',
        fallbackProviders: ['codex'],
        role: 'summarizer',
        task: taskPath,
        workdir,
        maxAttempts: 1
      });
      const metadata = JSON.parse(await readFile(
        join(workdir, '.rolemux', 'tasks', result.taskId ?? 'missing', 'metadata.json'),
        'utf8'
      ));

      expect((await readFile(logPath, 'utf8')).trim().split(/\r?\n/)).toEqual(['opencode']);
      expect(result.status).toBe('failed');
      expect(result.attempts).toHaveLength(1);
      expect(metadata.budget).toEqual({
        maxAttempts: 1,
        timeoutMs: null,
        attemptsUsed: 1,
        deadlineReached: false
      });
    } finally {
      for (const [name, value] of oldValues) {
        restoreEnv(name, value);
      }
    }
  });

  test('uses one total timeout budget and does not start a late fallback', async () => {
    const workdir = await mkdtemp(join(tmpdir(), 'rolemux fallback deadline '));
    const taskPath = join(workdir, 'task.md');
    const slowLogPath = join(workdir, 'slow.jsonl');
    const fallbackLogPath = join(workdir, 'fallback.log');
    const slowFixture = resolve('tests/fixtures/slow-provider.mjs');
    const countingFixture = resolve('tests/fixtures/counting-provider.mjs');
    await writeFile(taskPath, 'Respect the total deadline.', 'utf8');
    const overrides = {
      ROLEMUX_SLOW_PROVIDER_LOG: slowLogPath,
      ROLEMUX_SLOW_PROVIDER_DELAY_MS: '250',
      ROLEMUX_COUNTING_PROVIDER_LOG: fallbackLogPath,
      ROLEMUX_PROVIDER_OPENCODE_COMMAND: process.execPath,
      ROLEMUX_PROVIDER_OPENCODE_ARGS_PREFIX: slowFixture,
      ROLEMUX_PROVIDER_CODEX_COMMAND: process.execPath,
      ROLEMUX_PROVIDER_CODEX_ARGS_PREFIX: `${countingFixture};codex;success`
    };
    const oldValues = new Map<string, string | undefined>();
    for (const [name, value] of Object.entries(overrides)) {
      oldValues.set(name, process.env[name]);
      process.env[name] = value;
    }

    try {
      const result = await runCommand({
        provider: 'opencode',
        fallbackProviders: ['codex'],
        role: 'summarizer',
        task: taskPath,
        workdir,
        timeoutMs: 30,
        maxAttempts: 2
      });
      const metadata = JSON.parse(await readFile(
        join(workdir, '.rolemux', 'tasks', result.taskId ?? 'missing', 'metadata.json'),
        'utf8'
      ));

      expect(result.status).toBe('timeout');
      expect(result.attempts).toHaveLength(1);
      await expect(readFile(fallbackLogPath, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
      expect(metadata.budget).toEqual({
        maxAttempts: 2,
        timeoutMs: 30,
        attemptsUsed: 1,
        deadlineReached: true
      });
    } finally {
      for (const [name, value] of oldValues) {
        restoreEnv(name, value);
      }
    }
  });
});

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}
