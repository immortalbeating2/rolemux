import { getProviderAdapter } from '../providers/index.js';
import { ProviderName, ProviderCommand } from '../providers/provider.js';
import { buildPrompt } from './prompt-builder.js';
import { runProcess } from './process-runner.js';
import { runPtyProcess, stripTerminalSequences } from './pty-runner.js';
import { loadRolePrompt } from './role-loader.js';

/** Single workflow run request. */
export interface WorkflowRunInput {
  readonly provider: ProviderName;
  readonly role: string;
  readonly task: string;
  readonly workdir: string;
  readonly context?: readonly string[] | undefined;
  readonly dryRun?: boolean;
  readonly timeoutMs?: number;
  readonly signal?: AbortSignal | undefined;
}

/** Workflow runner result used by command modules. */
export interface WorkflowRunResult {
  readonly status: 'dry-run' | 'success' | 'failed' | 'timeout' | 'canceled';
  readonly provider: ProviderName;
  readonly role: string;
  readonly prompt: string;
  readonly command: ProviderCommand;
  readonly output: string;
  readonly stderr: string;
  readonly exitCode: number | null;
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly durationMs: number;
}

/** Runs one provider workflow or returns a dry-run preview. */
export async function runWorkflow(input: WorkflowRunInput): Promise<WorkflowRunResult> {
  const rolePrompt = await loadRolePrompt({ role: input.role, workdir: input.workdir });
  const prompt = buildPrompt({
    role: input.role,
    task: input.task,
    ...(input.context === undefined ? {} : { context: input.context }),
    ...(rolePrompt === undefined ? {} : { rolePrompt })
  });
  const adapter = getProviderAdapter(input.provider);
  const command = adapter.buildCommand({ prompt, workdir: input.workdir, role: input.role });

  if (input.dryRun) {
    const dryRunAt = new Date().toISOString();
    return {
      status: 'dry-run',
      provider: input.provider,
      role: input.role,
      prompt,
      command,
      output: '',
      stderr: '',
      exitCode: null,
      startedAt: dryRunAt,
      finishedAt: dryRunAt,
      durationMs: 0
    };
  }

  const startedAt = new Date();
  const processInput = {
    executable: command.executable,
    args: command.args,
    ...(command.stdin !== undefined ? { stdin: command.stdin } : {}),
    ...(command.cwd !== undefined ? { cwd: command.cwd } : {}),
    ...(input.timeoutMs !== undefined || command.timeoutMs !== undefined
      ? { timeoutMs: input.timeoutMs ?? command.timeoutMs }
      : {}),
    ...(input.signal !== undefined ? { signal: input.signal } : {})
  };
  const processResult = command.transport === 'pty'
    ? await runPtyProcess(processInput)
    : await runProcess(processInput);
  const finishedAt = new Date(startedAt.getTime() + processResult.durationMs);
  const output = command.stripTerminalOutput === true
    ? stripTerminalSequences(processResult.stdout)
    : processResult.stdout;
  const stderr = command.stripTerminalOutput === true
    ? stripTerminalSequences(processResult.stderr)
    : processResult.stderr;
  const normalizedResult = normalizeProviderResult({ ...processResult, stdout: output, stderr });

  return {
    status: normalizedResult.status,
    provider: input.provider,
    role: input.role,
    prompt,
    command,
    output,
    stderr: normalizedResult.stderr,
    exitCode: processResult.exitCode,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: processResult.durationMs
  };
}

function normalizeProviderResult(processResult: Awaited<ReturnType<typeof runProcess>>): {
  status: WorkflowRunResult['status'];
  stderr: string;
} {
  const knownFailure = detectKnownProviderFailure(processResult);
  if (knownFailure !== undefined) {
    return {
      status: 'failed',
      stderr: appendDiagnostic(processResult.stderr, knownFailure)
    };
  }

  if (processResult.status !== 'success' || processResult.stdout.trim().length > 0) {
    return {
      status: processResult.status,
      stderr: processResult.stderr
    };
  }

  const message = 'Provider exited successfully but produced no stdout; treating this run as failed.';
  return {
    status: 'failed',
    stderr: appendDiagnostic(processResult.stderr, message)
  };
}

function detectKnownProviderFailure(processResult: Awaited<ReturnType<typeof runProcess>>): string | undefined {
  const combinedOutput = `${processResult.stdout}\n${processResult.stderr}`;
  if (/windows sandbox:\s*CryptUnprotectData failed/i.test(combinedOutput)) {
    return 'Provider output contains a known Codex Windows sandbox failure; treating this run as failed.';
  }
  return undefined;
}

function appendDiagnostic(stderr: string, message: string): string {
  return stderr.trim().length === 0
    ? message
    : `${stderr.trimEnd()}\n${message}`;
}
