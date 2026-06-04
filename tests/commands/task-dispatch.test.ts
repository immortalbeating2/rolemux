import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, test } from 'vitest';
import { dispatchCommand } from '../../src/commands/dispatch.js';
import { manifestValidateCommand } from '../../src/commands/manifest.js';
import { mergeCommand } from '../../src/commands/merge.js';
import { splitCommand } from '../../src/commands/split.js';

describe('task dispatch commands', () => {
  test('validates a manifest and reports next commands', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'rolemux manifest command '));
    const manifestPath = join(dir, 'rolemux-tasks.json');
    await writeFile(manifestPath, JSON.stringify({
      version: 1,
      parentTask: { title: 'Dispatch work' },
      subtasks: [{ id: 'one', title: 'One', task: 'Do one thing.' }]
    }), 'utf8');

    const result = await manifestValidateCommand({ manifest: manifestPath });

    expect(result.status).toBe('success');
    expect(result.subtaskCount).toBe(1);
    expect(result.nextCommands[0]).toContain('rolemux dispatch');
  });

  test('normalizes tasks-dir into a manifest file', async () => {
    const outputDir = await mkdtemp(join(tmpdir(), 'rolemux split output '));
    const out = join(outputDir, 'rolemux-tasks.json');

    const result = await splitCommand({
      tasksDir: 'tests/fixtures/subtasks',
      out,
      dryRun: false
    });

    const raw = await readFile(out, 'utf8');
    const manifest = JSON.parse(raw) as { subtasks: unknown[] };
    expect(result.status).toBe('success');
    expect(result.manifestPath).toBe(out);
    expect(manifest.subtasks).toHaveLength(2);
  });

  test('split dry-run returns the normalized manifest without writing output', async () => {
    const outputDir = await mkdtemp(join(tmpdir(), 'rolemux split dry output '));
    const out = join(outputDir, 'rolemux-tasks.json');

    const result = await splitCommand({
      tasksDir: 'tests/fixtures/subtasks',
      out,
      dryRun: true
    });

    expect(result.status).toBe('dry-run');
    expect(result.manifest.subtasks).toHaveLength(2);
    await expect(readFile(out, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
  });

  test('dispatch dry-run assigns subtasks to workers', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'rolemux dispatch command '));
    const manifestPath = join(dir, 'rolemux-tasks.json');
    await writeFile(manifestPath, JSON.stringify({
      version: 1,
      parentTask: { title: 'Dispatch work' },
      subtasks: [
        { id: 'one', title: 'One', task: 'Do one thing.' },
        { id: 'two', title: 'Two', task: 'Do another thing.' },
        { id: 'three', title: 'Three', provider: 'agy', task: 'Use fixed provider.' }
      ]
    }), 'utf8');

    const result = await dispatchCommand({
      manifest: manifestPath,
      providers: 'codex:2,claude:1',
      dryRun: true
    });

    expect(result.status).toBe('dry-run');
    expect(result.assignments.map(assignment => assignment.provider)).toEqual(['codex', 'codex', 'agy']);
    expect(result.nextCommands[0]).toContain('rolemux dispatch');
  });

  test('merge dry-run returns preview-only result', async () => {
    const result = await mergeCommand({
      parentTask: '20260604T120000-abc123',
      dryRun: true,
      autoMerge: false
    });

    expect(result.status).toBe('dry-run');
    expect(result.requiresUserAction).toBe(true);
    expect(result.nextCommands[0]).toContain('--auto-merge');
  });
});
