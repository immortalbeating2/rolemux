/** Supported RoleMux provider names. */
export const providerNames = ['codex', 'claude', 'agy', 'grok', 'opencode'] as const;

/** Stable provider name accepted by RoleMux commands and manifests. */
export type ProviderName = typeof providerNames[number];

/** Checks an external string against the shared provider registry names. */
export function isProviderName(value: string): value is ProviderName {
  return providerNames.some(provider => provider === value);
}

/** Input used by provider adapters to build a CLI invocation. */
export interface ProviderCommandInput {
  readonly prompt: string;
  readonly workdir: string;
  readonly role: string;
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
  readonly stripTerminalOutput?: boolean | undefined;
}

/** Capability summary exposed by a provider adapter. */
export interface ProviderCapabilities {
  readonly supportsPromptArgument: boolean;
  readonly supportsWorkdir: boolean;
}

/** Adapter boundary for provider-specific CLI argument construction. */
export interface ProviderAdapter {
  readonly name: ProviderName;
  readonly executable: string;
  readonly capabilities: ProviderCapabilities;
  buildCommand(input: ProviderCommandInput): ProviderCommand;
}
