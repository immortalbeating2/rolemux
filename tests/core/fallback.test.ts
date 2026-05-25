import { describe, expect, test } from 'vitest';
import { runWithFallback } from '../../src/core/fallback.js';

describe('fallback runner', () => {
  test('returns the first successful attempt and preserves failures', async () => {
    const result = await runWithFallback(['codex', 'claude'], async provider => {
      if (provider === 'codex') {
        return { provider, status: 'failed', output: 'failed' };
      }
      return { provider, status: 'success', output: 'ok' };
    });

    expect(result.status).toBe('success');
    expect(result.provider).toBe('claude');
    expect(result.attempts).toHaveLength(2);
  });
});
