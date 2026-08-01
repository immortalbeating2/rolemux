import { createHash } from 'node:crypto';
import { runProcess } from './process-runner.js';
import type { RunProvenance } from './task-metadata.js';
import type { ProviderCommand, ProviderName } from '../providers/index.js';

const versionCache = new Map<ProviderName, string | null>();

/** Collects reproducible facts without reading provider credentials or configuration files. */
export async function collectRunProvenance(input: {
  provider: ProviderName;
  role: string;
  workdir: string;
  prompt: string;
  command: ProviderCommand;
  timeoutMs?: number | undefined;
  structuredResult: boolean;
}): Promise<RunProvenance> {
  const [gitHead, providerCliVersion] = await Promise.all([
    readGitHead(input.workdir),
    readProviderVersion(input.provider, input.command, input.workdir)
  ]);
  return {
    gitHead,
    promptSha256: sha256(input.prompt),
    executionConfigSha256: sha256(JSON.stringify({
      provider: input.provider,
      role: input.role,
      timeoutMs: input.timeoutMs ?? null,
      structuredResult: input.structuredResult
    })),
    providerExecutable: input.command.executable,
    providerCliVersion,
    model: { requested: null, resolved: null, source: 'not-reported' },
    humanApproval: 'not-recorded'
  };
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

async function readGitHead(workdir: string): Promise<string | null> {
  const result = await runProcess({ executable: 'git', args: ['rev-parse', 'HEAD'], cwd: workdir, timeoutMs: 5_000 });
  return result.status === 'success' ? result.stdout.trim() || null : null;
}

async function readProviderVersion(provider: ProviderName, command: ProviderCommand, workdir: string): Promise<string | null> {
  const override = process.env[`ROLEMUX_PROVIDER_${provider.toUpperCase()}_COMMAND`];
  if (override !== undefined) {
    return null;
  }
  if (versionCache.has(provider)) {
    return versionCache.get(provider) ?? null;
  }
  const versionCommand = provider === 'codex' && process.platform === 'win32'
    ? { executable: command.executable, args: ['/d', '/s', '/c', 'codex.cmd', '--version'] }
    : { executable: command.executable, args: ['--version'] };
  const result = await runProcess({ ...versionCommand, cwd: workdir, timeoutMs: 5_000 });
  const version = result.status === 'success' ? result.stdout.trim().split(/\r?\n/, 1)[0] || null : null;
  versionCache.set(provider, version);
  return version;
}
