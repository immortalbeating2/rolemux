import { describe, expect, test, vi } from 'vitest';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { routeCommand } from '../../src/commands/route.js';
import { createCli } from '../../src/cli.js';

describe('route command', () => {
  test('routes only through explicitly available providers', async () => {
    const result = await routeCommand({
      taskKind: 'research',
      available: ['codex', 'grok', 'opencode'],
      exclude: ['codex'],
      maxProviders: 1
    });

    expect(result.selected).toEqual(['grok']);
    expect(result.availabilitySource).toBe('explicit');
  });

  test('exposes deterministic routing through CLI', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    try {
      await createCli().parseAsync([
        'node', 'rolemux', 'route', '--task-kind', 'research', '--available', 'codex,grok,opencode',
        '--exclude', 'codex', '--max-providers', '1'
      ]);
      expect(JSON.parse(String(log.mock.calls.at(-1)?.[0])).selected).toEqual(['grok']);
    } finally {
      log.mockRestore();
    }
  });

  test('lets structured discuss use routing when providers are omitted', async () => {
    const workdir = await mkdtemp(join(tmpdir(), 'rolemux routed discuss cli '));
    const task = join(workdir, 'task.md');
    await writeFile(task, 'Route a research discussion.', 'utf8');
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    try {
      await createCli().parseAsync([
        'node', 'rolemux', 'discuss', '--task', task, '--workdir', workdir, '--mode', 'structured',
        '--task-kind', 'research', '--available', 'codex,grok', '--max-providers', '1', '--dry-run'
      ]);
      const result = JSON.parse(String(log.mock.calls.at(-1)?.[0]));
      expect(result.routing.selected).toEqual(['grok']);
    } finally {
      log.mockRestore();
    }
  });
});
