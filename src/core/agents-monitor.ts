import { existsSync } from 'node:fs';
import { appendFile, mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { CliError } from './cli-error.js';
import type { NativeAgentEvent, NativeAgentStatus } from './native-agent-events.js';

export type AgentMonitorStatus = 'queued' | 'running' | 'success' | 'failed' | 'timeout' | 'canceled';
export type DispatchMonitorStatus = 'queued' | 'running' | 'success' | 'failed' | 'timeout' | 'cancel-requested' | 'canceled';
export type MonitorNextAction = 'wait' | 'inspect' | 'merge-dry-run' | 'resume' | 'cancelled' | 'needs-user-action';

export interface MonitorAgentSeed {
  readonly id: string;
  readonly title: string;
  readonly cli: string;
  readonly role: string;
  readonly writePolicy: string;
}

export interface MonitorAgentSnapshot extends MonitorAgentSeed {
  readonly status: AgentMonitorStatus;
  readonly lastEvent: string;
  readonly startedAt?: string | undefined;
  readonly finishedAt?: string | undefined;
  readonly elapsedMs: number;
  readonly artifactDir?: string | undefined;
  readonly hasDiff: boolean;
  readonly stderrSummary?: string | undefined;
  readonly nativeAgents?: readonly MonitorNativeAgentSnapshot[] | undefined;
}

export interface MonitorNativeAgentSnapshot {
  readonly id: string;
  readonly type: string;
  readonly title: string;
  readonly status: NativeAgentStatus;
  readonly lastEvent: string;
  readonly startedAt: string;
  readonly finishedAt?: string | undefined;
  readonly elapsedMs: number;
  readonly summary?: string | undefined;
}

export interface AgentsMonitorSnapshot {
  readonly parentTaskId: string;
  readonly title: string;
  readonly manifestPath: string;
  readonly workdir: string;
  readonly parentTaskDir: string;
  readonly status: DispatchMonitorStatus;
  readonly startedAt: string;
  readonly updatedAt: string;
  readonly elapsedMs: number;
  readonly done: number;
  readonly total: number;
  readonly agents: readonly MonitorAgentSnapshot[];
  readonly nextRecommendedAction: MonitorNextAction;
}

export interface AgentsMonitorStore {
  readonly workdir: string;
  readonly parentTaskId: string;
  readonly parentTaskDir: string;
}

export interface MonitorEventInput {
  readonly agentId?: string | undefined;
  readonly type: string;
  readonly message: string;
}

const snapshotOperations = new Map<string, Promise<void>>();

/** Creates the monitor artifacts used by agents, TUI, and conversation cards. */
export async function createMonitorStore(input: {
  readonly workdir: string;
  readonly parentTaskId: string;
  readonly title: string;
  readonly manifestPath: string;
  readonly agents: readonly MonitorAgentSeed[];
}): Promise<AgentsMonitorStore> {
  const workdir = resolve(input.workdir);
  const parentTaskDir = join(workdir, '.rolemux', 'tasks', input.parentTaskId);
  await mkdir(join(parentTaskDir, 'control'), { recursive: true });
  await mkdir(join(parentTaskDir, 'subtasks'), { recursive: true });
  const now = new Date().toISOString();
  const snapshot: AgentsMonitorSnapshot = {
    parentTaskId: input.parentTaskId,
    title: input.title,
    manifestPath: input.manifestPath,
    workdir,
    parentTaskDir,
    status: 'queued',
    startedAt: now,
    updatedAt: now,
    elapsedMs: 0,
    done: 0,
    total: input.agents.length,
    agents: input.agents.map(agent => ({
      ...agent,
      status: 'queued',
      lastEvent: 'queued',
      elapsedMs: 0,
      artifactDir: join(parentTaskDir, 'subtasks', agent.id),
      hasDiff: false
    })),
    nextRecommendedAction: 'wait'
  };
  const store = { workdir, parentTaskId: input.parentTaskId, parentTaskDir };
  await writeSnapshot(store, snapshot);
  await writeFile(join(parentTaskDir, 'events.jsonl'), '', 'utf8');
  await writeSummary(store, snapshot);
  return store;
}

/** Returns an existing monitor store or creates it if this dispatch has not been initialized. */
export async function ensureMonitorStore(input: {
  readonly workdir: string;
  readonly parentTaskId: string;
  readonly title: string;
  readonly manifestPath: string;
  readonly agents: readonly MonitorAgentSeed[];
}): Promise<AgentsMonitorStore> {
  const workdir = resolve(input.workdir);
  const parentTaskDir = join(workdir, '.rolemux', 'tasks', input.parentTaskId);
  if (existsSync(join(parentTaskDir, 'monitor.json'))) {
    return { workdir, parentTaskId: input.parentTaskId, parentTaskDir };
  }
  return createMonitorStore(input);
}

/** Appends one monitor event as a JSON line. */
export async function appendMonitorEvent(store: AgentsMonitorStore, event: MonitorEventInput): Promise<void> {
  const timestamp = new Date().toISOString();
  await appendFile(join(store.parentTaskDir, 'events.jsonl'), `${JSON.stringify({
    parentTaskId: store.parentTaskId,
    timestamp,
    ...event
  })}\n`, 'utf8');
}

/** Updates one agent and recomputes the parent monitor snapshot. */
export async function updateMonitorAgent(
  store: AgentsMonitorStore,
  agentId: string,
  patch: Partial<Omit<MonitorAgentSnapshot, keyof MonitorAgentSeed>>
): Promise<AgentsMonitorSnapshot> {
  return mutateMonitorSnapshot(store, (snapshot, now) => {
    const agents = snapshot.agents.map(agent => {
      if (agent.id !== agentId) {
        return refreshAgentElapsed(agent, now);
      }
      const updated = { ...agent, ...patch };
      return refreshAgentElapsed({
        ...updated,
        ...(patch.status === 'running' && updated.startedAt === undefined ? { startedAt: now } : {}),
        ...((patch.status === 'success' || patch.status === 'failed' || patch.status === 'timeout' || patch.status === 'canceled') && updated.finishedAt === undefined
          ? { finishedAt: now }
          : {})
      }, now);
    });
    return recomputeSnapshot({ ...snapshot, agents, updatedAt: now }, now);
  });
}

/** Adds or updates provider-native child activity under one RoleMux worker. */
export async function updateMonitorNativeAgent(
  store: AgentsMonitorStore,
  agentId: string,
  event: NativeAgentEvent
): Promise<AgentsMonitorSnapshot> {
  return mutateMonitorSnapshot(store, (snapshot, now) => {
    const agents = snapshot.agents.map(agent => {
      if (agent.id !== agentId) {
        return refreshAgentElapsed(agent, now);
      }
      const existing = agent.nativeAgents?.find(child => child.id === event.id);
      const child: MonitorNativeAgentSnapshot = {
        id: event.id,
        type: event.type,
        title: event.title,
        status: event.status,
        lastEvent: event.summary ?? event.status,
        startedAt: existing?.startedAt ?? now,
        ...(event.status === 'running' ? {} : { finishedAt: now }),
        elapsedMs: existing?.elapsedMs ?? 0,
        ...(event.summary === undefined ? {} : { summary: event.summary })
      };
      const nativeAgents = [...(agent.nativeAgents ?? []).filter(item => item.id !== event.id), child]
        .map(item => refreshNativeAgentElapsed(item, now));
      return refreshAgentElapsed({ ...agent, nativeAgents }, now);
    });
    return recomputeSnapshot({ ...snapshot, agents, updatedAt: now }, now);
  });
}

/** Reads the current monitor snapshot for a parent dispatch task. */
export async function readMonitorSnapshot(input: { workdir: string; parentTaskId: string }): Promise<AgentsMonitorSnapshot> {
  const parentTaskDir = join(resolve(input.workdir), '.rolemux', 'tasks', input.parentTaskId);
  const snapshotPath = join(parentTaskDir, 'monitor.json');
  try {
    return await enqueueSnapshotOperation(snapshotPath, async () => {
      const raw = await readFile(snapshotPath, 'utf8');
      return refreshSnapshotElapsed(JSON.parse(raw) as AgentsMonitorSnapshot, new Date().toISOString());
    });
  } catch (error) {
    throw new CliError(`Monitor task not found: ${input.parentTaskId}`, {
      code: 'NOT_FOUND',
      details: { parentTaskId: input.parentTaskId, parentTaskDir },
      cause: error
    });
  }
}

/** Lists active dispatch monitors from the current workdir. */
export async function listAgentDispatches(input: { workdir: string }): Promise<AgentsMonitorSnapshot[]> {
  const rootDir = join(resolve(input.workdir), '.rolemux', 'tasks');
  if (!existsSync(rootDir)) {
    return [];
  }
  const entries = await readdir(rootDir, { withFileTypes: true });
  const snapshots: AgentsMonitorSnapshot[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const monitorPath = join(rootDir, entry.name, 'monitor.json');
    if (!existsSync(monitorPath)) {
      continue;
    }
    const snapshot = JSON.parse(await readFile(monitorPath, 'utf8')) as AgentsMonitorSnapshot;
    if (snapshot.status === 'queued' || snapshot.status === 'running' || snapshot.status === 'cancel-requested') {
      snapshots.push(snapshot);
    }
  }
  return snapshots.sort((left, right) => right.startedAt.localeCompare(left.startedAt));
}

/** Requests cancellation without deleting any existing artifacts. */
export async function requestMonitorCancel(input: { workdir: string; parentTaskId: string }): Promise<{
  snapshot: AgentsMonitorSnapshot;
  alreadyRequested: boolean;
}> {
  const snapshot = await readMonitorSnapshot(input);
  const store = {
    workdir: resolve(input.workdir),
    parentTaskId: input.parentTaskId,
    parentTaskDir: snapshot.parentTaskDir
  };
  const cancelPath = join(store.parentTaskDir, 'control', 'cancel.json');
  const alreadyRequested = existsSync(cancelPath);
  await mkdir(join(store.parentTaskDir, 'control'), { recursive: true });
  await writeFile(cancelPath, `${JSON.stringify({
    parentTaskId: input.parentTaskId,
    requested: true,
    requestedAt: new Date().toISOString()
  }, null, 2)}\n`, 'utf8');
  const nextSnapshot = await mutateMonitorSnapshot(store, (snapshot, now) => recomputeSnapshot({
    ...snapshot,
    status: 'cancel-requested',
    updatedAt: now,
    nextRecommendedAction: 'cancelled'
  }, now));
  return { snapshot: nextSnapshot, alreadyRequested };
}

export function isCancelRequested(store: AgentsMonitorStore): boolean {
  return existsSync(join(store.parentTaskDir, 'control', 'cancel.json'));
}

function refreshAgentElapsed(agent: MonitorAgentSnapshot, nowIso: string): MonitorAgentSnapshot {
  const startedAt = agent.startedAt === undefined ? undefined : Date.parse(agent.startedAt);
  const finishedAt = agent.finishedAt === undefined ? undefined : Date.parse(agent.finishedAt);
  const now = Date.parse(nowIso);
  const elapsedMs = startedAt === undefined
    ? agent.elapsedMs
    : Math.max(0, ((finishedAt === undefined || Number.isNaN(finishedAt)) ? now : finishedAt) - startedAt);
  return { ...agent, elapsedMs };
}

function refreshNativeAgentElapsed(agent: MonitorNativeAgentSnapshot, nowIso: string): MonitorNativeAgentSnapshot {
  const end = agent.finishedAt === undefined ? Date.parse(nowIso) : Date.parse(agent.finishedAt);
  return { ...agent, elapsedMs: Math.max(0, end - Date.parse(agent.startedAt)) };
}

function refreshSnapshotElapsed(snapshot: AgentsMonitorSnapshot, nowIso: string): AgentsMonitorSnapshot {
  const agents = snapshot.agents.map(agent => refreshAgentElapsed({
    ...agent,
    ...(agent.nativeAgents === undefined
      ? {}
      : { nativeAgents: agent.nativeAgents.map(child => refreshNativeAgentElapsed(child, nowIso)) })
  }, nowIso));
  const active = snapshot.status === 'queued' || snapshot.status === 'running' || snapshot.status === 'cancel-requested';
  return {
    ...snapshot,
    agents,
    ...(active ? { elapsedMs: Math.max(0, Date.parse(nowIso) - Date.parse(snapshot.startedAt)) } : {})
  };
}

function recomputeSnapshot(snapshot: AgentsMonitorSnapshot, nowIso: string): AgentsMonitorSnapshot {
  const done = snapshot.agents.filter(agent => isTerminalAgentStatus(agent.status)).length;
  const failed = snapshot.agents.some(agent => agent.status === 'failed');
  const timedOut = snapshot.agents.some(agent => agent.status === 'timeout');
  const canceled = snapshot.agents.some(agent => agent.status === 'canceled');
  const running = snapshot.agents.some(agent => agent.status === 'running');
  const queued = snapshot.agents.some(agent => agent.status === 'queued');
  // A terminal provider state is not the same as a durable dispatch result:
  // detached callers may observe monitor.json before output.md is written.
  // Keep the parent running until every terminal worker has its artifact event.
  const artifactsPending = snapshot.agents.some(agent => isTerminalAgentStatus(agent.status)
    && agent.lastEvent !== 'output.md written');
  const cancelStillPending = snapshot.status === 'cancel-requested' && (running || queued);
  const status: DispatchMonitorStatus = cancelStillPending
    ? 'cancel-requested'
    : artifactsPending
      ? 'running'
    : failed
      ? 'failed'
      : timedOut
        ? 'timeout'
        : canceled
          ? 'canceled'
          : running || queued
            ? 'running'
            : 'success';
  const nextRecommendedAction: MonitorNextAction = status === 'success'
    ? 'merge-dry-run'
      : status === 'failed' || status === 'timeout'
        ? 'needs-user-action'
        : status === 'cancel-requested' || status === 'canceled'
          ? 'cancelled'
          : 'wait';
  return {
    ...snapshot,
    status,
    done,
    updatedAt: nowIso,
    elapsedMs: Math.max(0, Date.parse(nowIso) - Date.parse(snapshot.startedAt)),
    nextRecommendedAction
  };
}

function isTerminalAgentStatus(status: AgentMonitorStatus): boolean {
  return status === 'success' || status === 'failed' || status === 'timeout' || status === 'canceled';
}

async function writeSnapshot(store: AgentsMonitorStore, snapshot: AgentsMonitorSnapshot): Promise<void> {
  const snapshotPath = join(store.parentTaskDir, 'monitor.json');
  await enqueueSnapshotOperation(snapshotPath, () => writeSnapshotFile(store, snapshot));
}

/** Serializes the whole monitor read-modify-write transaction so parallel workers cannot overwrite each other. */
async function mutateMonitorSnapshot(
  store: AgentsMonitorStore,
  mutate: (snapshot: AgentsMonitorSnapshot, now: string) => AgentsMonitorSnapshot
): Promise<AgentsMonitorSnapshot> {
  const snapshotPath = join(store.parentTaskDir, 'monitor.json');
  return enqueueSnapshotOperation(snapshotPath, async () => {
    const snapshot = JSON.parse(await readFile(snapshotPath, 'utf8')) as AgentsMonitorSnapshot;
    const nextSnapshot = mutate(snapshot, new Date().toISOString());
    await writeSnapshotFile(store, nextSnapshot);
    await writeSummary(store, nextSnapshot);
    return nextSnapshot;
  });
}

async function writeSnapshotFile(store: AgentsMonitorStore, snapshot: AgentsMonitorSnapshot): Promise<void> {
  const snapshotPath = join(store.parentTaskDir, 'monitor.json');
  const tempPath = join(store.parentTaskDir, `monitor.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`);
  await writeFile(tempPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  await rename(tempPath, snapshotPath);
}

async function writeSummary(store: AgentsMonitorStore, snapshot: AgentsMonitorSnapshot): Promise<void> {
  await writeFile(join(store.parentTaskDir, 'summary.md'), renderAgentsTable(snapshot), 'utf8');
}

export function renderAgentsTable(snapshot: AgentsMonitorSnapshot): string {
  const lines = [
    '# RoleMux Agents',
    '',
    `parentTaskId: ${snapshot.parentTaskId}`,
    `status: ${snapshot.status}`,
    `done: ${snapshot.done} / ${snapshot.total}`,
    '',
    'AGENT | CLI | ROLE | STATUS | LAST EVENT',
    '--- | --- | --- | --- | ---'
  ];
  for (const agent of snapshot.agents) {
    lines.push(`${agent.id} | ${agent.cli} | ${agent.role} | ${agent.status} | ${agent.lastEvent}`);
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

async function enqueueSnapshotOperation<T>(snapshotPath: string, operation: () => Promise<T>): Promise<T> {
  const previous = snapshotOperations.get(snapshotPath) ?? Promise.resolve();
  const operationPromise = previous.catch(() => undefined).then(operation);
  const storedPromise = operationPromise.then(() => undefined, () => undefined);
  snapshotOperations.set(snapshotPath, storedPromise);
  try {
    return await operationPromise;
  } finally {
    if (snapshotOperations.get(snapshotPath) === storedPromise) {
      snapshotOperations.delete(snapshotPath);
    }
  }
}
