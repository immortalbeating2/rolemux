import { ProviderAdapter, ProviderCommand, ProviderCommandInput } from './provider.js';
import { applyProviderCommandOverride } from './command-overrides.js';

/** Claude CLI adapter. */
export const claudeAdapter: ProviderAdapter = {
  name: 'claude',
  executable: 'claude',
  capabilities: {
    supportsPromptArgument: true,
    supportsWorkdir: true
  },
  buildCommand(input: ProviderCommandInput): ProviderCommand {
    const command = applyProviderCommandOverride('claude', this.executable, ['-p', '--output-format', 'text', input.prompt]);
    return {
      provider: 'claude',
      executable: command.executable,
      args: command.args,
      cwd: input.workdir
    };
  }
};
