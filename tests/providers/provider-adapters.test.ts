import { describe, expect, test } from 'vitest';
import { getProviderAdapter } from '../../src/providers/index.js';

describe('provider adapters', () => {
  test.each(['codex', 'claude', 'agy'] as const)('%s returns command arguments as an array', provider => {
    const adapter = getProviderAdapter(provider);
    const command = adapter.buildCommand({
      prompt: 'Review this task.',
      workdir: 'C:/Project With Spaces',
      role: 'reviewer'
    });

    expect(Array.isArray(command.args)).toBe(true);
    expect(command.executable.length).toBeGreaterThan(0);
    expect(command.args.join(' ')).toContain('Review this task.');
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
      expect(command.args).toEqual(expect.arrayContaining(['exec', '-C', 'C:/Project With Spaces', 'Mock this task.']));
    } finally {
      restoreEnv('ROLEMUX_PROVIDER_CODEX_COMMAND', oldCommand);
      restoreEnv('ROLEMUX_PROVIDER_CODEX_ARGS_PREFIX', oldArgsPrefix);
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
