/** Input accepted by the prompt builder. */
export interface BuildPromptInput {
  readonly role: string;
  readonly rolePrompt?: string;
  readonly task: string;
  readonly context?: readonly string[];
  readonly outputInstructions?: string;
}

/** Builds a deterministic prompt from role, task, context, and output rules. */
export function buildPrompt(input: BuildPromptInput): string {
  const sections: string[] = [`# Role\n${input.role}`];

  if (input.rolePrompt !== undefined && input.rolePrompt.trim().length > 0) {
    sections.push(`# Role Prompt\n${input.rolePrompt.trim()}`);
  }

  sections.push(`# Task\n${input.task.trim()}`);

  if (input.context !== undefined && input.context.length > 0) {
    sections.push(`# Context\n${input.context.map(item => item.trim()).filter(Boolean).join('\n\n')}`);
  }

  if (input.outputInstructions !== undefined && input.outputInstructions.trim().length > 0) {
    sections.push(`# Output Requirements\n${input.outputInstructions.trim()}`);
  }

  return `${sections.join('\n\n')}\n`;
}
