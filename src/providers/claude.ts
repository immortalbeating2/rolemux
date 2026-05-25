import { ProviderAdapter, ProviderCommand, ProviderCommandInput } from './provider.js';

/** Claude CLI adapter. */
export const claudeAdapter: ProviderAdapter = {
  name: 'claude',
  executable: 'claude',
  capabilities: {
    supportsPromptArgument: true,
    supportsWorkdir: true
  },
  buildCommand(input: ProviderCommandInput): ProviderCommand {
    return {
      provider: 'claude',
      executable: this.executable,
      args: ['-p', '--output-format', 'text', input.prompt],
      cwd: input.workdir
    };
  }
};
