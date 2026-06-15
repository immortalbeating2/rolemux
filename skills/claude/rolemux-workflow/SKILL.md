---
name: rolemux-workflow
description: Use RoleMux when a Claude session needs lightweight multi-CLI collaboration, role-based delegation, planning, review, discussion, or a dry-run preview across Codex, Claude, and Agy providers.
---

# RoleMux Workflow

Use this skill when the user asks Claude to coordinate work with another AI CLI, compare multiple providers, delegate by role, request an outside review, or keep an auditable RoleMux task record.

## Trigger Conditions

Invoke RoleMux when the user asks for any of these:

- Collaboration between Claude, Codex, Agy, or Antigravity.
- Role-based work such as architect, builder, reviewer, frontend-reviewer, or summarizer.
- Planning, implementation, review, or discussion by a named provider.
- A dry-run preview before a provider command is executed.
- Saved artifacts under `.rolemux/tasks/`.

Do not invoke RoleMux when the current Claude session can answer directly without delegation or task artifacts.

## Workflow

1. Identify whether the task is best handled by `plan`, `run`, `review`, `discuss`, or multi-agent `dispatch`.
2. Use the user's task file if provided. If no file is provided, create a short task file only when writing is allowed.
3. Run RoleMux from the project workdir.
4. For real multi-agent dispatch, prefer `rolemux dispatch --detach`, then poll `rolemux agents --parent-task <id> --json` and summarize the stable snapshot instead of streaming provider stdout.
5. Inspect the RoleMux summary and any referenced artifact files.
6. Return a concise user-facing summary with status, provider, role, and artifact path.

## Commands

Use these command shapes. Provider-specific invocation details belong in RoleMux adapters, not in this skill.

```bash
rolemux doctor
rolemux run --provider claude --role architect --task ./examples/basic-task.md --workdir . --dry-run
rolemux plan --providers claude,codex --task ./examples/basic-task.md --workdir . --dry-run
rolemux review --provider codex --role reviewer --task ./examples/basic-task.md --workdir . --dry-run
rolemux discuss --providers claude,codex,agy --task ./examples/basic-task.md --workdir . --mode parallel --dry-run
rolemux dispatch --manifest ./rolemux-tasks.json --providers 'codex:1,claude:1,agy:1' --workdir . --detach
rolemux agents --parent-task <parent-task-id> --json
rolemux cancel --parent-task <parent-task-id>
```

Start with `--dry-run` when the user wants a preview, when provider availability is uncertain, or when the target project should not be changed.

When `dispatch --detach` returns `status: "started"`, use the returned `agentsJsonCommand` for agent-readable monitoring. Report concise conversation cards on meaningful state changes and final status. If the user wants a terminal monitor, tell them to open another terminal in the same project and run the returned `agentsTuiCommand`.

If the user asks to stop updates, stop polling only. If the user asks to cancel the task, call `rolemux cancel --parent-task <id>`.

## Boundaries

- Do not hardcode complex `codex`, `claude`, or `agy` flags.
- Do not use permission bypass or unsafe sandbox options unless the user explicitly requests them and accepts the risk.
- Do not read, log, or expose secrets, tokens, cookies, private account data, or credential files.
- Do not require a user project `AGENTS.md`. `--with-agents` is optional and must be requested explicitly.
- Do not claim RoleMux completed a run unless the command output or artifact metadata confirms it.

## Output To User

Report:

- The RoleMux command used.
- Provider and role.
- Status: dry-run, started, running, success, failed, timeout, canceled, or blocked.
- Artifact path when available.
- Any verification gap or manual follow-up.
