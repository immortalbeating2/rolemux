import { runCommand } from './run.js';
import type { ProviderCommand } from '../providers/index.js';
import type { RunCommandResult } from './run.js';

export interface PlanCommandOptions {
  providers: string[];
  task: string;
  workdir?: string;
  dryRun?: boolean;
  structuredResult?: boolean;
}

export interface PlanCommandResult {
  status: 'dry-run' | 'success' | 'failed';
  previews?: ProviderCommand[];
  runs?: RunCommandResult[];
}

/**
 * 为一个任务生成规划工作流预览；dry-run 不执行 provider。
 */
export async function planCommand(options: PlanCommandOptions): Promise<PlanCommandResult> {
  if (options.dryRun !== true) {
    const runs = await Promise.all(options.providers.map(provider => runCommand({
      provider,
      role: 'architect',
      task: options.task,
      ...(options.workdir === undefined ? {} : { workdir: options.workdir }),
      dryRun: false,
      structuredResult: options.structuredResult === true
    })));

    return {
      status: runs.every(run => run.status === 'success') ? 'success' : 'failed',
      runs
    };
  }

  const previews = await Promise.all(options.providers.map(async provider => {
    const runOptions = {
      provider,
      role: 'architect',
      task: options.task,
      dryRun: true,
      structuredResult: options.structuredResult === true
    };
    const result = await runCommand(options.workdir === undefined
      ? runOptions
      : { ...runOptions, workdir: options.workdir });

    return result.command;
  }));

  return {
    status: 'dry-run',
    previews
  };
}
