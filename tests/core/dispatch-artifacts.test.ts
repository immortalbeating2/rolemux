import { existsSync } from 'node:fs';
import { mkdtemp, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, test } from 'vitest';
import { createDispatchArtifacts } from '../../src/core/dispatch-artifacts.js';
import { parseTaskMetadata } from '../../src/core/task-metadata.js';

describe('dispatch artifacts', () => {
  test('writes parent and subtask artifacts', async () => {
    const workdir = await mkdtemp(join(tmpdir(), 'rolemux dispatch artifacts '));
    const record = await createDispatchArtifacts({
      workdir,
      manifestPath: join(workdir, 'rolemux-tasks.json'),
      manifest: {
        version: 1,
        parentTask: { title: 'Dispatch work' },
        subtasks: [
          { id: 'one', title: 'One', role: 'builder', task: 'Do one thing.', writePolicy: 'readonly' }
        ]
      },
      workerCount: 1,
      assignments: [
        { subtaskId: 'one', workerId: 'codex-1', provider: 'codex', role: 'builder', writePolicy: 'readonly' }
      ],
      runs: [
        {
          subtaskId: 'one',
          title: 'One',
          provider: 'codex',
          role: 'builder',
          workerId: 'codex-1',
          writePolicy: 'readonly',
          task: 'Do one thing.',
          prompt: '# Role\nbuilder\n',
          output: 'MOCK_PROVIDER_OUTPUT',
          stderr: '',
          status: 'success',
          exitCode: 0,
          diff: 'diff --git a/feature.txt b/feature.txt\n',
          worktreePath: join(workdir, '.rolemux', 'worktrees', 'parent', 'one')
        }
      ]
    });

    expect(record.parentTaskId).toMatch(/^\d{8}T\d{6}-/);
    expect(existsSync(join(record.parentTaskDir, 'manifest.json'))).toBe(true);
    expect(existsSync(join(record.parentTaskDir, 'summary.md'))).toBe(true);
    expect(existsSync(join(record.parentTaskDir, 'subtasks', 'one', 'output.md'))).toBe(true);
    expect(existsSync(join(record.parentTaskDir, 'subtasks', 'one', 'diff.patch'))).toBe(true);
    expect(existsSync(join(record.parentTaskDir, 'subtasks', 'one', 'worktree.txt'))).toBe(true);

    const metadata = parseTaskMetadata(JSON.parse(await readFile(join(record.parentTaskDir, 'metadata.json'), 'utf8')));
    expect(metadata.command).toBe('dispatch');
    expect(metadata.artifacts.manifest).toBe('manifest.json');
    expect(metadata.dispatch?.subtaskCount).toBe(1);
  });
});
