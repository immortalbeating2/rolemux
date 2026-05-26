import { ProviderAdapter, ProviderCommand, ProviderCommandInput } from './provider.js';
import { applyProviderCommandOverride } from './command-overrides.js';

/** Antigravity/Agy CLI adapter. */
export const agyAdapter: ProviderAdapter = {
  name: 'agy',
  executable: 'agy',
  capabilities: {
    supportsPromptArgument: true,
    supportsWorkdir: true
  },
  buildCommand(input: ProviderCommandInput): ProviderCommand {
    const command = applyProviderCommandOverride('agy', this.executable, ['-p', '--add-dir', input.workdir, input.prompt]);
    return {
      provider: 'agy',
      executable: command.executable,
      args: command.args,
      cwd: input.workdir
    };
  }
};
