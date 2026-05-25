import { mkdtemp, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, test } from 'vitest';
import { discussCommand } from '../../src/commands/discuss.js';
import { planCommand } from '../../src/commands/plan.js';
import { reviewCommand } from '../../src/commands/review.js';

describe('workflow commands', () => {
  test('plan, review, and discuss support dry-run', async () => {
    const workdir = await mkdtemp(join(tmpdir(), 'rolemux workflow '));
    const task = join(workdir, 'task.md');
    await writeFile(task, 'Design the runner.', 'utf8');

    const plan = await planCommand({ providers: ['codex', 'claude'], task, workdir, dryRun: true });
    const review = await reviewCommand({ provider: 'codex', task, workdir, dryRun: true });
    const discuss = await discussCommand({ providers: ['codex', 'claude', 'agy'], task, workdir, mode: 'parallel', dryRun: true });

    expect(plan.status).toBe('dry-run');
    expect(plan.previews).toHaveLength(2);
    expect(review.status).toBe('dry-run');
    expect(discuss.status).toBe('dry-run');
    expect(discuss.previews).toHaveLength(3);
  });

  test('discuss rejects invalid mode values', async () => {
    const workdir = await mkdtemp(join(tmpdir(), 'rolemux workflow invalid '));
    const task = join(workdir, 'task.md');
    await writeFile(task, 'Discuss the runner.', 'utf8');

    await expect(discussCommand({
      providers: ['codex'],
      task,
      workdir,
      mode: 'invalid' as 'parallel',
      dryRun: true
    })).rejects.toThrow('Invalid discuss mode');
  });
});
