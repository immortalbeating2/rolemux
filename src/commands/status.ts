import { resolve } from 'node:path';
import { createTaskStore } from '../core/task-store.js';

export interface StatusCommandOptions {
  workdir?: string;
  limit?: number;
}

export interface StatusTaskSummary {
  taskId: string;
  status?: string;
  command?: string;
  provider?: string;
  role?: string;
}

export interface StatusCommandResult {
  tasks: StatusTaskSummary[];
}

/**
 * 读取最近任务摘要；正式读写契约由 task-store 负责维护。
 */
export async function statusCommand(options: StatusCommandOptions = {}): Promise<StatusCommandResult> {
  const workdir = resolve(options.workdir ?? process.cwd());
  const records = await createTaskStore({ workdir }).listRuns(options.limit ?? 10);
  const tasks = records.map(record => {
    const metadata = record.metadata;
    const summary: StatusTaskSummary = { taskId: record.taskId };

    if (metadata.status !== undefined) summary.status = metadata.status;
    if (metadata.command !== undefined) summary.command = metadata.command;
    if (metadata.provider !== undefined) summary.provider = metadata.provider;
    if (metadata.role !== undefined) summary.role = metadata.role;

    return summary;
  });

  return { tasks };
}
