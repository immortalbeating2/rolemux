---
name: rolemux-workflow
description: Use RoleMux when the current AI session needs lightweight multi-CLI collaboration, role-based delegation, planning, review, discussion, or a dry-run preview across Codex, Claude, Agy, and Grok Build providers.
---

# RoleMux Workflow

Use this skill when the user asks the current AI session to coordinate work with another AI CLI, compare answers from multiple providers, split a task by role, request an external review, or preserve auditable task artifacts through RoleMux.

## Trigger Conditions

Invoke RoleMux when the user asks for any of these:

- Multi-CLI collaboration with Codex, Claude, Agy/Antigravity, or Grok Build.
- Role-based work such as architect, builder, reviewer, frontend-reviewer, or summarizer.
- A plan, review, implementation pass, or discussion handled by another provider.
- A dry-run preview of what RoleMux would execute.
- A saved task artifact under `.rolemux/tasks/`.

Do not invoke RoleMux for a simple local edit or explanation that the current AI session can complete directly.

## Workflow

1. Confirm the user's goal and choose the smallest RoleMux command that fits it.
2. Use an existing task file when the user provides one. Otherwise create a concise temporary task file in the current project only when writing is allowed.
3. Run RoleMux from the project workdir.
4. For real multi-agent dispatch, prefer `rolemux dispatch --detach`, then poll `rolemux agents --parent-task <id> --json` and summarize the snapshot as conversation monitor cards.
5. Read the command output and any reported artifact path.
6. Summarize the result for the user, including provider, role, status, and artifact location.

## Commands

Use these command shapes. Let RoleMux and its provider adapters decide provider-specific arguments.

```bash
rolemux doctor
rolemux run --provider codex --role builder --task ./examples/basic-task.md --workdir . --dry-run
rolemux plan --providers claude,codex --task ./examples/basic-task.md --workdir . --dry-run
rolemux review --provider codex --role reviewer --task ./examples/basic-task.md --workdir . --dry-run
rolemux discuss --providers claude,codex,agy,grok --task ./examples/basic-task.md --workdir . --mode parallel --dry-run
rolemux dispatch --manifest ./rolemux-tasks.json --providers 'codex:1,claude:1,agy:1,grok:1' --workdir . --detach
rolemux agents --parent-task <parent-task-id> --json
rolemux cancel --parent-task <parent-task-id>
```

On Windows PowerShell, either `./examples/basic-task.md` or `.\examples\basic-task.md` is acceptable. Quote comma-separated provider lists when using the PowerShell shim, for example `--providers 'codex:1,claude:1,agy:1,grok:1'`.

Use `--dry-run` first when the user asks to inspect the planned execution or when the target project should not be modified.

When `dispatch --detach` returns `status: "started"`, use the returned `agentsJsonCommand` for agent-readable monitoring. Render concise conversation cards when state changes, after long idle periods, and at final status. Do not stream provider stdout or expose model reasoning. If the user asks for the terminal monitor, tell them to open another terminal in the same project and run the returned `agentsTuiCommand`.

If the user says "stop reporting" or equivalent, stop polling `agents --json` only. If the user says "cancel task" or equivalent, call `rolemux cancel --parent-task <id>`.

## Boundaries

- Do not hardcode low-level `codex`, `claude`, `agy`, or `grok` command arguments in this skill.
- Do not use dangerous sandbox bypass flags unless the user explicitly requests them and accepts the risk.
- Do not read or print secrets, tokens, cookies, private account data, or local credential files.
- Do not require the user's project to modify `AGENTS.md`. Treat `--with-agents` as an explicit opt-in only.
- Do not overwrite user task artifacts or config files without a clear RoleMux command that supports that behavior.
- Do not claim RoleMux completed a run unless the command output or artifact metadata confirms it.

## Output To User

Report:

- The RoleMux command used.
- Provider and role.
- Status: dry-run, started, running, success, failed, timeout, canceled, or blocked.
- Artifact path when RoleMux provides one.
- Any verification gap or manual follow-up needed.
