import { describe, expect, test } from 'vitest';
import { getProviderAdapter } from '../../src/providers/index.js';

describe('provider adapters', () => {
  test.each(['codex', 'claude', 'agy', 'grok'] as const)('%s returns command arguments as an array', provider => {
    const adapter = getProviderAdapter(provider);
    const command = adapter.buildCommand({
      prompt: 'Review this task.',
      workdir: 'C:/Project With Spaces',
      role: 'reviewer'
    });

    expect(Array.isArray(command.args)).toBe(true);
    expect(command.executable.length).toBeGreaterThan(0);
    if (provider === 'codex') {
      expect(command.stdin).toBe('Review this task.');
      expect(command.args.join(' ')).not.toContain('Review this task.');
    } else {
      expect(command.args.join(' ')).toContain('Review this task.');
    }
  });

  test('builds Grok Build single-turn command without unsafe permission bypass', () => {
    const command = getProviderAdapter('grok').buildCommand({
      prompt: 'Return exactly OK.',
      workdir: 'C:/Project With Spaces',
      role: 'reviewer'
    });

    expect(command.executable).toBe(process.platform === 'win32' ? 'grok.exe' : 'grok');
    expect(command.args).toEqual([
      '--cwd',
      'C:/Project With Spaces',
      '--output-format',
      'plain',
      '--no-subagents',
      '--no-memory',
      '--verbatim',
      '--single',
      'Return exactly OK.'
    ]);
    expect(command.args).not.toContain('--always-approve');
    expect(command.args).not.toContain('bypassPermissions');
  });

  test('supports provider executable and args-prefix overrides for stable mock runs', () => {
    const oldCommand = process.env.ROLEMUX_PROVIDER_CODEX_COMMAND;
    const oldArgsPrefix = process.env.ROLEMUX_PROVIDER_CODEX_ARGS_PREFIX;
    process.env.ROLEMUX_PROVIDER_CODEX_COMMAND = process.execPath;
    process.env.ROLEMUX_PROVIDER_CODEX_ARGS_PREFIX = 'tests/fixtures/mock-provider.mjs';
    try {
      const command = getProviderAdapter('codex').buildCommand({
        prompt: 'Mock this task.',
        workdir: 'C:/Project With Spaces',
        role: 'builder'
      });

      expect(command.executable).toBe(process.execPath);
      expect(command.args[0]).toBe('tests/fixtures/mock-provider.mjs');
      expect(command.args).toEqual(expect.arrayContaining(['exec', '-C', 'C:/Project With Spaces']));
      expect(command.args).not.toContain('Mock this task.');
      expect(command.stdin).toBe('Mock this task.');
    } finally {
      restoreEnv('ROLEMUX_PROVIDER_CODEX_COMMAND', oldCommand);
      restoreEnv('ROLEMUX_PROVIDER_CODEX_ARGS_PREFIX', oldArgsPrefix);
    }
  });

  test('builds Agy print-mode command with the prompt next to -p', () => {
    const command = getProviderAdapter('agy').buildCommand({
      prompt: 'Return exactly OK.',
      workdir: 'C:/Project With Spaces',
      role: 'summarizer'
    });

    expect(command.args).toEqual(['--add-dir', 'C:/Project With Spaces', '-p', 'Return exactly OK.']);
    expect(command.transport).toBe('pty');
  });

  test('adds Agy print timeout only when explicitly configured', () => {
    const oldTimeout = process.env.ROLEMUX_AGY_PRINT_TIMEOUT;
    try {
      process.env.ROLEMUX_AGY_PRINT_TIMEOUT = '20s';
      const command = getProviderAdapter('agy').buildCommand({
        prompt: 'Return exactly OK.',
        workdir: 'C:/Project With Spaces',
        role: 'summarizer'
      });

      expect(command.args).toEqual(['--add-dir', 'C:/Project With Spaces', '--print-timeout', '20s', '-p', 'Return exactly OK.']);
      expect(command.timeoutMs).toBe(50_000);
    } finally {
      restoreEnv('ROLEMUX_AGY_PRINT_TIMEOUT', oldTimeout);
    }
  });

  test('wraps Codex npm shim through cmd.exe on Windows without enabling unsafe sandbox', () => {
    const command = getProviderAdapter('codex').buildCommand({
      prompt: 'Review this task.',
      workdir: 'C:/Project With Spaces',
      role: 'reviewer'
    });

    if (process.platform === 'win32') {
      expect(command.executable).toBe('cmd.exe');
      expect(command.args.slice(0, 4)).toEqual(['/d', '/s', '/c', 'codex.cmd']);
    } else {
      expect(command.executable).toBe('codex');
    }
    expect(command.args).toContain('exec');
    expect(command.args).toContain('--skip-git-repo-check');
    expect(command.args).toEqual(expect.arrayContaining(['--disable', 'plugins', '--ignore-rules']));
    expect(command.args).toContain('-C');
    expect(command.args).not.toContain('--sandbox');
  });

  test('adds Codex sandbox mode only when explicitly configured', () => {
    const oldSandbox = process.env.ROLEMUX_CODEX_SANDBOX;
    try {
      delete process.env.ROLEMUX_CODEX_SANDBOX;
      const defaultCommand = getProviderAdapter('codex').buildCommand({
        prompt: 'Review this task.',
        workdir: 'C:/Project With Spaces',
        role: 'reviewer'
      });
      expect(defaultCommand.args).not.toContain('--sandbox');

      process.env.ROLEMUX_CODEX_SANDBOX = 'read-only';
      const sandboxCommand = getProviderAdapter('codex').buildCommand({
        prompt: 'Review this task.',
        workdir: 'C:/Project With Spaces',
        role: 'reviewer'
      });

      expect(sandboxCommand.args).toEqual(expect.arrayContaining(['exec', '-C', 'C:/Project With Spaces', '--sandbox', 'read-only']));
      expect(sandboxCommand.args).not.toContain('Review this task.');
      expect(sandboxCommand.stdin).toBe('Review this task.');
    } finally {
      restoreEnv('ROLEMUX_CODEX_SANDBOX', oldSandbox);
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
