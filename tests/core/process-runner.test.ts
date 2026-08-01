import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
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

  test('closes child stdin so non-interactive providers do not wait forever', async () => {
    const result = await runProcess({
      executable: process.execPath,
      args: ['tests/fixtures/wait-for-stdin-eof.mjs'],
      timeoutMs: 500
    });

    expect(result.status).toBe('success');
    expect(result.stdout.trim()).toBe('stdin-closed:0');
    expect(result.exitCode).toBe(0);
  });

  test('writes provided stdin and closes it', async () => {
    const result = await runProcess({
      executable: process.execPath,
      args: ['tests/fixtures/wait-for-stdin-eof.mjs'],
      stdin: 'hello from stdin',
      timeoutMs: 500
    });

    expect(result.status).toBe('success');
    expect(result.stdout.trim()).toBe('stdin-closed:16');
    expect(result.exitCode).toBe(0);
  });

  test('returns failed instead of throwing for synchronous spawn errors on Windows', async () => {
    if (process.platform !== 'win32') {
      return;
    }

    const dir = await mkdtemp(join(tmpdir(), 'rolemux sync spawn '));
    const command = join(dir, 'provider.cmd');
    await writeFile(command, '@echo off\r\necho unreachable\r\n', 'utf8');

    const result = await runProcess({
      executable: command,
      args: [],
      timeoutMs: 5000
    });

    expect(result.status).toBe('failed');
    expect(result.error?.code).toBe('PROCESS_FAILED');
    expect(result.stderr).toContain('spawn');
  });

  test.skipIf(process.platform !== 'win32')('kills the full Windows process tree on timeout', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'rolemux-process-tree-'));
    const pidFile = join(dir, 'child.pid');
    let childPid: number | undefined;
    try {
      const result = await runProcess({
        executable: 'cmd.exe',
        args: ['/d', '/s', '/c', 'node', resolve('tests/fixtures/spawn-child-process.mjs'), pidFile],
        timeoutMs: 200
      });
      childPid = Number(await readFile(pidFile, 'utf8'));
      await new Promise(resolveWait => setTimeout(resolveWait, 150));

      expect(result.status).toBe('timeout');
      expect(result.durationMs).toBeLessThan(2_000);
      expect(isProcessAlive(childPid)).toBe(false);
    } finally {
      if (childPid !== undefined && isProcessAlive(childPid)) {
        process.kill(childPid);
      }
    }
  });
});

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
