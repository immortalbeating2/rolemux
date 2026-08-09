---
name: rolemux-workflow
description: Use RoleMux when the current AI session needs lightweight multi-CLI collaboration, role-based delegation, planning, review, discussion, or a dry-run preview across Codex, Claude, Agy, Grok Build, and OpenCode providers.
---

# RoleMux Workflow

Use this skill when the user asks the current AI session to coordinate work with another AI CLI, compare answers from multiple providers, split a task by role, request an external review, or preserve auditable task artifacts through RoleMux.

## Trigger Conditions

Invoke RoleMux when the user asks for any of these:

- Multi-CLI collaboration with Codex, Claude, Agy/Antigravity, Grok Build, or OpenCode.
- Role-based work such as architect, builder, reviewer, frontend-reviewer, or summarizer.
- A plan, review, implementation pass, or discussion handled by another provider.
- A dry-run preview of what RoleMux would execute.
- A saved task artifact under `.rolemux/tasks/`.

Do not invoke RoleMux for a simple local edit or explanation that the current AI session can complete directly.

## Workflow

1. Confirm the user's goal and choose the smallest RoleMux command that fits it. Unless the user explicitly requests fan-out, use `dispatch` only when the work splits into at least two independent roles/subtasks and a single task is likely to take about 30 seconds or more; use the current session or `run` for smaller work.
2. Use an existing task file when the user provides one. Otherwise create a concise temporary task file in the current project only when writing is allowed.
3. Before a real run, use `rolemux doctor --providers <providers>`. Add `--probe` only on first use, after CLI/config/auth changes, after a provider failure/timeout, or before long/high-cost work when authentication is uncertain; do not deep-probe every dispatch. If it reports unavailable, failed, timeout, or blocked, report the exact provider result and wait for the user instead of silently replacing an explicit provider.
4. Run RoleMux from the project workdir.
5. For real multi-agent dispatch, prefer `rolemux dispatch --detach`, then poll `rolemux agents --parent-task <id> --json` and summarize the snapshot as conversation monitor cards.
6. Read the command output and any reported artifact path.
7. Summarize the result for the user, including provider, role, status, and artifact location.

## Commands

Use these command shapes. Let RoleMux and its provider adapters decide provider-specific arguments.

```bash
rolemux doctor
rolemux doctor --providers 'claude,agy' --probe --probe-timeout-ms 45000
rolemux run --provider codex --role builder --task ./examples/basic-task.md --workdir . --dry-run
rolemux run --provider codex --fallback-providers 'grok,opencode' --role reviewer --task ./examples/basic-task.md --result-json --max-attempts 2 --timeout-ms 120000
rolemux plan --providers 'claude,codex' --task ./examples/basic-task.md --workdir . --dry-run
rolemux review --provider codex --role reviewer --task ./examples/basic-task.md --workdir . --dry-run
rolemux discuss --providers 'claude,codex,agy,grok,opencode' --task ./examples/basic-task.md --workdir . --mode parallel --dry-run
rolemux route --task-kind failure-review --max-providers 2
rolemux discuss --task ./examples/basic-task.md --workdir . --mode structured --task-kind failure-review --verification-manifest ./examples/verification-manifest.json --dry-run
rolemux dispatch --manifest ./rolemux-tasks.json --providers 'codex:1,claude:1,agy:1,grok:1,opencode:1' --workdir . --detach
rolemux dispatch --manifest ./rolemux-tasks.json --providers 'claude:1,agy:1' --workdir . --detach --native-agents
rolemux agents --parent-task <parent-task-id> --json
rolemux cancel --parent-task <parent-task-id>
```

On Windows PowerShell, either `./examples/basic-task.md` or `.\examples\basic-task.md` is acceptable. Quote comma-separated provider lists when using the PowerShell shim, for example `--providers 'codex:1,claude:1,agy:1,grok:1,opencode:1'`.

Use `--dry-run` first when the user asks to inspect the planned execution or when the target project should not be modified.

PowerShell functions are not inherited by RoleMux child processes. If the local `agy` or `grok` wrapper supplies proxy variables, export the same `HTTP_PROXY`/`HTTPS_PROXY` (and Agy's `ALL_PROXY`) in the shell that starts RoleMux. Agy defaults to PTY transport for interactive use; in a non-interactive shell such as a detached runner, set `ROLEMUX_AGY_TRANSPORT=process`. RoleMux then requests Agy's `stream-json` output and extracts the final response automatically; also set `ROLEMUX_AGY_PRINT_TIMEOUT` to a suitable provider limit.

Agy tool permissions remain provider-owned. RoleMux does not add `--dangerously-skip-permissions` by default; only pass it explicitly through `ROLEMUX_PROVIDER_AGY_ARGS_PREFIX` for a trusted, isolated workspace when unattended tool approval is intentional. Otherwise use an interactive terminal for tool requests.

When `dispatch --detach` returns `status: "started"`, use the returned `agentsJsonCommand` for agent-readable monitoring. Render concise conversation cards when state changes, after long idle periods, and at final status. Do not stream provider stdout or expose model reasoning. If the user asks for the terminal monitor, tell them to open another terminal in the same project and run the returned `agentsTuiCommand`.

`--native-agents` is explicit opt-in and currently supports verified Claude and Agy child lifecycle events. Native children appear under their RoleMux parent in `monitor.json` and the shared TUI; they inherit the parent provider workdir and permissions and are not independent `writePolicy` workers. If RoleMux returns `PROVIDER_NATIVE_AGENTS_UNSUPPORTED`, report it and wait rather than retrying with guessed parsing.

If the user says "stop reporting" or equivalent, stop polling `agents --json` only. If the user says "cancel task" or equivalent, call `rolemux cancel --parent-task <id>`.

## Boundaries

- Do not hardcode low-level `codex`, `claude`, `agy`, `grok`, or `opencode` command arguments in this skill.
- Do not use dangerous sandbox bypass flags unless the user explicitly requests them and accepts the risk.
- Do not read or print secrets, tokens, cookies, private account data, or local credential files.
- Do not require the user's project to modify `AGENTS.md`. Treat `--with-agents` as an explicit opt-in only.
- Do not overwrite user task artifacts or config files without a clear RoleMux command that supports that behavior.
- Structured verification manifests must use `executable` plus `args[]`; never convert shell command strings into executable work.
- Explicit providers override capability routing. Do not present routing priority as a model-quality ranking.
- Do not claim RoleMux completed a run unless the command output or artifact metadata confirms it.

## Output To User

Report:

- The RoleMux command used.
- Provider and role.
- Status: dry-run, started, running, success, failed, timeout, canceled, or blocked.
- Artifact path when RoleMux provides one.
- Any verification gap or manual follow-up needed.
