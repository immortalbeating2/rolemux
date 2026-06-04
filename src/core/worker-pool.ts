import { CliError } from './cli-error.js';
import type { ProviderName } from '../providers/index.js';

export interface ProviderQuota {
  readonly provider: ProviderName;
  readonly count: number;
}

export interface WorkerDefinition {
  readonly id: string;
  readonly provider: ProviderName;
}

export interface BuildWorkerPoolInput {
  readonly providers: string;
  readonly workers?: number | undefined;
}

/** Parses provider quota syntax like codex:2,claude:1. */
export function parseProviderQuotas(value: string): ProviderQuota[] {
  return value.split(',').map(item => item.trim()).filter(Boolean).map(item => {
    const [providerRaw, countRaw] = item.split(':');
    const provider = parseProviderName(providerRaw ?? '');
    const count = countRaw === undefined ? 1 : Number.parseInt(countRaw, 10);
    if (!Number.isInteger(count) || count < 1) {
      throw new CliError(`Invalid worker count for provider: ${provider}`, {
        code: 'WORKER_POOL_INVALID',
        details: { provider, countRaw }
      });
    }
    return { provider, count };
  });
}

/** Builds concrete worker definitions from quotas or --workers shortcut syntax. */
export function buildWorkerPool(input: BuildWorkerPoolInput): WorkerDefinition[] {
  const quotas = parseProviderQuotas(input.providers);
  if (input.workers !== undefined) {
    if (!Number.isInteger(input.workers) || input.workers < 1) {
      throw new CliError('Invalid workers value.', {
        code: 'WORKER_POOL_INVALID',
        details: { workers: input.workers }
      });
    }
    return buildRoundRobinWorkers(quotas.map(quota => quota.provider), input.workers);
  }

  const counts = new Map<ProviderName, number>();
  const workers: WorkerDefinition[] = [];
  for (const quota of quotas) {
    for (let index = 0; index < quota.count; index += 1) {
      const nextCount = (counts.get(quota.provider) ?? 0) + 1;
      counts.set(quota.provider, nextCount);
      workers.push({ id: `${quota.provider}-${nextCount}`, provider: quota.provider });
    }
  }
  return workers;
}

function buildRoundRobinWorkers(providers: ProviderName[], workersCount: number): WorkerDefinition[] {
  const counts = new Map<ProviderName, number>();
  const workers: WorkerDefinition[] = [];
  for (let index = 0; index < workersCount; index += 1) {
    const provider = providers[index % providers.length];
    if (provider === undefined) {
      throw new CliError('At least one provider is required.', { code: 'WORKER_POOL_INVALID' });
    }
    const nextCount = (counts.get(provider) ?? 0) + 1;
    counts.set(provider, nextCount);
    workers.push({ id: `${provider}-${nextCount}`, provider });
  }
  return workers;
}

function parseProviderName(value: string): ProviderName {
  if (value === 'codex' || value === 'claude' || value === 'agy') {
    return value;
  }
  throw new CliError(`Unknown provider: ${value}`, {
    code: 'WORKER_POOL_INVALID',
    details: { provider: value }
  });
}
