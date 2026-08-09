import { findExecutable } from '../core/find-executable.js';
import { getProviderAdapter, providerNames, type ProviderName } from '../providers/index.js';
import { probeProvider, type ProviderProbeResult } from '../core/provider-preflight.js';

export interface DoctorCommandOptions {
  pathEnv?: string;
  providers?: ProviderName[];
  probe?: boolean;
  probeTimeoutMs?: number;
}

export interface ProviderDoctorResult {
  available: boolean;
  nativeAgentEvents: boolean;
  executable?: string;
  probe?: ProviderProbeResult;
}

export interface DoctorCommandResult {
  ok: boolean;
  providers: Record<ProviderName, ProviderDoctorResult>;
}

const defaultProviders: ProviderName[] = [...providerNames];

/**
 * 检查 provider 可执行文件是否可被 PATH 找到；缺失 provider 不视为命令崩溃。
 */
export async function doctorCommand(options: DoctorCommandOptions = {}): Promise<DoctorCommandResult> {
  const providers = options.providers ?? defaultProviders;
  const results = Object.fromEntries(
    providerNames.map(provider => [provider, {
      available: false,
      nativeAgentEvents: getProviderAdapter(provider).capabilities.nativeAgentEvents
    }])
  ) as Record<ProviderName, ProviderDoctorResult>;

  for (const provider of providers) {
    const executable = await findExecutable(provider, options.pathEnv === undefined ? {} : { pathEnv: options.pathEnv });
    if (executable.path === undefined) {
      results[provider] = {
        available: false,
        nativeAgentEvents: getProviderAdapter(provider).capabilities.nativeAgentEvents
      };
      continue;
    }
    const probe = options.probe === true
      ? await probeProvider(provider, process.cwd(), options.probeTimeoutMs ?? 30_000)
      : undefined;
    results[provider] = {
      available: true,
      nativeAgentEvents: getProviderAdapter(provider).capabilities.nativeAgentEvents,
      executable: executable.path,
      ...(probe === undefined ? {} : { probe })
    };
  }

  return {
    ok: providers.every(provider => results[provider].available
      && (options.probe !== true || results[provider].probe?.status === 'passed')),
    providers: results
  };
}
