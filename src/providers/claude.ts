import { ProviderAdapter, ProviderCommand, ProviderCommandInput } from './provider.js';
import { applyProviderCommandOverride } from './command-overrides.js';

/** Claude CLI adapter. */
export const claudeAdapter: ProviderAdapter = {
  name: 'claude',
  executable: 'claude',
  capabilities: {
    supportsPromptArgument: true,
    supportsWorkdir: true,
    nativeAgentEvents: true,
    taskKinds: ['architecture', 'research', 'ui-review', 'failure-review']
  },
  buildCommand(input: ProviderCommandInput): ProviderCommand {
    const args = input.nativeAgents === true
      ? ['-p', '--output-format', 'stream-json', '--verbose', '--forward-subagent-text', input.prompt]
      : ['-p', '--output-format', 'text', input.prompt];
    const command = applyProviderCommandOverride('claude', this.executable, args);
    return {
      provider: 'claude',
      executable: command.executable,
      args: command.args,
      cwd: input.workdir
    };
  }
};
