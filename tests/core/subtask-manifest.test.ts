import { mkdtemp, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, test } from 'vitest';
import {
  normalizeTasksDirectory,
  parseSubtaskManifest,
  readSubtaskManifest
} from '../../src/core/subtask-manifest.js';

describe('subtask manifest', () => {
  test('parses a valid manifest and applies default role and write policy', () => {
    const manifest = parseSubtaskManifest({
      version: 1,
      parentTask: { title: 'Dispatch work', source: 'big-task.md' },
      defaults: { role: 'builder', writePolicy: 'isolated' },
      subtasks: [
        {
          id: 'schema',
          title: 'Define schema',
          task: 'Create the manifest schema.'
        }
      ]
    });

    expect(manifest.subtasks[0]?.role).toBe('builder');
    expect(manifest.subtasks[0]?.writePolicy).toBe('isolated');
  });

  test('rejects duplicate subtask ids', () => {
    expect(() => parseSubtaskManifest({
      version: 1,
      parentTask: { title: 'Dispatch work' },
      subtasks: [
        { id: 'same', title: 'One', task: 'First task.' },
        { id: 'same', title: 'Two', task: 'Second task.' }
      ]
    })).toThrow('Duplicate subtask id: same');
  });

  test('loads manifest JSON from disk', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'rolemux manifest '));
    const manifestPath = join(dir, 'rolemux-tasks.json');
    await writeFile(manifestPath, JSON.stringify({
      version: 1,
      parentTask: { title: 'Dispatch work' },
      subtasks: [{ id: 'one', title: 'One', task: 'Do one thing.' }]
    }), 'utf8');

    const manifest = await readSubtaskManifest(manifestPath);

    expect(manifest.parentTask.title).toBe('Dispatch work');
    expect(manifest.subtasks).toHaveLength(1);
  });

  test('normalizes a tasks directory into a manifest', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'rolemux tasks dir '));
    await writeFile(join(dir, 'api-contract.md'), '# API Contract\n\nDesign CLI arguments.', 'utf8');
    await writeFile(join(dir, 'tests.md'), 'Write tests for dispatch.', 'utf8');

    const manifest = await normalizeTasksDirectory({
      tasksDir: dir,
      title: 'Directory tasks',
      source: dir
    });

    expect(manifest.subtasks.map(subtask => subtask.id)).toEqual(['api-contract', 'tests']);
    expect(manifest.subtasks[0]?.title).toBe('API Contract');
    expect(manifest.subtasks[0]?.task).toContain('Design CLI arguments.');
  });
});
