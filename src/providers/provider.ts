/** Supported RoleMux provider names. */
export type ProviderName = 'codex' | 'claude' | 'agy';

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
  readonly cwd?: string | undefined;
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
