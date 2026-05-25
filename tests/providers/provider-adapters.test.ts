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
});
