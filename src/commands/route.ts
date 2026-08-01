import { doctorCommand } from './doctor.js';
import { routeProviders } from '../core/provider-router.js';
import { isProviderName, providerNames, type ProviderName, type TaskKind } from '../providers/index.js';

export interface RouteCommandOptions {
  readonly taskKind: TaskKind;
  readonly available?: readonly string[] | undefined;
  readonly exclude?: readonly string[] | undefined;
  readonly maxProviders?: number | undefined;
}

export type RouteCommandResult = ReturnType<typeof routeProviders> & {
  readonly availabilitySource: 'explicit' | 'doctor';
};

/** Routes a task through fixed provider capabilities and current or explicit availability. */
export async function routeCommand(options: RouteCommandOptions): Promise<RouteCommandResult> {
  const availabilitySource = options.available === undefined ? 'doctor' : 'explicit';
  const available = options.available === undefined
    ? await detectAvailableProviders()
    : parseProviderNames(options.available, 'available');
  const excluded = parseProviderNames(options.exclude ?? [], 'exclude');
  return {
    ...routeProviders({
      taskKind: options.taskKind,
      available,
      exclude: excluded,
      ...(options.maxProviders === undefined ? {} : { maxProviders: options.maxProviders })
    }),
    availabilitySource
  };
}

async function detectAvailableProviders(): Promise<ProviderName[]> {
  const doctor = await doctorCommand({ providers: [...providerNames] });
  return providerNames.filter(provider => doctor.providers[provider].available);
}

function parseProviderNames(values: readonly string[], field: string): ProviderName[] {
  return values.map(value => {
    if (!isProviderName(value)) {
      throw new Error(`Unknown ${field} provider: ${value}`);
    }
    return value;
  });
}
