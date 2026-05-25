import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createTaskStore } from '../core/task-store.js';
import { runWorkflow } from '../core/workflow-runner.js';
import { runWithFallback } from '../core/fallback.js';
import type { ProviderCommand, ProviderName } from '../providers/index.js';

export type RunStatus = 'dry-run' | 'success' | 'failed' | 'timeout';

export interface RunCommandOptions {
  provider: string;
  role: string;
  task: string;
  workdir?: string;
  dryRun?: boolean;
  fallbackProviders?: string[];
}

export interface RunCommandResult {
  status: RunStatus;
  command: ProviderCommand;
  task: string;
  role: string;
  taskId?: string | undefined;
  provider?: ProviderName | undefined;
  attempts?: readonly unknown[] | undefined;
}

/**
 * 运行单个 provider 任务；dry-run 只返回预览，不执行 provider、不写任务产物。
 */
export async function runCommand(options: RunCommandOptions): Promise<RunCommandResult> {
  const workdir = resolve(options.workdir ?? process.cwd());
  const taskPath = resolve(workdir, options.task);
  const task = await readFile(taskPath, 'utf8');
  const provider = parseProviderName(options.provider);
  const primaryWorkflow = await runWorkflow({
    provider,
    role: options.role,
    task,
    workdir,
    dryRun: options.dryRun === true
  });

  if (options.dryRun === true) {
    return {
      status: 'dry-run',
      command: primaryWorkflow.command,
      task,
      role: options.role
    };
  }

  const fallbackProviders = (options.fallbackProviders ?? []).map(parseProviderName);
  const workflow = fallbackProviders.length === 0
    ? primaryWorkflow
    : await runWithFallback([provider, ...fallbackProviders], async fallbackProvider => runWorkflow({
        provider: fallbackProvider,
        role: options.role,
        task,
        workdir,
        dryRun: false
      }));

  const attempts = hasAttempts(workflow) ? workflow.attempts : undefined;
  const record = await createTaskStore({ workdir }).createRun({
    command: 'run',
    provider: workflow.provider,
    role: options.role,
    task,
    prompt: workflow.prompt,
    output: workflow.output,
    stderr: workflow.stderr,
    status: workflow.status,
    exitCode: workflow.exitCode,
    attempts
  });

  return {
    status: workflow.status,
    command: workflow.command,
    task,
    role: options.role,
    taskId: record.taskId,
    provider: workflow.provider,
    attempts
  };
}

function hasAttempts(value: unknown): value is { attempts: readonly unknown[] } {
  return typeof value === 'object' && value !== null && 'attempts' in value && Array.isArray(value.attempts);
}

function parseProviderName(provider: string): ProviderName {
  if (provider === 'codex' || provider === 'claude' || provider === 'agy') {
    return provider;
  }

  throw new Error(`Unknown provider: ${provider}`);
}
