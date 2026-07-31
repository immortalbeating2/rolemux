# M2 Provider Adapters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 Codex、Claude、Agy、Grok Build、OpenCode adapter 与统一 process runner。

**Architecture:** provider adapter 只构造命令和参数数组；process runner 负责执行、超时和结果归一化；命令层通过 provider registry 使用 adapter。

**Tech Stack:** TypeScript, execa or Node child_process, Vitest mock executables.

---

## Files

- Create: `src/providers/provider.ts`
- Create: `src/providers/codex.ts`
- Create: `src/providers/claude.ts`
- Create: `src/providers/agy.ts`
- Create: `src/providers/grok.ts`
- Create: `src/providers/opencode.ts`
- Create: `src/providers/index.ts`
- Create: `src/core/process-runner.ts`
- Modify: `src/commands/run.ts`
- Create: `tests/providers/provider-adapters.test.ts`
- Create: `tests/core/process-runner.test.ts`
- Create: `tests/fixtures/bin/README.md`
- Modify: `docs/progress/*`

## Tasks

- [x] 写 adapter 测试，断言 `codex`、`claude`、`agy`、`grok` 都返回参数数组。
- [x] 写 process runner 测试，覆盖 success、non-zero exit、timeout、stderr。
- [x] 定义 `ProviderAdapter`、`ProviderCommand`、`ProviderRunResult` 类型。
- [x] 实现四个 provider adapter，并为非显而易见参数写注释。
- [x] 实现 process runner，不拼接 shell 字符串。
- [x] 将 `run` 非 dry-run 接入 adapter 与 process runner。
- [x] 用 mock executable 运行集成测试。
- [x] 更新三类留痕文档。
- [ ] 提交：`git commit -m "feat(M2): 增加 provider adapter 执行层"`

## 2026-07-31 OpenCode Expansion

- [x] 先写 OpenCode adapter、doctor、worker pool、manifest 和 workflow RED 测试。
- [x] 将 `opencode` 加入共享 provider tuple 与 registry，不复制 CLI 校验逻辑。
- [x] Windows 直接解析官方 `opencode-ai/bin/opencode.exe`，避免 `.cmd` 重解释 `%` 和多行 prompt。
- [x] 使用 `opencode run --pure --dir <workdir> --format default <prompt>`，默认不增加 `--auto`。
- [x] 复用现有输出清理、timeout、cancel、fallback 和 agents TUI，不新增 OpenCode 专属 TUI。
- [x] 更新 config、Skill、README、总 spec 与三类进度留痕。
- [x] 运行 mock provider、真实固定输出、真实只读文件、隔离写入、timeout、cancel、fallback 和 Windows PTY 监控验证。
- [x] 刷新 Codex 插件与 Claude Skill 安装副本，核对 SHA256。

## Validation

```powershell
npm run typecheck
npm test
npm run build
git diff --check
```

Expected:

- provider 参数通过测试验证为数组。
- 超时和非零退出码被结构化记录。
- 测试不依赖真实 `codex`、`claude`、`agy`、`grok` 可用。
- 自动化测试不依赖真实 OpenCode；真实认证单独使用系统临时目录并核对非空任务产物。

## Subagent Handoff

- `rolemux-researcher` 可先调研本机 CLI help，但不得把本机版本写成唯一事实。
- `rolemux-cli-builder` 负责 adapter、runner 和测试。
- `rolemux-reviewer` 审查 shell 注入、参数数组和错误保真度。
