import { describe, expect, test } from 'vitest';
import { runPtyProcess, stripTerminalSequences } from '../../src/core/pty-runner.js';

describe('pty runner', () => {
  test('strips terminal control sequences from provider output', () => {
    expect(stripTerminalSequences('\u001b[2J\u001b[HAGY_OK\u001b[?25h\r\n')).toBe('AGY_OK');
  });

  test('captures output from a TTY-dependent provider process', async () => {
    const result = await runPtyProcess({
      executable: process.execPath,
      args: ['tests/fixtures/ansi-output-provider.mjs'],
      timeoutMs: 5000
    });

    expect(result.status).toBe('success');
    expect(result.stdout).toBe('MOCK_PTY_OUTPUT');
  });
});
