import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createTaskStore } from '../core/task-store.js';
import { runWorkflow } from '../core/workflow-runner.js';
import { runWithFallback } from '../core/fallback.js';
import { collectRunProvenance } from '../core/run-provenance.js';
import { parseTaskResult, taskResultOutputInstructions, type TaskResult } from '../core/task-result.js';
import { isProviderName, type ProviderCommand, type ProviderName } from '../providers/index.js';

export type RunStatus = 'dry-run' | 'success' | 'failed' | 'timeout' | 'canceled';

export interface RunCommandOptions {
  provider: string;
  role: string;
  task: string;
  workdir?: string;
  dryRun?: boolean;
  fallbackProviders?: string[];
  structuredResult?: boolean;
  maxAttempts?: number;
  timeoutMs?: number;
  authoritativeVerification?: ReadonlyArray<TaskResult['verification'][number]>;
}

export interface RunCommandResult {
  status: RunStatus;
  command: ProviderCommand;
  task: string;
  role: string;
  taskId?: string | undefined;
  provider?: ProviderName | undefined;
  attempts?: readonly unknown[] | undefined;
  result?: TaskResult | undefined;
}

/**
 * 运行单个 provider 任务；dry-run 只返回预览，不执行 provider、不写任务产物。
 */
export async function runCommand(options: RunCommandOptions): Promise<RunCommandResult> {
  const workdir = resolve(options.workdir ?? process.cwd());
  const taskPath = resolve(workdir, options.task);
  const task = await readFile(taskPath, 'utf8');
  const provider = parseProviderName(options.provider);

  if (options.dryRun === true) {
    const preview = await runWorkflow({
      provider,
      role: options.role,
      task,
      workdir,
      dryRun: true,
      ...(options.structuredResult === true ? { outputInstructions: taskResultOutputInstructions } : {})
    });
    return {
      status: 'dry-run',
      command: preview.command,
      task,
      role: options.role
    };
  }

  const fallbackProviders = (options.fallbackProviders ?? []).map(parseProviderName);
  const providerCount = 1 + fallbackProviders.length;
  const maxAttempts = options.maxAttempts ?? providerCount;
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new Error('maxAttempts must be a positive integer.');
  }
  if (options.timeoutMs !== undefined && (!Number.isInteger(options.timeoutMs) || options.timeoutMs < 1)) {
    throw new Error('timeoutMs must be a positive integer.');
  }
  const deadlineAt = options.timeoutMs === undefined ? undefined : Date.now() + options.timeoutMs;
  const workflow = fallbackProviders.length === 0
    ? await runWorkflow({
        provider,
        role: options.role,
        task,
        workdir,
        dryRun: false,
        ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
        ...(options.structuredResult === true ? { outputInstructions: taskResultOutputInstructions } : {})
      })
    : await runWithFallback([provider, ...fallbackProviders], async (fallbackProvider, remainingMs) => runWorkflow({
        provider: fallbackProvider,
        role: options.role,
        task,
        workdir,
        dryRun: false,
        ...(remainingMs === undefined ? {} : { timeoutMs: Math.max(1, Math.ceil(remainingMs)) }),
        ...(options.structuredResult === true ? { outputInstructions: taskResultOutputInstructions } : {})
      }), {
        maxAttempts,
        ...(deadlineAt === undefined ? {} : { deadlineAt })
      });

  const attempts = hasAttempts(workflow) ? workflow.attempts : undefined;
  let result: TaskResult | undefined;
  let status = workflow.status;
  let stderr = workflow.stderr;
  if (options.structuredResult === true && workflow.status === 'success') {
    try {
      const parsed = parseTaskResult(workflow.output);
      result = options.authoritativeVerification === undefined
        ? parsed
        : { ...parsed, verification: [...options.authoritativeVerification] };
    } catch (error) {
      status = 'failed';
      const diagnostic = `Structured result validation failed: ${error instanceof Error ? error.message : String(error)}`;
      stderr = stderr.trim().length === 0 ? diagnostic : `${stderr.trimEnd()}\n${diagnostic}`;
    }
  }
  const provenance = await collectRunProvenance({
    provider: workflow.provider,
    role: options.role,
    workdir,
    prompt: workflow.prompt,
    command: workflow.command,
    timeoutMs: options.timeoutMs,
    structuredResult: options.structuredResult === true
  });
  const record = await createTaskStore({ workdir }).createRun({
    command: 'run',
    provider: workflow.provider,
    role: options.role,
    task,
    prompt: workflow.prompt,
    output: workflow.output,
    stderr,
    status,
    exitCode: workflow.exitCode,
    startedAt: workflow.startedAt,
    finishedAt: workflow.finishedAt,
    durationMs: workflow.durationMs,
    attempts,
    result,
    provenance,
    ...(options.maxAttempts === undefined && options.timeoutMs === undefined
      ? {}
      : {
          budget: {
            maxAttempts,
            timeoutMs: options.timeoutMs ?? null,
            attemptsUsed: attempts?.length ?? 1,
            deadlineReached: hasDeadlineReached(workflow) ? workflow.deadlineReached : workflow.status === 'timeout'
          }
        })
  });

  return {
    status,
    command: workflow.command,
    task,
    role: options.role,
    taskId: record.taskId,
    provider: workflow.provider,
    attempts,
    result
  };
}

function hasAttempts(value: unknown): value is { attempts: readonly unknown[] } {
  return typeof value === 'object' && value !== null && 'attempts' in value && Array.isArray(value.attempts);
}

function hasDeadlineReached(value: unknown): value is { deadlineReached: boolean } {
  return typeof value === 'object' && value !== null && 'deadlineReached' in value
    && typeof value.deadlineReached === 'boolean';
}

function parseProviderName(provider: string): ProviderName {
  if (isProviderName(provider)) {
    return provider;
  }

  throw new Error(`Unknown provider: ${provider}`);
}
