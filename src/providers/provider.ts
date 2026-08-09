/** Supported RoleMux provider names. */
export const providerNames = ['codex', 'claude', 'agy', 'grok', 'opencode'] as const;

/** Stable provider name accepted by RoleMux commands and manifests. */
export type ProviderName = typeof providerNames[number];

/** Fixed task categories supported by the lightweight capability router. */
export type TaskKind = 'architecture' | 'research' | 'implementation' | 'ui-review' | 'failure-review';

/** Checks an external string against the shared provider registry names. */
export function isProviderName(value: string): value is ProviderName {
  return providerNames.some(provider => provider === value);
}

/** Input used by provider adapters to build a CLI invocation. */
export interface ProviderCommandInput {
  readonly prompt: string;
  readonly workdir: string;
  readonly role: string;
  readonly nativeAgents?: boolean | undefined;
}

/** Provider command preview or execution input. */
export interface ProviderCommand {
  readonly provider: ProviderName;
  readonly executable: string;
  readonly args: readonly string[];
  readonly stdin?: string | undefined;
  readonly cwd?: string | undefined;
  readonly timeoutMs?: number | undefined;
  readonly transport?: 'process' | 'pty' | undefined;
  /** Provider stdout is a verified machine-readable event stream. */
  readonly machineReadable?: boolean | undefined;
  readonly stripTerminalOutput?: boolean | undefined;
}

/** Capability summary exposed by a provider adapter. */
export interface ProviderCapabilities {
  readonly supportsPromptArgument: boolean;
  readonly supportsWorkdir: boolean;
  readonly nativeAgentEvents: boolean;
  readonly taskKinds: readonly TaskKind[];
}

/** Adapter boundary for provider-specific CLI argument construction. */
export interface ProviderAdapter {
  readonly name: ProviderName;
  readonly executable: string;
  readonly capabilities: ProviderCapabilities;
  buildCommand(input: ProviderCommandInput): ProviderCommand;
}
