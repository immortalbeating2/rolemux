import { describe, expect, test } from 'vitest';
import { runProcess } from '../../src/core/process-runner.js';

describe('process runner', () => {
  test('captures stdout for a successful process', async () => {
    const result = await runProcess({
      executable: process.execPath,
      args: ['-e', 'console.log("ok")'],
      timeoutMs: 5000
    });

    expect(result.status).toBe('success');
    expect(result.stdout.trim()).toBe('ok');
    expect(result.exitCode).toBe(0);
  });

  test('captures non-zero exits without throwing', async () => {
    const result = await runProcess({
      executable: process.execPath,
      args: ['-e', 'console.error("bad"); process.exit(7)'],
      timeoutMs: 5000
    });

    expect(result.status).toBe('failed');
    expect(result.exitCode).toBe(7);
    expect(result.stderr.trim()).toBe('bad');
  });
});
