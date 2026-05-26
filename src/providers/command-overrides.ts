import type { ProviderName } from './provider.js';

export interface ProviderCommandOverride {
  executable: string;
  args: readonly string[];
}

/**
 * 应用 provider 命令覆盖，主要用于发布前 mock provider E2E 验证。
 */
export function applyProviderCommandOverride(
  provider: ProviderName,
  defaultExecutable: string,
  defaultArgs: readonly string[]
): ProviderCommandOverride {
  const envKey = provider.toUpperCase();
  const executable = process.env[`ROLEMUX_PROVIDER_${envKey}_COMMAND`] ?? defaultExecutable;
  const argsPrefix = parseArgsPrefix(process.env[`ROLEMUX_PROVIDER_${envKey}_ARGS_PREFIX`]);

  return {
    executable,
    args: [...argsPrefix, ...defaultArgs]
  };
}

function parseArgsPrefix(value: string | undefined): string[] {
  if (value === undefined || value.trim().length === 0) {
    return [];
  }

  // 该覆盖项仅用于可控测试/发布验收场景；用分号避免 Windows 路径中的空格被拆开。
  return value.split(';').map(item => item.trim()).filter(Boolean);
}
