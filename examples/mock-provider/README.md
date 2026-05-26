# Mock Provider Example

This example describes the minimal local setup for testing RoleMux without invoking real AI CLI tools.

## Purpose

Use mock provider executables when validating RoleMux command construction, task artifact creation, and report generation. The mock should print deterministic text, return a known exit code, and avoid network calls or account credentials.

The automated release-flow E2E test uses:

```text
tests/fixtures/mock-provider.mjs
```

It runs the compiled CLI with provider command overrides:

```powershell
$env:ROLEMUX_PROVIDER_CODEX_COMMAND = "node"
$env:ROLEMUX_PROVIDER_CODEX_ARGS_PREFIX = "tests/fixtures/mock-provider.mjs"
```

`ROLEMUX_PROVIDER_<PROVIDER>_COMMAND` replaces the provider executable. `ROLEMUX_PROVIDER_<PROVIDER>_ARGS_PREFIX` prepends semicolon-separated arguments before adapter-generated args, which avoids fragile `.cmd` wrappers on Windows.

## Suggested Flow

From the repository root:

```powershell
npm install
npm run build
npm run test:e2e
```

For manual integration tests, prefer provider command overrides instead of temporary `.cmd` wrappers on Windows. Keep the mock behavior simple:

- `codex` mock prints the received arguments and exits `0`.
- `claude` mock prints the received arguments and exits `0`.
- `agy` mock prints the received arguments and exits `0`.

Do not point tests at real user projects unless the command is explicitly a dry-run.

## Expected Artifacts

A real non-dry-run execution should write a task directory under:

```text
.rolemux/tasks/{task-id}/
```

The task directory should contain at least:

- `task.md`
- `prompt.md`
- `output.md`
- `metadata.json`

Provider-specific run details may be saved under `runs/` when the implementation supports multiple providers.
