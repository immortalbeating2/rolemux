import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test, vi } from 'vitest';
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

  test('preserves concurrent worker starts in one monitor snapshot', async () => {
    const workdir = await mkdtemp(join(tmpdir(), 'rolemux concurrent monitor '));
    const store = await createMonitorStore({
      workdir,
      parentTaskId: 'parent',
      title: 'Concurrent work',
      manifestPath: 'tasks.json',
      agents: [
        { id: 'one', title: 'One', cli: 'codex', role: 'architect', writePolicy: 'readonly' },
        { id: 'two', title: 'Two', cli: 'grok', role: 'reviewer', writePolicy: 'readonly' }
      ]
    });

    await Promise.all([
      updateMonitorAgent(store, 'one', { status: 'running', lastEvent: 'provider started' }),
      updateMonitorAgent(store, 'two', { status: 'running', lastEvent: 'provider started' })
    ]);

    const snapshot = await readMonitorSnapshot({ workdir, parentTaskId: 'parent' });
    expect(snapshot.agents).toEqual([
      expect.objectContaining({ id: 'one', status: 'running', startedAt: expect.any(String) }),
      expect.objectContaining({ id: 'two', status: 'running', startedAt: expect.any(String) })
    ]);
  });

  test('refreshes running elapsed time whenever the monitor is read', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-04T00:00:00.000Z'));
    try {
      const workdir = await mkdtemp(join(tmpdir(), 'rolemux live elapsed '));
      const store = await createMonitorStore({
        workdir,
        parentTaskId: 'parent',
        title: 'Live elapsed',
        manifestPath: 'tasks.json',
        agents: [{ id: 'one', title: 'One', cli: 'codex', role: 'architect', writePolicy: 'readonly' }]
      });
      await updateMonitorAgent(store, 'one', { status: 'running', lastEvent: 'provider started' });

      vi.advanceTimersByTime(5_000);
      const snapshot = await readMonitorSnapshot({ workdir, parentTaskId: 'parent' });

      expect(snapshot.elapsedMs).toBe(5_000);
      expect(snapshot.agents[0]?.elapsedMs).toBe(5_000);
    } finally {
      vi.useRealTimers();
    }
  });

  test('stores native children under their RoleMux parent without changing worker totals', async () => {
    const workdir = await mkdtemp(join(tmpdir(), 'rolemux native agents monitor '));
    const store = await createMonitorStore({
      workdir,
      parentTaskId: 'parent',
      title: 'Native children',
      manifestPath: 'tasks.json',
      agents: [{ id: 'one', title: 'One', cli: 'claude', role: 'reviewer', writePolicy: 'readonly' }]
    });

    const { updateMonitorNativeAgent } = await import('../../src/core/agents-monitor.js');
    await updateMonitorNativeAgent(store, 'one', {
      id: 'child-1',
      type: 'reviewer',
      title: 'Review API',
      status: 'running'
    });
    const snapshot = await updateMonitorNativeAgent(store, 'one', {
      id: 'child-1',
      type: 'reviewer',
      title: 'Review API',
      status: 'success',
      summary: 'API_OK'
    });

    expect(snapshot.total).toBe(1);
    expect(snapshot.done).toBe(0);
    expect(snapshot.agents[0]?.nativeAgents).toEqual([
      expect.objectContaining({ id: 'child-1', status: 'success', summary: 'API_OK' })
    ]);
  });
});
