import { ProviderAdapter, ProviderCommand, ProviderCommandInput } from './provider.js';

/** Codex CLI adapter. */
export const codexAdapter: ProviderAdapter = {
  name: 'codex',
  executable: 'codex',
  capabilities: {
    supportsPromptArgument: true,
    supportsWorkdir: true
  },
  buildCommand(input: ProviderCommandInput): ProviderCommand {
    return {
      provider: 'codex',
      executable: this.executable,
      args: ['exec', '-C', input.workdir, input.prompt],
      cwd: input.workdir
    };
  }
};
