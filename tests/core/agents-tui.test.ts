import { describe, expect, test } from 'vitest';
import { renderAgentsTui } from '../../src/core/agents-tui.js';
import type { AgentsMonitorSnapshot } from '../../src/core/agents-monitor.js';

describe('agents TUI renderer', () => {
  test('renders main screen with selected agent detail', () => {
    const text = renderAgentsTui(fakeSnapshot(), { selectedIndex: 1 });

    expect(text).toContain('RoleMux Agents');
    expect(text).toContain('overall: running');
    expect(text).toContain('> build');
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
});

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
        cli: 'claude',
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
