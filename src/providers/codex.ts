import { ProviderAdapter, ProviderCommand, ProviderCommandInput } from './provider.js';
import { applyProviderCommandOverride } from './command-overrides.js';

/** Codex CLI adapter. */
export const codexAdapter: ProviderAdapter = {
  name: 'codex',
  executable: 'codex',
  capabilities: {
    supportsPromptArgument: true,
    supportsWorkdir: true
  },
  buildCommand(input: ProviderCommandInput): ProviderCommand {
    const command = applyProviderCommandOverride('codex', this.executable, ['exec', '-C', input.workdir, input.prompt]);
    return {
      provider: 'codex',
      executable: command.executable,
      args: command.args,
      cwd: input.workdir
    };
  }
};
