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
npm run test:e2e
npm run build
node .\dist\cli.js --help
node .\dist\cli.js doctor
node .\dist\cli.js install --dry-run
node .\dist\cli.js install --codex --claude --dry-run
node .\dist\cli.js install --codex-plugin --dry-run
node .\dist\cli.js uninstall --dry-run
node .\dist\cli.js uninstall --codex-plugin --dry-run
node .\dist\cli.js run --provider codex --role builder --task .\examples\basic-task.md --workdir . --dry-run
node .\dist\cli.js run --provider codex --role reviewer --task .\examples\basic-task.md --result-json --max-attempts 1 --timeout-ms 5000 --dry-run
node .\dist\cli.js route --task-kind research --available codex,grok --max-providers 1
node .\dist\cli.js discuss --task .\examples\basic-task.md --mode structured --task-kind failure-review --available codex,grok --verification-manifest .\examples\verification-manifest.json --dry-run
npm pack --dry-run
git diff --check
```

Expected result:

- Typecheck, tests, e2e tests, and build exit with code `0`.
- `test:e2e` uses a mock provider and isolated temporary HOME/workdir to exercise install, non-dry-run run, status, clean, and uninstall.
- `install --dry-run` lists only shared runtime targets and marks Codex/Claude/plugin targets as optional-not-selected.
- `install --codex --claude --dry-run` lists non-plugin Skill targets without writing files.
- `install --codex-plugin --dry-run` lists Codex App plugin source/cache targets without writing `~/.codex/skills`.
- `uninstall --dry-run` lists shared runtime plus Codex/Claude non-plugin Skill targets without deleting files.
- `uninstall --codex-plugin --dry-run` lists only Codex App plugin source/cache targets.
- `run --dry-run` prints the provider command preview without invoking a real provider.
- `npm pack --dry-run` includes `dist`, `skills`, `roles`, `templates`, `examples`, `docs/release/checklist.md`, and `README.md`.

## Package Contents

- [ ] Package includes compiled CLI files under `dist/`.
- [ ] Package includes shared Skill source `skills/rolemux-workflow/SKILL.md`.
- [ ] Package does not include obsolete host-specific Skill source copies under `skills/codex/` or `skills/claude/`.
- [ ] Package includes default roles under `roles/`.
- [ ] Package includes `templates/config.toml` and `templates/report.html`.
- [ ] Package includes `examples/basic-task.md`, `examples/verification-manifest.json`, and `examples/mock-provider/README.md`.
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
rolemux install --codex --claude --dry-run
rolemux uninstall --dry-run
rolemux run --provider codex --role builder --task .\examples\basic-task.md --workdir . --dry-run
```

Verify:

- [ ] Global `rolemux` command resolves.
- [ ] `doctor` reports provider availability or missing-provider guidance.
- [ ] Default install does not write Codex/Claude non-plugin Skill files.
- [ ] Explicit `--codex` and `--claude` install non-plugin Skill files without overwriting existing files.
- [ ] `install --codex-plugin` refreshes Codex App plugin source/cache only when explicitly requested.
- [ ] Uninstall dry-run lists only RoleMux-owned config, roles, and Skill bundle paths.
- [ ] Dry-run commands do not create real task output in user projects.

## Documentation Checks

- [ ] README install, uninstall, doctor, run, Skill, example, and limitation sections match the implemented CLI.
- [ ] Skill docs describe trigger conditions and RoleMux CLI calls only.
- [ ] Role prompts are conservative and role-specific.
- [ ] Known limitations and non-MVP items are documented.
- [ ] Validation evidence is recorded in the release notes or progress log by the release owner.

## E2E Checks

- [ ] `npm run test:e2e` passes from a clean checkout after dependency install.
- [ ] The mock provider output is written to `.rolemux/tasks/{task-id}/output.md`.
- [ ] `status` reads the generated task artifact.
- [ ] `clean` removes generated task directories.
- [ ] `uninstall` removes RoleMux install targets from the isolated HOME.

## Security Checks

- [ ] No secrets, tokens, cookies, account identifiers, private paths, or local credentials are committed.
- [ ] Provider adapters do not use dangerous bypass flags by default.
- [ ] Windows paths with spaces are covered by tests or a manual dry-run.
- [ ] Mock provider tests do not call real AI CLIs.
- [ ] Published package excludes local artifacts and caches.
