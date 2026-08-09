import { constants } from 'node:fs';
import { access } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import { CliError } from './cli-error.js';
import { findExecutable } from './find-executable.js';
import { runProcess } from './process-runner.js';
import { runPtyProcess, stripTerminalSequences } from './pty-runner.js';
import { getProviderAdapter, isProviderName, type ProviderName } from '../providers/index.js';

const probeToken = 'ROLEMUX_PROBE_OK';

export interface ProviderPreflightEntry {
  readonly provider: ProviderName;
  readonly status: 'ready' | 'missing-executable';
  readonly executable?: string | undefined;
  readonly reason?: string | undefined;
  readonly nextAction?: string | undefined;
}

export interface ProviderProbeResult {
  readonly status: 'passed' | 'failed' | 'timeout';
  readonly category?: 'auth' | 'network' | 'output' | 'process' | 'timeout' | undefined;
  readonly durationMs: number;
  readonly diagnostic?: string | undefined;
}

/** Checks every selected provider before any model process is allowed to start. */
export async function assertProvidersReady(providers: readonly ProviderName[]): Promise<readonly ProviderPreflightEntry[]> {
  const entries = await Promise.all([...new Set(providers)].map(checkProviderExecutable));
  const blocked = entries.filter(entry => entry.status !== 'ready');
  if (blocked.length > 0) {
    throw new CliError('Provider preflight blocked execution.', {
      code: 'PROVIDER_PREFLIGHT_BLOCKED',
      details: {
        status: 'blocked',
        providers: blocked
      }
    });
  }
  return entries;
}

/** Validates external provider names, then runs the shared executable preflight. */
export async function assertProviderNamesReady(providers: readonly string[]): Promise<readonly ProviderPreflightEntry[]> {
  const parsed = providers.map(provider => {
    if (!isProviderName(provider)) {
      throw new CliError(`Unknown provider: ${provider}`, {
        code: 'PROVIDER_NOT_FOUND',
        details: { provider }
      });
    }
    return provider;
  });
  return assertProvidersReady(parsed);
}

/** Executes one fixed, read-only model token probe through the existing adapter. */
export async function probeProvider(provider: ProviderName, workdir: string, timeoutMs: number): Promise<ProviderProbeResult> {
  const command = getProviderAdapter(provider).buildCommand({
    prompt: `Return exactly ${probeToken} and nothing else.`,
    workdir,
    role: 'probe'
  });
  const input = {
    executable: command.executable,
    args: command.args,
   ...(command.stdin === undefined ? {} : { stdin: command.stdin }),
   ...(command.cwd === undefined ? {} : { cwd: command.cwd }),
    successOutput: probeToken,
   timeoutMs
 };
  const result = command.transport === 'pty'
    ? await runPtyProcess(input)
    : await runProcess(input);
  const stdout = command.stripTerminalOutput === true ? stripTerminalSequences(result.stdout) : result.stdout;
  const stderr = command.stripTerminalOutput === true ? stripTerminalSequences(result.stderr) : result.stderr;
  if (result.status === 'timeout') {
    return { status: 'timeout', category: 'timeout', durationMs: result.durationMs, diagnostic: compactDiagnostic(stdout, stderr) };
  }
  if (result.status === 'success' && stdout.includes(probeToken)) {
    return { status: 'passed', durationMs: result.durationMs };
  }
  const diagnostic = compactDiagnostic(stdout, stderr);
  return {
    status: 'failed',
    category: classifyProbeFailure(result.status, `${stdout}\n${stderr}`),
    durationMs: result.durationMs,
    ...(diagnostic === undefined ? {} : { diagnostic })
  };
}

async function checkProviderExecutable(provider: ProviderName): Promise<ProviderPreflightEntry> {
  const override = process.env[`ROLEMUX_PROVIDER_${provider.toUpperCase()}_COMMAND`];
  const found = override === undefined
    ? await findExecutable(provider)
    : await findCommand(override);
  if (found.path !== undefined) {
    return { provider, status: 'ready', executable: found.path };
  }
  return {
    provider,
    status: 'missing-executable',
    reason: `${override ?? provider} was not found or executable.`,
    nextAction: `Install or repair ${provider}, then run: rolemux doctor --providers ${provider}`
  };
}

async function findCommand(command: string): Promise<{ path?: string }> {
  if (!isAbsolute(command) && !/[\\/]/.test(command)) {
    const found = await findExecutable(command);
    return found.path === undefined ? {} : { path: found.path };
  }
  try {
    await access(command, constants.X_OK);
    return { path: command };
  } catch {
    return {};
  }
}

function classifyProbeFailure(status: string, output: string): ProviderProbeResult['category'] {
  if (/not logged in|log(?:ged)? in|unauthorized|authentication|credential|\b401\b/i.test(output)) {
    return 'auth';
  }
  if (/network|ECONN|ENOTFOUND|connection|socket|DNS/i.test(output)) {
    return 'network';
  }
  return status === 'success' ? 'output' : 'process';
}

function compactDiagnostic(stdout: string, stderr: string): string | undefined {
  const line = `${stderr}\n${stdout}`.split(/\r?\n/).map(value => value.trim()).find(Boolean);
  return line === undefined ? undefined : line.slice(0, 300);
}
