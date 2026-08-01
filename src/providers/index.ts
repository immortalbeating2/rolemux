import { CliError } from '../core/cli-error.js';
import { agyAdapter } from './agy.js';
import { claudeAdapter } from './claude.js';
import { codexAdapter } from './codex.js';
import { grokAdapter } from './grok.js';
import { opencodeAdapter } from './opencode.js';
import { ProviderAdapter, ProviderName } from './provider.js';

const providerAdapters: Record<ProviderName, ProviderAdapter> = {
  codex: codexAdapter,
  claude: claudeAdapter,
  agy: agyAdapter,
  grok: grokAdapter,
  opencode: opencodeAdapter
};

/** Returns a provider adapter by stable provider name. */
export function getProviderAdapter(provider: ProviderName): ProviderAdapter {
  const adapter = providerAdapters[provider];
  if (adapter === undefined) {
    throw new CliError(`Unknown provider: ${provider}`, {
      code: 'PROVIDER_NOT_FOUND',
      details: { provider }
    });
  }
  return adapter;
}

/** Lists all registered provider adapters. */
export function listProviderAdapters(): readonly ProviderAdapter[] {
  return Object.values(providerAdapters);
}

export type { ProviderAdapter, ProviderCommand, ProviderCommandInput, ProviderName, TaskKind } from './provider.js';
export { isProviderName, providerNames } from './provider.js';
