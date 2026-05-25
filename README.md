# RoleMux

RoleMux is a lightweight multi-CLI workflow runner for coordinating Codex, Claude, and Agy through role prompts and auditable task artifacts.

It is intentionally small: RoleMux provides a CLI, provider adapters, role prompts, Skill bundles, and task output directories. It is not a workflow platform, cloud service, or dashboard.

## What It Does

- Installs default config, roles, and Codex/Claude Skill files.
- Checks provider availability with `rolemux doctor`.
- Runs a task with a selected provider and role.
- Supports dry-run previews before invoking provider CLIs.
- Saves task artifacts under `.rolemux/tasks/{task-id}/`.
- Keeps provider-specific command details inside RoleMux adapters.

## Requirements

- Node.js 20 or newer.
- PowerShell on Windows, or a POSIX shell on macOS/Linux.
- Optional provider CLIs installed locally: `codex`, `claude`, and `agy`.

## Install

Use the package directly with `npx`:

```powershell
npx rolemux install
```

Or install globally:

```powershell
npm install -g rolemux
rolemux install
```

Preview install targets without writing files:

```powershell
rolemux install --dry-run
```

By default RoleMux installs its own config, roles, and Skill files. It does not modify a user project `AGENTS.md`. Any future `--with-agents` behavior is explicit opt-in.

## Basic Commands

Check provider availability:

```powershell
rolemux doctor
```

Preview a single provider run:

```powershell
rolemux run --provider codex --role builder --task .\examples\basic-task.md --workdir . --dry-run
```

Ask multiple providers for a plan:

```powershell
rolemux plan --providers claude,codex --task .\examples\basic-task.md --workdir . --dry-run
```

Request a review:

```powershell
rolemux review --provider codex --role reviewer --task .\examples\basic-task.md --workdir . --dry-run
```

Run a parallel discussion preview:

```powershell
rolemux discuss --providers claude,codex,agy --task .\examples\basic-task.md --workdir . --mode parallel --dry-run
```

## Roles

Default roles live in `roles/`:

- `architect`: turns requirements into a scoped implementation plan.
- `builder`: implements a focused change inside the delegated boundary.
- `reviewer`: reviews correctness, regressions, security, portability, and validation.
- `frontend-reviewer`: reviews UI behavior, accessibility, layout, and visual states.
- `summarizer`: condenses task outputs, evidence, and risks into a handoff.

Roles are intentionally conservative. They should not encourage broad rewrites, unsafe permissions, secret inspection, or unrequested changes to user projects.

## Skill Usage

RoleMux ships Skill bundles for Codex and Claude:

```text
skills/codex/rolemux-workflow/SKILL.md
skills/claude/rolemux-workflow/SKILL.md
```

The Skill should trigger when a user asks for multi-CLI collaboration, role-based delegation, external planning, review, discussion, or saved RoleMux artifacts.

The Skill calls RoleMux commands such as `rolemux run`, `rolemux plan`, `rolemux review`, and `rolemux discuss`. It should not hardcode low-level provider flags; provider-specific command construction belongs in the adapter layer.

## Task Artifacts

A real run writes artifacts under:

```text
.rolemux/tasks/{task-id}/
```

Expected MVP files:

- `task.md`
- `prompt.md`
- `output.md`
- `metadata.json`

Provider-specific details may be saved under `runs/` when a workflow uses more than one provider.

## Configuration

The default template is `templates/config.toml`.

Core fields:

```toml
default_provider = "codex"
default_workdir = "."
task_dir = ".rolemux/tasks"
timeout_seconds = 600
```

Provider command names are configurable:

```toml
[providers.codex]
enabled = true
command = "codex"

[providers.claude]
enabled = true
command = "claude"

[providers.agy]
enabled = true
command = "agy"
```

## Examples

Use the basic task file:

```powershell
rolemux run --provider codex --role builder --task .\examples\basic-task.md --workdir . --dry-run
```

See `examples/mock-provider/README.md` for a mock-provider testing flow that avoids real AI CLI calls.

## Development

Install dependencies:

```powershell
npm install
```

Run checks:

```powershell
npm run typecheck
npm test
npm run build
git diff --check
```

Release candidates should also run:

```powershell
npm pack --dry-run
node .\dist\cli.js --help
node .\dist\cli.js doctor
node .\dist\cli.js run --provider codex --role builder --task .\examples\basic-task.md --workdir . --dry-run
```

See `docs/release/checklist.md` for the release checklist.

## Safety Defaults

- RoleMux does not use dangerous sandbox bypass flags by default.
- Dry-run commands should not invoke real provider CLIs.
- Provider adapters own provider-specific arguments.
- Tests should use fixtures, temporary directories, or mock executables.
- RoleMux should not read, log, or print secrets, tokens, cookies, private account data, or credential files.
- User project `AGENTS.md` changes are not required for the default workflow.

## Known Limitations

- MVP focuses on local CLI orchestration and static artifacts.
- Full Web dashboard, cloud workflow service, plugin marketplace, and account system are out of scope.
- Provider CLI flags may change over time; adapter behavior should be verified with `rolemux doctor` and mock-provider tests.
- Cross-platform path handling, especially Windows paths with spaces, must remain part of release verification.
- Before publishing, run the release checklist and confirm `npm pack --dry-run` excludes local artifacts and credentials.
