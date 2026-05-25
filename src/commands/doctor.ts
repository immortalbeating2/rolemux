import { findExecutable } from '../core/find-executable.js';

export type ProviderName = 'codex' | 'claude' | 'agy';

export interface DoctorCommandOptions {
  pathEnv?: string;
  providers?: ProviderName[];
}

export interface ProviderDoctorResult {
  available: boolean;
  executable?: string;
}

export interface DoctorCommandResult {
  ok: boolean;
  providers: Record<ProviderName, ProviderDoctorResult>;
}

const defaultProviders: ProviderName[] = ['codex', 'claude', 'agy'];

/**
 * 检查 provider 可执行文件是否可被 PATH 找到；缺失 provider 不视为命令崩溃。
 */
export async function doctorCommand(options: DoctorCommandOptions = {}): Promise<DoctorCommandResult> {
  const providers = options.providers ?? defaultProviders;
  const results: Record<ProviderName, ProviderDoctorResult> = {
    codex: { available: false },
    claude: { available: false },
    agy: { available: false }
  };

  for (const provider of providers) {
    const executable = await findExecutable(provider, options.pathEnv === undefined ? {} : { pathEnv: options.pathEnv });
    results[provider] = executable.path === undefined
      ? { available: false }
      : { available: true, executable: executable.path };
  }

  return {
    ok: providers.every(provider => results[provider].available),
    providers: results
  };
}
