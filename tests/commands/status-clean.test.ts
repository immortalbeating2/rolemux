import { mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, test } from 'vitest';
import { cleanCommand } from '../../src/commands/clean.js';
import { statusCommand } from '../../src/commands/status.js';
import { createTaskStore } from '../../src/core/task-store.js';

describe('status and clean commands', () => {
  test('status reads recent tasks and clean dry-run does not delete them', async () => {
    const workdir = await mkdtemp(join(tmpdir(), 'rolemux status clean '));
    const store = createTaskStore({ workdir });
    await store.createRun({
      command: 'run',
      provider: 'codex',
      role: 'builder',
      task: 'Task',
      prompt: 'Prompt',
      output: 'Output',
      stderr: '',
      status: 'success',
      exitCode: 0
    });

    const status = await statusCommand({ workdir, limit: 5 });
    const clean = await cleanCommand({ workdir, dryRun: true });
    const statusAfter = await statusCommand({ workdir, limit: 5 });

    expect(status.tasks).toHaveLength(1);
    expect(clean.status).toBe('dry-run');
    expect(statusAfter.tasks).toHaveLength(1);
  });
});
