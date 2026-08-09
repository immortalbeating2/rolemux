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

  test('runs OpenCode through the shared mock provider override', async () => {
    const oldCommand = process.env.ROLEMUX_PROVIDER_OPENCODE_COMMAND;
    const oldArgsPrefix = process.env.ROLEMUX_PROVIDER_OPENCODE_ARGS_PREFIX;
    process.env.ROLEMUX_PROVIDER_OPENCODE_COMMAND = process.execPath;
    process.env.ROLEMUX_PROVIDER_OPENCODE_ARGS_PREFIX = resolve('tests/fixtures/mock-provider.mjs');

    try {
      const workdir = await mkdtemp(join(tmpdir(), 'rolemux workflow opencode '));
      const result = await runWorkflow({
        provider: 'opencode',
        role: 'reviewer',
        task: 'Review the adapter.',
        workdir
      });

      expect(result.status).toBe('success');
      expect(result.command.provider).toBe('opencode');
      expect(result.output).toContain('MOCK_PROVIDER_OUTPUT');
      expect(result.output).toContain('--pure');
      expect(result.output).not.toContain('--auto');
    } finally {
      restoreEnv('ROLEMUX_PROVIDER_OPENCODE_COMMAND', oldCommand);
      restoreEnv('ROLEMUX_PROVIDER_OPENCODE_ARGS_PREFIX', oldArgsPrefix);
    }
  });

  test('parses Agy stream-json output in process transport mode', async () => {
    const oldTransport = process.env.ROLEMUX_AGY_TRANSPORT;
    const oldCommand = process.env.ROLEMUX_PROVIDER_AGY_COMMAND;
    const oldArgsPrefix = process.env.ROLEMUX_PROVIDER_AGY_ARGS_PREFIX;
    process.env.ROLEMUX_AGY_TRANSPORT = 'process';
    process.env.ROLEMUX_PROVIDER_AGY_COMMAND = process.execPath;
    process.env.ROLEMUX_PROVIDER_AGY_ARGS_PREFIX = resolve('tests/fixtures/agy-machine-provider.mjs');

    try {
      const workdir = await mkdtemp(join(tmpdir(), 'rolemux workflow agy machine '));
      const result = await runWorkflow({
        provider: 'agy',
        role: 'summarizer',
        task: 'Return a machine-readable answer.',
        workdir
      });

      expect(result.status).toBe('success');
      expect(result.output).toBe('AGY_MACHINE_OK\n');
      expect(result.command.machineReadable).toBe(true);
      expect(result.command.transport).toBeUndefined();
    } finally {
      restoreEnv('ROLEMUX_AGY_TRANSPORT', oldTransport);
      restoreEnv('ROLEMUX_PROVIDER_AGY_COMMAND', oldCommand);
      restoreEnv('ROLEMUX_PROVIDER_AGY_ARGS_PREFIX', oldArgsPrefix);
    }
  });

  test('keeps an unparsed Agy machine stream when the provider fails early', async () => {
    const oldTransport = process.env.ROLEMUX_AGY_TRANSPORT;
    const oldCommand = process.env.ROLEMUX_PROVIDER_AGY_COMMAND;
    const oldArgsPrefix = process.env.ROLEMUX_PROVIDER_AGY_ARGS_PREFIX;
    process.env.ROLEMUX_AGY_TRANSPORT = 'process';
    process.env.ROLEMUX_PROVIDER_AGY_COMMAND = process.execPath;
    process.env.ROLEMUX_PROVIDER_AGY_ARGS_PREFIX = resolve('tests/fixtures/agy-machine-failure-provider.mjs');

    try {
      const workdir = await mkdtemp(join(tmpdir(), 'rolemux workflow agy failure '));
      const result = await runWorkflow({
        provider: 'agy',
        role: 'summarizer',
        task: 'Return a machine-readable answer.',
        workdir
      });

      expect(result.status).toBe('failed');
      expect(result.output).toContain('permission denied by headless provider');
    } finally {
      restoreEnv('ROLEMUX_AGY_TRANSPORT', oldTransport);
      restoreEnv('ROLEMUX_PROVIDER_AGY_COMMAND', oldCommand);
      restoreEnv('ROLEMUX_PROVIDER_AGY_ARGS_PREFIX', oldArgsPrefix);
    }
  });

  test('strips terminal styling from OpenCode process output', async () => {
    const oldCommand = process.env.ROLEMUX_PROVIDER_OPENCODE_COMMAND;
    const oldArgsPrefix = process.env.ROLEMUX_PROVIDER_OPENCODE_ARGS_PREFIX;
    process.env.ROLEMUX_PROVIDER_OPENCODE_COMMAND = process.execPath;
    process.env.ROLEMUX_PROVIDER_OPENCODE_ARGS_PREFIX = resolve('tests/fixtures/ansi-process-provider.mjs');

    try {
      const workdir = await mkdtemp(join(tmpdir(), 'rolemux workflow opencode ansi '));
      const result = await runWorkflow({
        provider: 'opencode',
        role: 'reviewer',
        task: 'Return styled output.',
        workdir
      });

      expect(result.status).toBe('success');
      expect(result.output).toBe('MOCK_PROCESS_OUTPUT');
      expect(result.stderr).toBe('MOCK_PROCESS_STATUS');
    } finally {
      restoreEnv('ROLEMUX_PROVIDER_OPENCODE_COMMAND', oldCommand);
      restoreEnv('ROLEMUX_PROVIDER_OPENCODE_ARGS_PREFIX', oldArgsPrefix);
    }
  });

  test('applies timeout and cancellation to OpenCode runs', async () => {
    const oldCommand = process.env.ROLEMUX_PROVIDER_OPENCODE_COMMAND;
    const oldArgsPrefix = process.env.ROLEMUX_PROVIDER_OPENCODE_ARGS_PREFIX;
    const oldLog = process.env.ROLEMUX_SLOW_PROVIDER_LOG;
    const oldDelay = process.env.ROLEMUX_SLOW_PROVIDER_DELAY_MS;
    const workdir = await mkdtemp(join(tmpdir(), 'rolemux workflow opencode control '));
    process.env.ROLEMUX_PROVIDER_OPENCODE_COMMAND = process.execPath;
    process.env.ROLEMUX_PROVIDER_OPENCODE_ARGS_PREFIX = resolve('tests/fixtures/slow-provider.mjs');
    process.env.ROLEMUX_SLOW_PROVIDER_LOG = join(workdir, 'slow-provider.jsonl');
    process.env.ROLEMUX_SLOW_PROVIDER_DELAY_MS = '500';

    try {
      const timedOut = await runWorkflow({
        provider: 'opencode',
        role: 'reviewer',
        task: 'Wait.',
        workdir,
        timeoutMs: 25
      });
      const controller = new AbortController();
      controller.abort();
      const canceled = await runWorkflow({
        provider: 'opencode',
        role: 'reviewer',
        task: 'Wait.',
        workdir,
        signal: controller.signal
      });

      expect(timedOut.status).toBe('timeout');
      expect(canceled.status).toBe('canceled');
    } finally {
      restoreEnv('ROLEMUX_PROVIDER_OPENCODE_COMMAND', oldCommand);
      restoreEnv('ROLEMUX_PROVIDER_OPENCODE_ARGS_PREFIX', oldArgsPrefix);
      restoreEnv('ROLEMUX_SLOW_PROVIDER_LOG', oldLog);
      restoreEnv('ROLEMUX_SLOW_PROVIDER_DELAY_MS', oldDelay);
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
