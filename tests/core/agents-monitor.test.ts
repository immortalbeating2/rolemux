import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import {
  appendMonitorEvent,
  createMonitorStore,
  readMonitorSnapshot,
  requestMonitorCancel,
  updateMonitorAgent
} from '../../src/core/agents-monitor.js';

describe('agents monitor store', () => {
  test('creates monitor artifacts with queued agents and append-only events', async () => {
    const workdir = await mkdtemp(join(tmpdir(), 'rolemux agents monitor '));

    const store = await createMonitorStore({
      workdir,
      parentTaskId: 'parent',
      title: 'Monitor work',
      manifestPath: 'tasks.json',
      agents: [
        { id: 'one', title: 'One', cli: 'codex', role: 'architect', writePolicy: 'readonly' },
        { id: 'two', title: 'Two', cli: 'claude', role: 'reviewer', writePolicy: 'isolated' }
      ]
    });

    await appendMonitorEvent(store, { agentId: 'one', type: 'agent-running', message: 'provider started' });
    await updateMonitorAgent(store, 'one', { status: 'running', lastEvent: 'provider started' });
    await appendMonitorEvent(store, { agentId: 'one', type: 'agent-success', message: 'output.md written' });
    await updateMonitorAgent(store, 'one', { status: 'success', lastEvent: 'output.md written' });

    const snapshot = await readMonitorSnapshot({ workdir, parentTaskId: 'parent' });
    const events = (await readFile(join(store.parentTaskDir, 'events.jsonl'), 'utf8')).trim().split(/\r?\n/);
    const summary = await readFile(join(store.parentTaskDir, 'summary.md'), 'utf8');

    expect(snapshot.status).toBe('running');
    expect(snapshot.done).toBe(1);
    expect(snapshot.total).toBe(2);
    expect(snapshot.agents[0]).toMatchObject({ id: 'one', cli: 'codex', status: 'success' });
    expect(snapshot.agents[1]).toMatchObject({ id: 'two', cli: 'claude', status: 'queued' });
    expect(events).toHaveLength(2);
    expect(events.every(line => JSON.parse(line).parentTaskId === 'parent')).toBe(true);
    expect(summary).toContain('AGENT');
    expect(summary).toContain('output.md written');
  });

  test('writes cancel requests idempotently and updates recommended action', async () => {
    const workdir = await mkdtemp(join(tmpdir(), 'rolemux agents cancel '));
    const store = await createMonitorStore({
      workdir,
      parentTaskId: 'parent',
      title: 'Cancelable work',
      manifestPath: 'tasks.json',
      agents: [{ id: 'one', title: 'One', cli: 'agy', role: 'summarizer', writePolicy: 'readonly' }]
    });

    const first = await requestMonitorCancel({ workdir, parentTaskId: 'parent' });
    const second = await requestMonitorCancel({ workdir, parentTaskId: 'parent' });
    const snapshot = await readMonitorSnapshot({ workdir, parentTaskId: 'parent' });
    const cancelRaw = await readFile(join(store.parentTaskDir, 'control', 'cancel.json'), 'utf8');

    expect(first.alreadyRequested).toBe(false);
    expect(second.alreadyRequested).toBe(true);
    expect(snapshot.status).toBe('cancel-requested');
    expect(snapshot.nextRecommendedAction).toBe('cancelled');
    expect(JSON.parse(cancelRaw)).toMatchObject({ parentTaskId: 'parent', requested: true });
  });
});
