import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { agentsCommand } from '../../src/commands/agents.js';
import { cancelCommand } from '../../src/commands/cancel.js';
import { createMonitorStore, updateMonitorAgent } from '../../src/core/agents-monitor.js';

describe('agents monitor commands', () => {
  test('lists active dispatches and renders a human-readable agent table', async () => {
    const workdir = await mkdtemp(join(tmpdir(), 'rolemux agents command '));
    const store = await createMonitorStore({
      workdir,
      parentTaskId: 'parent',
      title: 'Command monitor',
      manifestPath: 'tasks.json',
      agents: [{ id: 'review', title: 'Review', cli: 'claude', role: 'reviewer', writePolicy: 'readonly' }]
    });
    await updateMonitorAgent(store, 'review', { status: 'running', lastEvent: 'waiting for provider output' });

    const list = await agentsCommand({ workdir });
    const table = await agentsCommand({ workdir, parentTask: 'parent' });

    expect(list.status).toBe('active');
    expect(list.dispatches[0]?.parentTaskId).toBe('parent');
    expect(table.status).toBe('running');
    expect(table.text).toContain('AGENT');
    expect(table.text).toContain('review');
    expect(table.text).toContain('waiting for provider output');
  });

  test('returns stable json and cancel writes a request', async () => {
    const workdir = await mkdtemp(join(tmpdir(), 'rolemux agents json '));
    await createMonitorStore({
      workdir,
      parentTaskId: 'parent',
      title: 'Json monitor',
      manifestPath: 'tasks.json',
      agents: [{ id: 'summary', title: 'Summary', cli: 'agy', role: 'summarizer', writePolicy: 'readonly' }]
    });

    const json = await agentsCommand({ workdir, parentTask: 'parent', json: true });
    const cancel = await cancelCommand({ workdir, parentTask: 'parent' });
    const afterCancel = await agentsCommand({ workdir, parentTask: 'parent', json: true });

    expect(json.snapshot?.agents[0]).toMatchObject({ id: 'summary', cli: 'agy', status: 'queued' });
    expect(cancel.status).toBe('cancel-requested');
    expect(afterCancel.snapshot?.status).toBe('cancel-requested');
  });

  test('renders the TUI screen from the same monitor snapshot', async () => {
    const workdir = await mkdtemp(join(tmpdir(), 'rolemux agents tui '));
    const store = await createMonitorStore({
      workdir,
      parentTaskId: 'parent',
      title: 'TUI monitor',
      manifestPath: 'tasks.json',
      agents: [{ id: 'plan', title: 'Plan', cli: 'codex', role: 'architect', writePolicy: 'readonly' }]
    });
    await updateMonitorAgent(store, 'plan', { status: 'success', lastEvent: 'output.md written' });
    await writeFile(join(store.parentTaskDir, 'subtasks-placeholder.txt'), 'placeholder\n', 'utf8');

    const tui = await agentsCommand({ workdir, parentTask: 'parent', tui: true });

    expect(tui.text).toContain('RoleMux Agents');
    expect(tui.text).toContain('parent');
    expect(tui.text).toContain('plan');
    expect(tui.text).toContain('q quit');
  });
});
