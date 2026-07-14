import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, test } from 'vitest';
import { runWorkflow } from '../../src/core/workflow-runner.js';

describe('workflow runner', () => {
  test('includes caller-provided context in dry-run prompts', async () => {
    const workdir = await mkdtemp(join(tmpdir(), 'rolemux workflow context '));
    const result = await runWorkflow({
      provider: 'codex',
      role: 'reviewer',
      task: 'Review the packed file.',
      workdir,
      dryRun: true,
      context: ['--- src/target.ts ---\nexport const expected = true;']
    });

    expect(result.prompt).toContain('# Context');
    expect(result.prompt).toContain('src/target.ts');
    expect(result.prompt).toContain('expected = true');
  });

  test('treats successful provider processes with empty stdout as failed answers', async () => {
    const oldCommand = process.env.ROLEMUX_PROVIDER_CODEX_COMMAND;
    const oldArgsPrefix = process.env.ROLEMUX_PROVIDER_CODEX_ARGS_PREFIX;
    process.env.ROLEMUX_PROVIDER_CODEX_COMMAND = process.execPath;
    process.env.ROLEMUX_PROVIDER_CODEX_ARGS_PREFIX = resolve('tests/fixtures/empty-output-provider.mjs');

    try {
      const workdir = await mkdtemp(join(tmpdir(), 'rolemux workflow empty output '));
      const result = await runWorkflow({
        provider: 'codex',
        role: 'summarizer',
        task: 'Return a summary.',
        workdir
      });

      expect(result.status).toBe('failed');
      expect(result.exitCode).toBe(0);
      expect(result.stderr).toContain('Provider exited successfully but produced no stdout');
    } finally {
      restoreEnv('ROLEMUX_PROVIDER_CODEX_COMMAND', oldCommand);
      restoreEnv('ROLEMUX_PROVIDER_CODEX_ARGS_PREFIX', oldArgsPrefix);
    }
  });

  test('treats known Codex Windows sandbox failures as failed answers', async () => {
    const oldCommand = process.env.ROLEMUX_PROVIDER_CODEX_COMMAND;
    const oldArgsPrefix = process.env.ROLEMUX_PROVIDER_CODEX_ARGS_PREFIX;
    process.env.ROLEMUX_PROVIDER_CODEX_COMMAND = process.execPath;
    process.env.ROLEMUX_PROVIDER_CODEX_ARGS_PREFIX = resolve('tests/fixtures/codex-sandbox-error-provider.mjs');

    try {
      const workdir = await mkdtemp(join(tmpdir(), 'rolemux workflow codex sandbox '));
      const result = await runWorkflow({
        provider: 'codex',
        role: 'reviewer',
        task: 'Review files.',
        workdir
      });

      expect(result.status).toBe('failed');
      expect(result.exitCode).toBe(0);
      expect(result.stderr).toContain('Provider output contains a known Codex Windows sandbox failure');
      expect(result.output).toContain('CryptUnprotectData failed');
    } finally {
      restoreEnv('ROLEMUX_PROVIDER_CODEX_COMMAND', oldCommand);
      restoreEnv('ROLEMUX_PROVIDER_CODEX_ARGS_PREFIX', oldArgsPrefix);
    }
  });

  test('runs Grok Build through the shared mock provider override', async () => {
    const oldCommand = process.env.ROLEMUX_PROVIDER_GROK_COMMAND;
    const oldArgsPrefix = process.env.ROLEMUX_PROVIDER_GROK_ARGS_PREFIX;
    process.env.ROLEMUX_PROVIDER_GROK_COMMAND = process.execPath;
    process.env.ROLEMUX_PROVIDER_GROK_ARGS_PREFIX = resolve('tests/fixtures/mock-provider.mjs');

    try {
      const workdir = await mkdtemp(join(tmpdir(), 'rolemux workflow grok '));
      const result = await runWorkflow({
        provider: 'grok',
        role: 'reviewer',
        task: 'Review the adapter.',
        workdir
      });

      expect(result.status).toBe('success');
      expect(result.command.provider).toBe('grok');
      expect(result.output).toContain('MOCK_PROVIDER_OUTPUT');
      expect(result.output).toContain('--single');
    } finally {
      restoreEnv('ROLEMUX_PROVIDER_GROK_COMMAND', oldCommand);
      restoreEnv('ROLEMUX_PROVIDER_GROK_ARGS_PREFIX', oldArgsPrefix);
    }
  });
});

function restoreEnv(name: string, oldValue: string | undefined): void {
  if (oldValue === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = oldValue;
}
