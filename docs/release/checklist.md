# RoleMux Release Checklist

Use this checklist before publishing an MVP or review candidate.

## Scope Gate

- [ ] MVP scope is still limited to lightweight CLI orchestration, Skill bundle, roles, task artifacts, and static reporting.
- [ ] No cloud service, plugin marketplace, account system, or heavy dashboard has been added as a release blocker.
- [ ] Default install does not require or modify a user project `AGENTS.md`.
- [ ] Any `--with-agents` behavior is explicit opt-in and documented.

## Local Verification

Run from the repository root:

```powershell
npm install
npm run typecheck
npm test
npm run build
node .\dist\cli.js --help
node .\dist\cli.js doctor
node .\dist\cli.js install --dry-run
node .\dist\cli.js run --provider codex --role builder --task .\examples\basic-task.md --workdir . --dry-run
npm pack --dry-run
git diff --check
```

Expected result:

- Typecheck, tests, and build exit with code `0`.
- `install --dry-run` lists config, roles, and Codex/Claude Skill targets without writing files.
- `run --dry-run` prints the provider command preview without invoking a real provider.
- `npm pack --dry-run` includes `dist`, `skills`, `roles`, `templates`, `examples`, `docs/release/checklist.md`, and `README.md`.

## Package Contents

- [ ] Package includes compiled CLI files under `dist/`.
- [ ] Package includes `skills/codex/rolemux-workflow/SKILL.md`.
- [ ] Package includes `skills/claude/rolemux-workflow/SKILL.md`.
- [ ] Package includes default roles under `roles/`.
- [ ] Package includes `templates/config.toml` and `templates/report.html`.
- [ ] Package includes `examples/basic-task.md` and `examples/mock-provider/README.md`.
- [ ] Package includes `docs/release/checklist.md` or an equivalent release checklist.
- [ ] Package includes README and license files.
- [ ] Package does not include `.rolemux/tasks/`, local logs, `.env`, credentials, temporary files, or private config.

## Install Checks

Use a temporary HOME or isolated test profile:

```powershell
npm pack
npm install -g .\rolemux-0.1.0.tgz
rolemux --help
rolemux doctor
rolemux install --dry-run
rolemux run --provider codex --role builder --task .\examples\basic-task.md --workdir . --dry-run
```

Verify:

- [ ] Global `rolemux` command resolves.
- [ ] `doctor` reports provider availability or missing-provider guidance.
- [ ] Install does not overwrite existing config, roles, or Skill files unless an explicit overwrite option is used.
- [ ] Dry-run commands do not create real task output in user projects.

## Documentation Checks

- [ ] README install, doctor, run, Skill, example, and limitation sections match the implemented CLI.
- [ ] Skill docs describe trigger conditions and RoleMux CLI calls only.
- [ ] Role prompts are conservative and role-specific.
- [ ] Known limitations and non-MVP items are documented.
- [ ] Validation evidence is recorded in the release notes or progress log by the release owner.

## Security Checks

- [ ] No secrets, tokens, cookies, account identifiers, private paths, or local credentials are committed.
- [ ] Provider adapters do not use dangerous bypass flags by default.
- [ ] Windows paths with spaces are covered by tests or a manual dry-run.
- [ ] Mock provider tests do not call real AI CLIs.
- [ ] Published package excludes local artifacts and caches.
