import { emitKeypressEvents } from 'node:readline';
import { requestMonitorCancel, readMonitorSnapshot } from './agents-monitor.js';
import type { AgentsMonitorSnapshot } from './agents-monitor.js';

export interface AgentsTuiRenderOptions {
  readonly selectedIndex?: number | undefined;
  readonly expanded?: boolean | undefined;
  readonly showHelp?: boolean | undefined;
  readonly confirmCancel?: boolean | undefined;
  readonly footerMessage?: string | undefined;
}

export interface AgentsTuiSessionOptions {
  readonly workdir: string;
  readonly parentTaskId: string;
  readonly refreshMs?: number | undefined;
  readonly input?: NodeJS.ReadStream | undefined;
  readonly output?: NodeJS.WriteStream | undefined;
}

/** Renders the RoleMux Agents terminal monitor screen from a monitor snapshot. */
export function renderAgentsTui(
  snapshot: AgentsMonitorSnapshot,
  optionsOrSelectedIndex: AgentsTuiRenderOptions | number = {}
): string {
  const options = typeof optionsOrSelectedIndex === 'number'
    ? { selectedIndex: optionsOrSelectedIndex }
    : optionsOrSelectedIndex;
  const selectedIndex = Math.min(Math.max(0, options.selectedIndex ?? 0), Math.max(0, snapshot.agents.length - 1));
  const selected = snapshot.agents[selectedIndex];
  const lines = [
    'RoleMux Agents',
    `${snapshot.title}`,
    `parentTaskId: ${snapshot.parentTaskId}`,
    `overall: ${snapshot.status}  done: ${snapshot.done}/${snapshot.total}  elapsed: ${formatDuration(snapshot.elapsedMs)}  next: ${snapshot.nextRecommendedAction}`,
    '',
    'AGENT                CLI      ROLE        STATUS       LAST EVENT'
  ];
  for (const agent of snapshot.agents) {
    const marker = selected?.id === agent.id ? '>' : ' ';
    lines.push(`${marker} ${pad(agent.id, 18)} ${pad(agent.cli, 8)} ${pad(agent.role, 11)} ${pad(agent.status, 12)} ${agent.lastEvent}`);
  }
  lines.push('', 'Detail');
  if (selected !== undefined) {
    lines.push(`selected: ${selected.id} (${selected.title})`);
    lines.push(`last event: ${selected.lastEvent}`);
    lines.push(`elapsed: ${formatDuration(selected.elapsedMs)}`);
    lines.push(`artifact: ${selected.artifactDir ?? 'not written'}`);
    lines.push(`diff: ${selected.hasDiff ? 'available' : 'not available'}`);
    if (options.expanded === true) {
      lines.push(`write policy: ${selected.writePolicy}`);
      lines.push(`stderr: ${selected.stderrSummary ?? 'empty'}`);
    }
  }
  if (options.showHelp === true) {
    lines.push('', 'Help');
    lines.push('q quit TUI without stopping the dispatch');
    lines.push('r refresh now');
    lines.push('i toggle expanded detail');
    lines.push('o print selected artifact path');
    lines.push('c request cancel, then press c again to confirm');
    lines.push('? help');
  }
  if (options.confirmCancel === true) {
    lines.push('', 'Press c again to cancel this dispatch. Press any other key to keep running.');
  }
  if (options.footerMessage !== undefined) {
    lines.push('', options.footerMessage);
  }
  lines.push('', 'q quit   r refresh   i inspect   o artifact   c cancel   ? help');
  return lines.join('\n');
}

/** Runs the interactive full-screen RoleMux Agents terminal monitor. */
export async function runAgentsTuiSession(options: AgentsTuiSessionOptions): Promise<void> {
  const input = options.input ?? process.stdin;
  const output = options.output ?? process.stdout;
  const refreshMs = options.refreshMs ?? 2000;
  let selectedIndex = 0;
  let expanded = false;
  let showHelp = false;
  let confirmCancel = false;
  let footerMessage: string | undefined;
  let closed = false;

  emitKeypressEvents(input);
  const hadRawMode = input.isRaw === true;
  if (input.isTTY) {
    input.setRawMode(true);
  }

  const render = async (): Promise<void> => {
    const snapshot = await readMonitorSnapshot({ workdir: options.workdir, parentTaskId: options.parentTaskId });
    selectedIndex = Math.min(selectedIndex, Math.max(0, snapshot.agents.length - 1));
    output.write('\x1b[2J\x1b[H');
    output.write(renderAgentsTui(snapshot, {
      selectedIndex,
      expanded,
      showHelp,
      confirmCancel,
      ...(footerMessage === undefined ? {} : { footerMessage })
    }));
    output.write('\n');
  };

  const interval = setInterval(() => {
    void render();
  }, refreshMs);
  const close = (): void => {
    if (closed) {
      return;
    }
    closed = true;
    clearInterval(interval);
    input.off('keypress', onKeypress);
    if (input.isTTY) {
      input.setRawMode(hadRawMode);
    }
    input.pause();
    output.write('\n');
  };
  const onKeypress = (chunk: string, key: { name?: string | undefined; ctrl?: boolean | undefined }): void => {
    void (async () => {
      if (key.ctrl === true && key.name === 'c') {
        close();
        return;
      }
      if (confirmCancel && key.name !== 'c') {
        confirmCancel = false;
      }
      if (key.name === 'q') {
        close();
        return;
      }
      if (key.name === 'up') {
        selectedIndex = Math.max(0, selectedIndex - 1);
      } else if (key.name === 'down') {
        selectedIndex += 1;
      } else if (key.name === 'r') {
        footerMessage = 'refreshed';
      } else if (key.name === 'i') {
        expanded = !expanded;
      } else if (key.name === '?' || chunk === '?') {
        showHelp = !showHelp;
      } else if (key.name === 'o') {
        const snapshot = await readMonitorSnapshot({ workdir: options.workdir, parentTaskId: options.parentTaskId });
        footerMessage = snapshot.agents[selectedIndex]?.artifactDir ?? snapshot.parentTaskDir;
      } else if (key.name === 'c') {
        if (confirmCancel) {
          await requestMonitorCancel({ workdir: options.workdir, parentTaskId: options.parentTaskId });
          footerMessage = 'cancel requested';
          confirmCancel = false;
        } else {
          confirmCancel = true;
        }
      }
      await render();
    })();
  };
  input.on('keypress', onKeypress);
  await render();
  await new Promise<void>(resolve => {
    const timer = setInterval(() => {
      if (closed) {
        clearInterval(timer);
        resolve();
      }
    }, 50);
  });
}

function pad(value: string, width: number): string {
  const normalized = value.length > width ? `${value.slice(0, Math.max(0, width - 1))}…` : value;
  return normalized.padEnd(width);
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${remainder.toString().padStart(2, '0')}`;
}
