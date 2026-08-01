import { getProviderAdapter } from '../providers/index.js';
import type { ProviderName, TaskKind } from '../providers/index.js';

const taskKindPriority: Record<TaskKind, readonly ProviderName[]> = {
  architecture: ['codex', 'claude', 'grok', 'opencode', 'agy'],
  research: ['grok', 'claude', 'codex', 'agy', 'opencode'],
  implementation: ['codex', 'opencode', 'agy', 'claude', 'grok'],
  'ui-review': ['claude', 'grok', 'codex', 'agy', 'opencode'],
  'failure-review': ['codex', 'claude', 'grok', 'opencode', 'agy']
};

export interface RouteProvidersInput {
  readonly taskKind: TaskKind;
  readonly available: readonly ProviderName[];
  readonly exclude?: readonly ProviderName[] | undefined;
  readonly maxProviders?: number | undefined;
}

export interface RouteProvidersResult {
  readonly taskKind: TaskKind;
  readonly selected: readonly ProviderName[];
  readonly available: readonly ProviderName[];
  readonly excluded: readonly ProviderName[];
}

/** Selects providers by fixed capability priorities; no model scoring or network calls are used. */
export function routeProviders(input: RouteProvidersInput): RouteProvidersResult {
  const maxProviders = input.maxProviders ?? 2;
  if (!Number.isInteger(maxProviders) || maxProviders < 1) {
    throw new Error('maxProviders must be a positive integer.');
  }
  const available = [...new Set(input.available)];
  const excluded = [...new Set(input.exclude ?? [])];
  const selected = taskKindPriority[input.taskKind]
    .filter(provider => available.includes(provider))
    .filter(provider => !excluded.includes(provider))
    .filter(provider => getProviderAdapter(provider).capabilities.taskKinds.includes(input.taskKind))
    .slice(0, maxProviders);
  return { taskKind: input.taskKind, selected, available, excluded };
}
