import { CliError } from './cli-error.js';
import type { ProcessRunInput, ProcessRunResult } from './process-runner.js';

/** Runs a TTY-dependent provider process through a pseudo terminal. */
export async function runPtyProcess(input: ProcessRunInput): Promise<ProcessRunResult> {
  const startedAt = Date.now();

  try {
    const pty = await import('node-pty');

    return await new Promise<ProcessRunResult>(resolve => {
      let output = '';
      let resolved = false;
      const terminal = pty.spawn(input.executable, [...input.args], {
        name: 'xterm-256color',
        cols: 140,
        rows: 40,
        env: {
          ...process.env,
          ...input.env,
          TERM: 'xterm-256color'
        },
        ...(input.cwd !== undefined ? { cwd: input.cwd } : {})
      });

      const timeout = input.timeoutMs
        ? setTimeout(() => {
            safeKill(terminal);
            finish({
              status: 'timeout',
              exitCode: null,
              signal: null,
              error: new CliError(`PTY process timed out: ${input.executable}`, {
                code: 'PROCESS_TIMEOUT',
                details: { timeoutMs: input.timeoutMs }
              })
            });
          }, input.timeoutMs)
        : undefined;
      const abortHandler = (): void => {
        safeKill(terminal);
        finish({
          status: 'canceled',
          exitCode: null,
          signal: null,
          error: new CliError(`PTY process canceled: ${input.executable}`, {
            code: 'PROCESS_FAILED'
          })
        });
      };
      if (input.signal?.aborted === true) {
        abortHandler();
      } else {
        input.signal?.addEventListener('abort', abortHandler, { once: true });
      }

      terminal.onData(chunk => {
        output += chunk;
      });

      terminal.onExit(event => {
        finish({
          status: event.exitCode === 0 ? 'success' : 'failed',
          exitCode: event.exitCode,
          signal: null
        });
      });

      function finish(result: {
        status: ProcessRunResult['status'];
        exitCode: number | null;
        signal: NodeJS.Signals | null;
        error?: CliError | undefined;
      }): void {
        if (resolved) {
          return;
        }
        resolved = true;
        if (timeout !== undefined) {
          clearTimeout(timeout);
        }
        input.signal?.removeEventListener('abort', abortHandler);
        disposeTerminal(terminal, result.exitCode === null);
        resolve({
          status: result.status,
          executable: input.executable,
          args: input.args,
          stdout: stripTerminalSequences(output),
          stderr: '',
          exitCode: result.exitCode,
          signal: result.signal,
          durationMs: Date.now() - startedAt,
          ...(result.error !== undefined ? { error: result.error } : {})
        });
      }
    });
  } catch (error) {
    return {
      status: 'failed',
      executable: input.executable,
      args: input.args,
      stdout: '',
      stderr: error instanceof Error ? error.message : String(error),
      exitCode: null,
      signal: null,
      durationMs: Date.now() - startedAt,
      error: new CliError(`Failed to start PTY process: ${input.executable}`, {
        code: 'PROCESS_FAILED',
        cause: error
      })
    };
  }
}

/** Removes common ANSI/OSC/control sequences from PTY output. */
export function stripTerminalSequences(input: string): string {
  return input
    .replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g, '')
    .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '')
    .replace(/\x1b[=>][^\r\n]*/g, '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .trim();
}

function disposeTerminal(terminal: { kill: () => void }, forceKill: boolean): void {
  if (!forceKill && process.platform === 'win32' && tryQuietWindowsConptyDispose(terminal)) {
    return;
  }
  safeKill(terminal);
}

function tryQuietWindowsConptyDispose(terminal: unknown): boolean {
  const windowsTerminal = terminal as {
    _close?: () => void;
    _agent?: {
      _conoutSocketWorker?: { dispose: () => void } | undefined;
      _inSocket?: { destroy: () => void; readable: boolean } | undefined;
      _outSocket?: { destroy: () => void; readable: boolean } | undefined;
      _pty?: unknown;
      _ptyNative?: { kill: (pty: unknown, useConptyDll: boolean) => void } | undefined;
      _useConpty?: boolean | undefined;
      _useConptyDll?: boolean | undefined;
    } | undefined;
  };
  const agent = windowsTerminal._agent;
  if (agent?._useConpty !== true || agent._ptyNative === undefined || agent._pty === undefined) {
    return false;
  }

  try {
    windowsTerminal._close?.();
    if (agent._inSocket !== undefined) {
      agent._inSocket.readable = false;
      agent._inSocket.destroy();
    }
    if (agent._outSocket !== undefined) {
      agent._outSocket.readable = false;
      agent._outSocket.destroy();
    }
    agent._ptyNative.kill(agent._pty, agent._useConptyDll === true);
    agent._conoutSocketWorker?.dispose();
    return true;
  } catch {
    return false;
  }
}

function safeKill(terminal: { kill: () => void }): void {
  try {
    terminal.kill();
  } catch {
    // Process may already be gone.
  }
}
