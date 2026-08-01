import { ProviderAdapter, ProviderCommand, ProviderCommandInput } from './provider.js';
import { applyProviderCommandOverride } from './command-overrides.js';

/** Codex CLI adapter. */
export const codexAdapter: ProviderAdapter = {
  name: 'codex',
  executable: process.platform === 'win32' ? 'cmd.exe' : 'codex',
  capabilities: {
    supportsPromptArgument: false,
    supportsWorkdir: true,
    taskKinds: ['architecture', 'research', 'implementation', 'ui-review', 'failure-review']
  },
  buildCommand(input: ProviderCommandInput): ProviderCommand {
    const sandboxArgs = buildSandboxArgs(process.env.ROLEMUX_CODEX_SANDBOX);
    const codexArgs = [
      'exec',
      '--skip-git-repo-check',
      '--disable',
      'plugins',
      '--ignore-rules',
      '-C',
      input.workdir,
      ...sandboxArgs
    ];
    const command = applyProviderCommandOverride('codex', this.executable, wrapCodexArgs(codexArgs));
    return {
      provider: 'codex',
      executable: command.executable,
      args: command.args,
      stdin: input.prompt,
      cwd: input.workdir
    };
  }
};

function wrapCodexArgs(args: readonly string[]): string[] {
  if (process.platform !== 'win32') {
    return [...args];
  }

  // npm 的 codex shim 在 Windows 上通常是 .cmd/.ps1；Node shell:false 不能直接
  // CreateProcess .cmd，因此用 cmd.exe 参数数组包装，避免拼接 shell 字符串。
  return ['/d', '/s', '/c', 'codex.cmd', ...args];
}

function buildSandboxArgs(value: string | undefined): string[] {
  if (value === undefined || value.trim().length === 0) {
    return [];
  }

  const sandbox = value.trim();
  if (sandbox !== 'read-only' && sandbox !== 'workspace-write' && sandbox !== 'danger-full-access') {
    throw new Error(`Invalid ROLEMUX_CODEX_SANDBOX value: ${sandbox}`);
  }

  // 默认不降低 Codex 沙箱；该环境变量是用户显式 opt-in 的诊断/兼容通道。
  return ['--sandbox', sandbox];
}
