import { mkdtemp, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, test } from 'vitest';
import { runCommand } from '../../src/commands/run.js';

describe('run command dry-run', () => {
  test('returns a preview without executing a provider', async () => {
    const workdir = await mkdtemp(join(tmpdir(), 'rolemux dry run '));
    const task = join(workdir, 'task.md');
    await writeFile(task, 'Build a CLI skeleton.', 'utf8');

    const result = await runCommand({
      provider: 'codex',
      role: 'builder',
      task,
      workdir,
      dryRun: true
    });

    expect(result.status).toBe('dry-run');
    expect(result.command.provider).toBe('codex');
    expect(result.command.args).toContain('exec');
    expect(result.command.args.join('\n')).not.toContain('You are the builder');
    expect(result.command.stdin).toContain('You are the builder');
  });
});
