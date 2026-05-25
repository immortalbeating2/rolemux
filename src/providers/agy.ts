import { ProviderAdapter, ProviderCommand, ProviderCommandInput } from './provider.js';

/** Antigravity/Agy CLI adapter. */
export const agyAdapter: ProviderAdapter = {
  name: 'agy',
  executable: 'agy',
  capabilities: {
    supportsPromptArgument: true,
    supportsWorkdir: true
  },
  buildCommand(input: ProviderCommandInput): ProviderCommand {
    return {
      provider: 'agy',
      executable: this.executable,
      args: ['-p', '--add-dir', input.workdir, input.prompt],
      cwd: input.workdir
    };
  }
};
