import { describe, expect, test } from 'vitest';
import { routeProviders } from '../../src/core/provider-router.js';

describe('provider capability router', () => {
  test.each([
    ['architecture', ['codex', 'claude']],
    ['research', ['grok', 'claude']],
    ['implementation', ['codex', 'opencode']],
    ['ui-review', ['claude', 'grok']],
    ['failure-review', ['codex', 'claude']]
  ] as const)('routes %s by deterministic capability priority', (taskKind, expected) => {
    expect(routeProviders({
      taskKind,
      available: ['codex', 'claude', 'agy', 'grok', 'opencode'],
      maxProviders: 2
    }).selected).toEqual(expected);
  });

  test('honors available, exclude, and maxProviders without inventing providers', () => {
    const result = routeProviders({
      taskKind: 'research',
      available: ['codex', 'grok', 'opencode'],
      exclude: ['codex'],
      maxProviders: 1
    });

    expect(result.selected).toEqual(['grok']);
    expect(result.available).toEqual(['codex', 'grok', 'opencode']);
    expect(result.excluded).toEqual(['codex']);
  });
});
