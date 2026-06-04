import { describe, expect, test } from 'vitest';
import { buildWorkerPool, parseProviderQuotas } from '../../src/core/worker-pool.js';

describe('worker pool', () => {
  test('parses provider quotas', () => {
    expect(parseProviderQuotas('codex:2,claude:1,agy:1')).toEqual([
      { provider: 'codex', count: 2 },
      { provider: 'claude', count: 1 },
      { provider: 'agy', count: 1 }
    ]);
  });

  test('rejects invalid provider quota values', () => {
    expect(() => parseProviderQuotas('codex:0')).toThrow('Invalid worker count for provider: codex');
    expect(() => parseProviderQuotas('nope:1')).toThrow('Unknown provider: nope');
  });

  test('expands workers shortcut by round robin provider order', () => {
    expect(buildWorkerPool({ providers: 'codex,claude', workers: 4 })).toEqual([
      { id: 'codex-1', provider: 'codex' },
      { id: 'claude-1', provider: 'claude' },
      { id: 'codex-2', provider: 'codex' },
      { id: 'claude-2', provider: 'claude' }
    ]);
  });

  test('expands explicit provider quotas into workers', () => {
    expect(buildWorkerPool({ providers: 'codex:2,agy:1' })).toEqual([
      { id: 'codex-1', provider: 'codex' },
      { id: 'codex-2', provider: 'codex' },
      { id: 'agy-1', provider: 'agy' }
    ]);
  });
});
