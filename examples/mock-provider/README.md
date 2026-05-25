# Mock Provider Example

This example describes the minimal local setup for testing RoleMux without invoking real AI CLI tools.

## Purpose

Use mock provider executables when validating RoleMux command construction, task artifact creation, and report generation. The mock should print deterministic text, return a known exit code, and avoid network calls or account credentials.

## Suggested Flow

From the repository root:

```powershell
npm install
npm run build
node .\dist\cli.js doctor
node .\dist\cli.js run --provider codex --role builder --task .\examples\basic-task.md --workdir . --dry-run
```

For integration tests, place mock executables in a temporary directory and prepend that directory to `PATH`. Keep the mock behavior simple:

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
