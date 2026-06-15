import { listAgentDispatches, readMonitorSnapshot, renderAgentsTable } from '../core/agents-monitor.js';
import { renderAgentsTui } from '../core/agents-tui.js';
import type { AgentsMonitorSnapshot } from '../core/agents-monitor.js';

export interface AgentsCommandOptions {
  readonly parentTask?: string | undefined;
  readonly workdir?: string | undefined;
  readonly json?: boolean | undefined;
  readonly tui?: boolean | undefined;
}

export interface AgentsCommandResult {
  readonly status: string;
  readonly dispatches: readonly AgentsMonitorSnapshot[];
  readonly snapshot?: AgentsMonitorSnapshot | undefined;
  readonly text: string;
}

/** Reads RoleMux agent monitor state without invoking providers. */
export async function agentsCommand(options: AgentsCommandOptions): Promise<AgentsCommandResult> {
  const workdir = options.workdir ?? process.cwd();
  if (options.parentTask === undefined) {
    const dispatches = await listAgentDispatches({ workdir });
    return {
      status: dispatches.length > 0 ? 'active' : 'empty',
      dispatches,
      text: renderDispatchList(dispatches)
    };
  }

  const snapshot = await readMonitorSnapshot({ workdir, parentTaskId: options.parentTask });
  const text = options.tui === true ? renderAgentsTui(snapshot) : renderAgentsTable(snapshot);
  return {
    status: snapshot.status,
    dispatches: [],
    snapshot: options.json === true ? snapshot : snapshot,
    text
  };
}

function renderDispatchList(dispatches: readonly AgentsMonitorSnapshot[]): string {
  if (dispatches.length === 0) {
    return [
      'RoleMux Agents',
      '',
      'No active dispatches found.',
      'Use rolemux agents --parent-task <id> to inspect a known dispatch.',
      ''
    ].join('\n');
  }
  const lines = ['Active RoleMux dispatches', ''];
  dispatches.forEach((dispatch, index) => {
    lines.push(`${index + 1}. ${dispatch.parentTaskId}  ${dispatch.status}  done ${dispatch.done}/${dispatch.total}`);
  });
  lines.push('');
  return lines.join('\n');
}
