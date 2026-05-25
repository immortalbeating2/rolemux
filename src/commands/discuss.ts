import { runCommand } from './run.js';
import type { ProviderCommand } from '../providers/index.js';
import type { RunCommandResult } from './run.js';

export interface DiscussCommandOptions {
  providers: string[];
  task: string;
  workdir?: string;
  mode?: 'parallel' | 'serial';
  dryRun?: boolean;
}

export interface DiscussCommandResult {
  status: 'dry-run' | 'success' | 'failed';
  mode: 'parallel' | 'serial';
  previews?: ProviderCommand[];
  runs?: RunCommandResult[];
}

/**
 * 为多 provider 讨论生成调用预览；dry-run 不执行 provider。
 */
export async function discussCommand(options: DiscussCommandOptions): Promise<DiscussCommandResult> {
  const mode = options.mode ?? 'parallel';
  if (mode !== 'parallel' && mode !== 'serial') {
    throw new Error(`Invalid discuss mode: ${String(mode)}`);
  }

  const buildRun = (provider: string, dryRun: boolean): Promise<RunCommandResult> => {
    const runOptions = {
      provider,
      role: 'summarizer',
      task: options.task,
      dryRun
    };
    return runCommand(options.workdir === undefined
      ? runOptions
      : { ...runOptions, workdir: options.workdir });
  };

  if (options.dryRun !== true) {
    const runs = mode === 'parallel'
      ? await Promise.all(options.providers.map(provider => buildRun(provider, false)))
      : [];

    if (mode === 'serial') {
      for (const provider of options.providers) {
        runs.push(await buildRun(provider, false));
      }
    }

    return {
      status: runs.every(run => run.status === 'success') ? 'success' : 'failed',
      mode,
      runs
    };
  }

  const previews = await Promise.all(options.providers.map(async provider => {
    const result = await buildRun(provider, true);
    return result.command;
  }));

  return {
    status: 'dry-run',
    mode,
    previews
  };
}
