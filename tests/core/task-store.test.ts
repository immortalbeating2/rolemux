import { mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, test } from 'vitest';
import { createTaskStore } from '../../src/core/task-store.js';

describe('task store', () => {
  test('writes core task artifacts under a unique task directory', async () => {
    const workdir = await mkdtemp(join(tmpdir(), 'rolemux task store '));
    const store = createTaskStore({ workdir });
    const record = await store.createRun({
      command: 'run',
      provider: 'codex',
      role: 'builder',
      task: 'Build a feature.',
      prompt: 'Role: builder\nTask: Build a feature.',
      output: 'Done',
      stderr: '',
      status: 'success',
      exitCode: 0
    });

    expect(record.taskId).toMatch(/^\d{8}T\d{6}-/);
    expect(record.artifacts.task).toBe('task.md');
    expect(record.artifacts.report).toBe('report.html');
    expect(record.metadata.status).toBe('success');
  });

  test('preserves workflow timing metadata when provided', async () => {
    const workdir = await mkdtemp(join(tmpdir(), 'rolemux task store timing '));
    const store = createTaskStore({ workdir });
    const startedAt = new Date('2026-06-07T01:00:00.000Z');
    const finishedAt = new Date('2026-06-07T01:00:42.500Z');

    const record = await store.createRun({
      command: 'run',
      provider: 'agy',
      role: 'summarizer',
      task: 'Summarize.',
      prompt: 'Role: summarizer\nTask: Summarize.',
      output: '',
      stderr: 'Provider exited successfully but produced no stdout; treating this run as failed.',
      status: 'failed',
      exitCode: 0,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: 42500
    });

    expect(record.metadata.startedAt).toBe(startedAt.toISOString());
    expect(record.metadata.finishedAt).toBe(finishedAt.toISOString());
    expect(record.metadata.durationMs).toBe(42500);
    expect(record.metadata.status).toBe('failed');
  });
});
