import { spawn } from 'node:child_process';
import { CliError } from './cli-error.js';

/** Normalized process execution status. */
export type ProcessRunStatus = 'success' | 'failed' | 'timeout' | 'canceled';

/** Command input accepted by the process runner. */
export interface ProcessRunInput {
  readonly executable: string;
  readonly args: readonly string[];
  readonly stdin?: string | undefined;
  readonly cwd?: string | undefined;
  readonly timeoutMs?: number | undefined;
  readonly env?: NodeJS.ProcessEnv | undefined;
  readonly signal?: AbortSignal | undefined;
}

/** Normalized result for every provider process. */
export interface ProcessRunResult {
  readonly status: ProcessRunStatus;
  readonly executable: string;
  readonly args: readonly string[];
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number | null;
  readonly signal: NodeJS.Signals | null;
  readonly durationMs: number;
  readonly error?: CliError | undefined;
}

/** Runs an external process with args passed as an array and shell disabled. */
export async function runProcess(input: ProcessRunInput): Promise<ProcessRunResult> {
  const startedAt = Date.now();

  return new Promise<ProcessRunResult>(resolve => {
    let child;
    try {
      child = spawn(input.executable, [...input.args], {
        cwd: input.cwd,
        env: input.env,
        shell: false,
        // Always close stdin explicitly so non-interactive providers receive EOF immediately.
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true
      });
    } catch (error) {
      const stderr = error instanceof Error ? error.message : String(error);
      resolve({
        status: 'failed',
        executable: input.executable,
        args: input.args,
        stdout: '',
        stderr,
        exitCode: null,
        signal: null,
        durationMs: Date.now() - startedAt,
        error: new CliError(`Failed to start process: ${input.executable}`, {
          code: 'PROCESS_FAILED',
          cause: error
        })
      });
      return;
    }

    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let canceled = false;
    let settled = false;

    const timeout = input.timeoutMs
      ? setTimeout(() => {
          timedOut = true;
          child.kill('SIGTERM');
        }, input.timeoutMs)
      : undefined;
    const abortHandler = (): void => {
      canceled = true;
      child.kill('SIGTERM');
    };
    if (input.signal?.aborted === true) {
      abortHandler();
    } else {
      input.signal?.addEventListener('abort', abortHandler, { once: true });
    }

    child.stdout?.setEncoding('utf8');
    child.stderr?.setEncoding('utf8');
    child.stdout?.on('data', chunk => {
      stdout += String(chunk);
    });
    child.stderr?.on('data', chunk => {
      stderr += String(chunk);
    });
    child.stdin?.on('error', () => {
      // Some CLIs close stdin early after parsing enough input; stdout/stderr still decide the run result.
    });
    child.stdin?.end(input.stdin ?? '');

    child.on('error', error => {
      if (settled) {
        return;
      }
      settled = true;
      if (timeout !== undefined) {
        clearTimeout(timeout);
      }
      input.signal?.removeEventListener('abort', abortHandler);
      const durationMs = Date.now() - startedAt;
      resolve({
        status: 'failed',
        executable: input.executable,
        args: input.args,
        stdout,
        stderr,
        exitCode: null,
        signal: null,
        durationMs,
        error: new CliError(`Failed to start process: ${input.executable}`, {
          code: 'PROCESS_FAILED',
          cause: error
        })
      });
    });

    child.on('close', (exitCode, signal) => {
      if (settled) {
        return;
      }
      settled = true;
      if (timeout !== undefined) {
        clearTimeout(timeout);
      }
      input.signal?.removeEventListener('abort', abortHandler);
      const durationMs = Date.now() - startedAt;
      if (canceled) {
        resolve({
          status: 'canceled',
          executable: input.executable,
          args: input.args,
          stdout,
          stderr,
          exitCode,
          signal,
          durationMs,
          error: new CliError(`Process canceled: ${input.executable}`, {
            code: 'PROCESS_FAILED'
          })
        });
        return;
      }
      if (timedOut) {
        resolve({
          status: 'timeout',
          executable: input.executable,
          args: input.args,
          stdout,
          stderr,
          exitCode,
          signal,
          durationMs,
          error: new CliError(`Process timed out: ${input.executable}`, {
            code: 'PROCESS_TIMEOUT',
            details: { timeoutMs: input.timeoutMs }
          })
        });
        return;
      }

      resolve({
        status: exitCode === 0 ? 'success' : 'failed',
        executable: input.executable,
        args: input.args,
        stdout,
        stderr,
        exitCode,
        signal,
        durationMs
      });
    });
  });
}
