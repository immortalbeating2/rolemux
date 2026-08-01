import { applyProviderCommandOverride } from './command-overrides.js';
import type { ProviderAdapter, ProviderCommand, ProviderCommandInput } from './provider.js';

/** Grok Build CLI adapter. */
export const grokAdapter: ProviderAdapter = {
  name: 'grok',
  executable: process.platform === 'win32' ? 'grok.exe' : 'grok',
  capabilities: {
    supportsPromptArgument: true,
    supportsWorkdir: true,
    taskKinds: ['architecture', 'research', 'ui-review', 'failure-review']
  },
  buildCommand(input: ProviderCommandInput): ProviderCommand {
    // RoleMux owns orchestration and task isolation, so nested agents and
    // cross-session memory stay disabled without lowering Grok permissions.
    const command = applyProviderCommandOverride('grok', this.executable, [
      '--cwd',
      input.workdir,
      '--output-format',
      'plain',
      '--no-subagents',
      '--no-memory',
      '--verbatim',
      '--single',
      input.prompt
    ]);
    return {
      provider: 'grok',
      executable: command.executable,
      args: command.args,
      cwd: input.workdir
    };
  }
};
