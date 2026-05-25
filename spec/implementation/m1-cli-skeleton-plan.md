# M1 CLI Skeleton Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 `install`、`doctor`、`run --dry-run` 的最小 CLI 骨架。

**Architecture:** 命令层只解析参数并调用 core 服务；provider 探测和 dry-run 预览先返回结构化数据，再由命令层格式化输出。

**Tech Stack:** TypeScript, Commander, Vitest, Node.js fs/path APIs.

---

## Files

- Create: `src/commands/install.ts`
- Create: `src/commands/doctor.ts`
- Create: `src/commands/run.ts`
- Create: `src/core/cli-error.ts`
- Create: `src/core/find-executable.ts`
- Modify: `src/cli.ts`
- Create: `tests/commands/install.test.ts`
- Create: `tests/commands/doctor.test.ts`
- Create: `tests/commands/run-dry-run.test.ts`
- Modify: `README.md`
- Modify: `docs/progress/*`

## Tasks

- [ ] 为每个命令写 failing test：help 注册、参数缺失、dry-run 输出。
- [ ] 实现 `CliError`，统一 `code`、`message`、`exitCode`。
- [ ] 实现 `findExecutable()`，支持 PATH 探测和 Windows 可执行扩展。
- [ ] 实现 `doctor`，输出 `codex`、`claude`、`agy` 的 found/missing 状态。
- [ ] 实现 `install --dry-run`，只打印计划写入路径。
- [ ] 实现 `run --dry-run`，校验 provider、role、task、workdir 并输出预览。
- [ ] 更新 README 命令示例。
- [ ] 更新三类留痕文档。
- [ ] 提交：`git commit -m "feat(M1): 增加 CLI 命令骨架"`

## Validation

```powershell
npm run typecheck
npm test
npm run build
node .\dist\cli.js --help
node .\dist\cli.js doctor
node .\dist\cli.js install --dry-run
node .\dist\cli.js run --provider codex --role builder --task .\README.md --workdir . --dry-run
git diff --check
```

Expected:

- `run --dry-run` 不调用外部 AI CLI。
- 缺失 provider 不导致 `doctor` 命令崩溃。
- 参数错误返回非零退出码并显示清晰错误。

## Subagent Handoff

- `rolemux-cli-builder` 负责命令和测试。
- `rolemux-reviewer` 审查错误码、Windows 路径和 dry-run 副作用。
