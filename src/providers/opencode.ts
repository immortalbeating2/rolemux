import { existsSync } from 'node:fs';
import { delimiter, join, resolve } from 'node:path';
import { applyProviderCommandOverride } from './command-overrides.js';
import type { ProviderAdapter, ProviderCommand, ProviderCommandInput } from './provider.js';

/** OpenCode CLI adapter. */
export const opencodeAdapter: ProviderAdapter = {
  name: 'opencode',
  executable: resolveOpenCodeExecutable(),
  capabilities: {
    supportsPromptArgument: true,
    supportsWorkdir: true
  },
  buildCommand(input: ProviderCommandInput): ProviderCommand {
    // OpenCode 的 Windows npm shim 会重解释多行和 `%...%` prompt；直接启动
    // 官方包内 exe，保留参数数组边界。--auto 属于危险授权，默认不启用。
    const command = applyProviderCommandOverride('opencode', this.executable, [
      'run',
      '--pure',
      '--dir',
      input.workdir,
      '--format',
      'default',
      input.prompt
    ]);
    return {
      provider: 'opencode',
      executable: command.executable,
      args: command.args,
      cwd: input.workdir,
      stripTerminalOutput: true
    };
  }
};

function resolveOpenCodeExecutable(): string {
  if (process.platform !== 'win32') {
    return 'opencode';
  }

  for (const directory of (process.env.PATH ?? '').split(delimiter).filter(Boolean)) {
    const candidates = [
      join(directory, 'opencode.exe'),
      join(directory, 'node_modules', 'opencode-ai', 'bin', 'opencode.exe'),
      resolve(directory, '..', 'opencode-ai', 'bin', 'opencode.exe')
    ];
    const executable = candidates.find(candidate => existsSync(candidate));
    if (executable !== undefined) {
      return executable;
    }
  }

  return 'opencode.exe';
}
