import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { dispatchResumeCommand } from '../../src/commands/dispatch-resume.js';
import { createDispatchArtifacts } from '../../src/core/dispatch-artifacts.js';

describe('dispatchResumeCommand', () => {
  let workdir: string;

  beforeEach(async () => {
    workdir = await mkdtemp(join(tmpdir(), 'rolemux dispatch resume command '));
  });

  afterEach(async () => {
    await rm(workdir, { recursive: true, force: true });
  });

  test('returns a resume summary for a parent task id', async () => {
    const manifestPath = join(workdir, 'rolemux-tasks.json');
    const manifest = {
      version: 1 as const,
      parentTask: { title: 'Command resume parent' },
      subtasks: [
        {
          id: 'one',
          title: 'One',
          task: 'Read only.',
          role: 'summarizer',
          writePolicy: 'readonly' as const
        }
      ]
    };
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    await createDispatchArtifacts({
      workdir,
      parentTaskId: 'parent-task',
      manifestPath,
      manifest,
      workerCount: 1,
      assignments: [
        { subtaskId: 'one', workerId: 'codex-1', provider: 'codex', role: 'summarizer', writePolicy: 'readonly' }
      ],
      runs: [
        {
          subtaskId: 'one',
          title: 'One',
          provider: 'codex',
          role: 'summarizer',
          workerId: 'codex-1',
          writePolicy: 'readonly',
          task: 'Read only.',
          prompt: 'prompt',
          output: 'output',
          stderr: '',
          status: 'success',
          exitCode: 0
        }
      ]
    });

    const result = await dispatchResumeCommand({ parentTask: 'parent-task', workdir });

    expect(result.status).toBe('success');
    expect(result.parentTaskId).toBe('parent-task');
    expect(result.subtasks).toHaveLength(1);
    expect(result.requiresUserAction).toBe(false);
  });
});
