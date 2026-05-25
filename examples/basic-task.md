# Basic RoleMux Task

Create a minimal plan for adding a `rolemux doctor` command to a TypeScript CLI.

## Goal

The command should check whether the configured providers are available and return a concise status summary.

## Constraints

- Keep provider-specific command details inside provider adapters.
- Use dry-run or mock providers for verification.
- Do not read secrets, tokens, cookies, or private account configuration.
- Do not modify a user project `AGENTS.md`.

## Expected Output

Return:

1. A short implementation plan.
2. Files likely to change.
3. Validation commands.
4. Risks or missing context.
