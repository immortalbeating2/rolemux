import { ProviderAdapter, ProviderCommand, ProviderCommandInput } from './provider.js';
import { applyProviderCommandOverride } from './command-overrides.js';

/** Antigravity/Agy CLI adapter. */
export const agyAdapter: ProviderAdapter = {
  name: 'agy',
  executable: process.platform === 'win32' ? 'agy.exe' : 'agy',
  capabilities: {
    supportsPromptArgument: true,
    supportsWorkdir: true
  },
  buildCommand(input: ProviderCommandInput): ProviderCommand {
    const printTimeout = parseAgyDuration(process.env.ROLEMUX_AGY_PRINT_TIMEOUT);
    const timeoutArgs = buildPrintTimeoutArgs(process.env.ROLEMUX_AGY_PRINT_TIMEOUT);
    // Antigravity/Agy 对参数顺序敏感；参考 ccg-workflow，-p 必须紧贴最终 prompt。
    const command = applyProviderCommandOverride('agy', this.executable, [
      '--add-dir',
      input.workdir,
      ...timeoutArgs,
      '-p',
      input.prompt
    ]);
    return {
      provider: 'agy',
      executable: command.executable,
      args: command.args,
      cwd: input.workdir,
      ...(printTimeout === undefined ? {} : { timeoutMs: printTimeout + 30_000 }),
      transport: 'pty'
    };
  }
};

function buildPrintTimeoutArgs(value: string | undefined): string[] {
  if (value === undefined || value.trim().length === 0) {
    return [];
  }

  // Agy 自带默认 5m；这里只提供显式诊断/兼容通道，不改变默认模型运行时长。
  return ['--print-timeout', value.trim()];
}

function parseAgyDuration(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const match = /^(\d+)(ms|s|m)?$/i.exec(value.trim());
  if (match === null) {
    return undefined;
  }

  const amount = Number(match[1]);
  const unit = match[2]?.toLowerCase() ?? 'ms';
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    return undefined;
  }

  if (unit === 'm') {
    return amount * 60_000;
  }
  if (unit === 's') {
    return amount * 1_000;
  }
  return amount;
}
