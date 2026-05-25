import { resolve } from 'node:path';
import { createTaskStore } from '../core/task-store.js';

export interface CleanCommandOptions {
  workdir?: string;
  dryRun?: boolean;
}

export interface CleanCommandResult {
  status: 'dry-run' | 'cleaned';
  targets: string[];
}

/**
 * 规划清理 RoleMux 管理的任务目录；dry-run 不删除文件。
 */
export async function cleanCommand(options: CleanCommandOptions = {}): Promise<CleanCommandResult> {
  const workdir = resolve(options.workdir ?? process.cwd());
  const result = await createTaskStore({ workdir }).clean({ dryRun: options.dryRun === true });

  return {
    status: result.status,
    targets: [...result.paths]
  };
}
