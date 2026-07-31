import { PassThrough } from 'node:stream';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { createMonitorStore } from '../../src/core/agents-monitor.js';
import { renderAgentsTui, runAgentsTuiSession } from '../../src/core/agents-tui.js';
import type { AgentsMonitorSnapshot } from '../../src/core/agents-monitor.js';

describe('agents TUI renderer', () => {
  test('renders main screen with selected agent detail', () => {
    const text = renderAgentsTui(fakeSnapshot(), { selectedIndex: 1 });

    expect(text).toContain('RoleMux Agents');
    expect(text).toContain('overall: running');
    expect(text).toContain('> build');
    expect(text).toContain('opencode');
    expect(text).toContain('last event: provider process started');
  });

  test('renders expanded details, help, and cancel confirmation states', () => {
    const detail = renderAgentsTui(fakeSnapshot(), { selectedIndex: 1, expanded: true });
    const help = renderAgentsTui(fakeSnapshot(), { showHelp: true });
    const cancel = renderAgentsTui(fakeSnapshot(), { confirmCancel: true });

    expect(detail).toContain('stderr: provider warming up');
    expect(help).toContain('? help');
    expect(help).toContain('q');
    expect(cancel).toContain('Press c again to cancel this dispatch');
  });

  test('recognizes question mark keypresses whose key name is undefined', async () => {
    const workdir = await mkdtemp(join(tmpdir(), 'rolemux agents tui input '));
    await createMonitorStore({
      workdir,
      parentTaskId: 'parent',
      title: 'Interactive monitor',
      manifestPath: 'tasks.json',
      agents: [{ id: 'one', title: 'One', cli: 'grok', role: 'reviewer', writePolicy: 'readonly' }]
    });
    const input = new PassThrough() as PassThrough & {
      isTTY: boolean;
      isRaw: boolean;
      setRawMode: (mode: boolean) => PassThrough;
    };
    input.isTTY = true;
    input.isRaw = false;
    input.setRawMode = (mode: boolean) => {
      input.isRaw = mode;
      return input;
    };
    const output = new PassThrough();
    let rendered = '';
    output.on('data', chunk => {
      rendered += chunk.toString();
    });

    const session = runAgentsTuiSession({
      workdir,
      parentTaskId: 'parent',
      refreshMs: 60_000,
      input: input as unknown as NodeJS.ReadStream,
      output: output as unknown as NodeJS.WriteStream
    });
    await waitUntil(() => rendered.includes('RoleMux Agents'));
    input.write('?');
    const helpShown = await waitUntil(() => rendered.includes('\nHelp\n'), 500, false);
    input.write('q');
    await session;

    expect(helpShown).toBe(true);
    expect(input.isRaw).toBe(false);
    expect(input.isPaused()).toBe(true);
  });
});

async function waitUntil(check: () => boolean, timeoutMs = 2000, throwOnTimeout = true): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (check()) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  if (throwOnTimeout) {
    throw new Error(`Timed out after ${timeoutMs}ms`);
  }
  return false;
}

function fakeSnapshot(): AgentsMonitorSnapshot {
  return {
    parentTaskId: 'parent',
    title: 'Fake dispatch',
    manifestPath: 'tasks.json',
    workdir: 'C:/repo',
    parentTaskDir: 'C:/repo/.rolemux/tasks/parent',
    status: 'running',
    startedAt: new Date(Date.now() - 3000).toISOString(),
    updatedAt: new Date().toISOString(),
    elapsedMs: 3000,
    done: 1,
    total: 2,
    agents: [
      {
        id: 'plan',
        title: 'Plan',
        cli: 'codex',
        role: 'architect',
        writePolicy: 'readonly',
        status: 'success',
        lastEvent: 'output.md written',
        elapsedMs: 1000,
        artifactDir: 'C:/repo/.rolemux/tasks/parent/subtasks/plan',
        hasDiff: false
      },
      {
        id: 'build',
        title: 'Build',
        cli: 'opencode',
        role: 'builder',
        writePolicy: 'isolated',
        status: 'running',
        lastEvent: 'provider process started',
        startedAt: new Date(Date.now() - 2000).toISOString(),
        elapsedMs: 2000,
        artifactDir: 'C:/repo/.rolemux/tasks/parent/subtasks/build',
        hasDiff: true,
        stderrSummary: 'provider warming up'
      }
    ],
    nextRecommendedAction: 'wait'
  };
}
