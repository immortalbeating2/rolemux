import { execFile } from 'node:child_process';
import { mkdtemp, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, test } from 'vitest';

const execFileAsync = promisify(execFile);
const repoRoot = resolve('.');

describe('linked CLI entry E2E', () => {
  test('runs main when dist cli is invoked through a linked package path', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'rolemux linked cli '));
    const linkedRoot = join(tempDir, 'rolemux');
    await symlink(repoRoot, linkedRoot, process.platform === 'win32' ? 'junction' : 'dir');

    const { stdout } = await execFileAsync(process.execPath, [join(linkedRoot, 'dist', 'cli.js'), '--help']);

    expect(stdout).toContain('Usage: rolemux');
  });
});
