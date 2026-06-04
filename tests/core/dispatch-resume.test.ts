import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { createDispatchArtifacts } from '../../src/core/dispatch-artifacts.js';
import { loadDispatchResume } from '../../src/core/dispatch-resume.js';

describe('loadDispatchResume', () => {
  let workdir: string;

  beforeEach(async () => {
    workdir = await mkdtemp(join(tmpdir(), 'rolemux dispatch resume '));
  });

  afterEach(async () => {
    await rm(workdir, { recursive: true, force: true });
  });

  test('summarizes parent dispatch artifacts and subtask artifact state', async () => {
    const manifestPath = join(workdir, 'rolemux-tasks.json');
    const manifest = {
      version: 1 as const,
      parentTask: { title: 'Resume parent' },
      subtasks: [
        {
          id: 'ok',
          title: 'Successful task',
          task: 'Write safely.',
          role: 'builder',
          writePolicy: 'isolated' as const
        },
        {
          id: 'failed',
          title: 'Failed task',
          task: 'Review safely.',
          role: 'reviewer',
          writePolicy: 'readonly' as const
        }
      ]
    };
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    const record = await createDispatchArtifacts({
      workdir,
      parentTaskId: 'parent-task',
      manifestPath,
      manifest,
      workerCount: 2,
      assignments: [
        { subtaskId: 'ok', workerId: 'codex-1', provider: 'codex', role: 'builder', writePolicy: 'isolated' },
        { subtaskId: 'failed', workerId: 'claude-1', provider: 'claude', role: 'reviewer', writePolicy: 'readonly' }
      ],
      runs: [
        {
          subtaskId: 'ok',
          title: 'Successful task',
          provider: 'codex',
          role: 'builder',
          workerId: 'codex-1',
          writePolicy: 'isolated',
          task: 'Write safely.',
          prompt: 'prompt ok',
          output: 'output ok',
          stderr: '',
          status: 'success',
          exitCode: 0,
          diff: 'diff --git a/a.txt b/a.txt\n',
          worktreePath: join(workdir, '.rolemux', 'worktrees', 'parent-task', 'ok')
        },
        {
          subtaskId: 'failed',
          title: 'Failed task',
          provider: 'claude',
          role: 'reviewer',
          workerId: 'claude-1',
          writePolicy: 'readonly',
          task: 'Review safely.',
          prompt: 'prompt failed',
          output: 'output failed',
          stderr: 'provider failed',
          status: 'failed',
          exitCode: 1
        }
      ]
    });

    const summary = await loadDispatchResume({ workdir, parentTaskId: record.parentTaskId });

    expect(summary.status).toBe('failed');
    expect(summary.parentTaskId).toBe('parent-task');
    expect(summary.subtaskCount).toBe(2);
    expect(summary.successCount).toBe(1);
    expect(summary.failedCount).toBe(1);
    expect(summary.timeoutCount).toBe(0);
    expect(summary.subtasks).toEqual([
      expect.objectContaining({
        subtaskId: 'failed',
        title: 'Failed task',
        provider: 'claude',
        role: 'reviewer',
        writePolicy: 'readonly',
        status: 'failed',
        hasDiff: false,
        hasWorktree: false
      }),
      expect.objectContaining({
        subtaskId: 'ok',
        title: 'Successful task',
        provider: 'codex',
        role: 'builder',
        writePolicy: 'isolated',
        status: 'success',
        hasDiff: true,
        hasWorktree: true
      })
    ]);
    expect(summary.nextCommands).toContain('rolemux merge --parent-task parent-task --workdir . --dry-run');
    expect(summary.nextCommands).toContain('rolemux worktree cleanup --parent-task parent-task --workdir . --dry-run');
    expect(summary.warnings).toContain('Some subtasks did not succeed; inspect subtask output artifacts before merging.');
    expect(summary.requiresUserAction).toBe(true);
  });

  test('rejects a missing parent dispatch task with a structured error', async () => {
    await mkdir(join(workdir, '.rolemux', 'tasks'), { recursive: true });

    await expect(loadDispatchResume({ workdir, parentTaskId: 'missing-parent' })).rejects.toMatchObject({
      code: 'NOT_FOUND'
    });
  });
});
