import { runCommand } from './run.js';
import type { ProviderCommand } from '../providers/index.js';
import type { RunCommandResult } from './run.js';

export interface ReviewCommandOptions {
  provider: string;
  role?: string;
  task: string;
  workdir?: string;
  dryRun?: boolean;
  structuredResult?: boolean;
}

export interface ReviewCommandResult {
  status: 'dry-run' | 'success' | 'failed' | 'timeout' | 'canceled';
  preview?: ProviderCommand;
  run?: RunCommandResult;
}

/**
 * 为审查任务生成 provider 调用预览；dry-run 不执行 provider。
 */
export async function reviewCommand(options: ReviewCommandOptions): Promise<ReviewCommandResult> {
  const role = options.role ?? 'reviewer';
  const runOptions = {
    provider: options.provider,
    role,
    task: options.task,
    dryRun: options.dryRun === true,
    structuredResult: options.structuredResult === true
  };
  const result = await runCommand(options.workdir === undefined
    ? runOptions
    : { ...runOptions, workdir: options.workdir });

  if (options.dryRun === true) {
    return {
      status: 'dry-run',
      preview: result.command
    };
  }

  return {
    status: result.status,
    run: result
  };
}
