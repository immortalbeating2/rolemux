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
      ROLEMUX_PROVIDER_GROK_COMMAND: process.execPath,
      ROLEMUX_PROVIDER_GROK_ARGS_PREFIX: `${fixture};grok;failed`,
      ROLEMUX_PROVIDER_CODEX_COMMAND: process.execPath,
      ROLEMUX_PROVIDER_CODEX_ARGS_PREFIX: `${fixture};codex;success`
    };
    for (const [name, value] of Object.entries(overrides)) {
      oldValues.set(name, process.env[name]);
      process.env[name] = value;
    }

    try {
      const result = await runCommand({
        provider: 'grok',
        fallbackProviders: ['codex'],
        role: 'summarizer',
        task: taskPath,
        workdir
      });

      const providers = (await readFile(logPath, 'utf8')).trim().split(/\r?\n/);
      expect(providers).toEqual(['grok', 'codex']);
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
});
