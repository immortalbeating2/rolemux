import { requestMonitorCancel } from '../core/agents-monitor.js';
import type { AgentsMonitorSnapshot } from '../core/agents-monitor.js';

export interface CancelCommandOptions {
  readonly parentTask: string;
  readonly workdir?: string | undefined;
}

export interface CancelCommandResult {
  readonly status: 'cancel-requested';
  readonly parentTaskId: string;
  readonly alreadyRequested: boolean;
  readonly snapshot: AgentsMonitorSnapshot;
}

/** Requests cancellation for a running RoleMux agent dispatch. */
export async function cancelCommand(options: CancelCommandOptions): Promise<CancelCommandResult> {
  const result = await requestMonitorCancel({
    workdir: options.workdir ?? process.cwd(),
    parentTaskId: options.parentTask
  });
  return {
    status: 'cancel-requested',
    parentTaskId: options.parentTask,
    alreadyRequested: result.alreadyRequested,
    snapshot: result.snapshot
  };
}
