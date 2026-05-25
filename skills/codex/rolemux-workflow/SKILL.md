---
name: rolemux-workflow
description: Use RoleMux when a Codex session needs lightweight multi-CLI collaboration, role-based delegation, planning, review, discussion, or a dry-run preview across Codex, Claude, and Agy providers.
---

# RoleMux Workflow

Use this skill when the user asks Codex to coordinate work with another AI CLI, compare answers from multiple providers, split a task by role, request an external review, or preserve auditable task artifacts through RoleMux.

## Trigger Conditions

Invoke RoleMux when the user asks for any of these:

- Multi-CLI collaboration with Codex, Claude, Agy, or Antigravity.
- Role-based work such as architect, builder, reviewer, frontend-reviewer, or summarizer.
- A plan, review, implementation pass, or discussion handled by another provider.
- A dry-run preview of what RoleMux would execute.
- A saved task artifact under `.rolemux/tasks/`.

Do not invoke RoleMux for a simple local edit or explanation that the current Codex session can complete directly.

## Workflow

1. Confirm the user's goal and choose the smallest RoleMux command that fits it.
2. Use an existing task file when the user provides one. Otherwise create a concise temporary task file in the current project only when writing is allowed.
3. Run RoleMux from the project workdir.
4. Read the command output and any reported artifact path.
5. Summarize the result for the user, including provider, role, status, and artifact location.

## Commands

Use these command shapes. Let RoleMux and its provider adapters decide provider-specific arguments.

```powershell
rolemux doctor
rolemux run --provider codex --role builder --task .\examples\basic-task.md --workdir . --dry-run
rolemux plan --providers claude,codex --task .\examples\basic-task.md --workdir . --dry-run
rolemux review --provider codex --role reviewer --task .\examples\basic-task.md --workdir . --dry-run
rolemux discuss --providers claude,codex,agy --task .\examples\basic-task.md --workdir . --mode parallel --dry-run
```

Use `--dry-run` first when the user asks to inspect the planned execution or when the target project should not be modified.

## Boundaries

- Do not hardcode low-level `codex`, `claude`, or `agy` command arguments in this skill.
- Do not use dangerous sandbox bypass flags unless the user explicitly requests them and accepts the risk.
- Do not read or print secrets, tokens, cookies, private account data, or local credential files.
- Do not require the user's project to modify `AGENTS.md`. Treat `--with-agents` as an explicit opt-in only.
- Do not overwrite user task artifacts or config files without a clear RoleMux command that supports that behavior.

## Output To User

Report:

- The RoleMux command used.
- Provider and role.
- Status: dry-run, success, failed, timeout, or blocked.
- Artifact path when RoleMux provides one.
- Any verification gap or manual follow-up needed.
