import { spawn } from 'node:child_process';
import { CliError } from './cli-error.js';

/** Normalized process execution status. */
export type ProcessRunStatus = 'success' | 'failed' | 'timeout';

/** Command input accepted by the process runner. */
export interface ProcessRunInput {
  readonly executable: string;
  readonly args: readonly string[];
  readonly cwd?: string | undefined;
  readonly timeoutMs?: number | undefined;
  readonly env?: NodeJS.ProcessEnv | undefined;
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
    const child = spawn(input.executable, [...input.args], {
      cwd: input.cwd,
      env: input.env,
      shell: false,
      windowsHide: true
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timeout = input.timeoutMs
      ? setTimeout(() => {
          timedOut = true;
          child.kill('SIGTERM');
        }, input.timeoutMs)
      : undefined;

    child.stdout?.setEncoding('utf8');
    child.stderr?.setEncoding('utf8');
    child.stdout?.on('data', chunk => {
      stdout += String(chunk);
    });
    child.stderr?.on('data', chunk => {
      stderr += String(chunk);
    });

    child.on('error', error => {
      if (timeout !== undefined) {
        clearTimeout(timeout);
      }
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
      if (timeout !== undefined) {
        clearTimeout(timeout);
      }
      const durationMs = Date.now() - startedAt;
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
