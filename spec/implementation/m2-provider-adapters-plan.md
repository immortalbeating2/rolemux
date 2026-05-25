# M2 Provider Adapters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 Codex、Claude、Agy adapter 与统一 process runner。

**Architecture:** provider adapter 只构造命令和参数数组；process runner 负责执行、超时和结果归一化；命令层通过 provider registry 使用 adapter。

**Tech Stack:** TypeScript, execa or Node child_process, Vitest mock executables.

---

## Files

- Create: `src/providers/provider.ts`
- Create: `src/providers/codex.ts`
- Create: `src/providers/claude.ts`
- Create: `src/providers/agy.ts`
- Create: `src/providers/index.ts`
- Create: `src/core/process-runner.ts`
- Modify: `src/commands/run.ts`
- Create: `tests/providers/provider-adapters.test.ts`
- Create: `tests/core/process-runner.test.ts`
- Create: `tests/fixtures/bin/README.md`
- Modify: `docs/progress/*`

## Tasks

- [ ] 写 adapter 测试，断言 `codex`、`claude`、`agy` 都返回参数数组。
- [ ] 写 process runner 测试，覆盖 success、non-zero exit、timeout、stderr。
- [ ] 定义 `ProviderAdapter`、`ProviderCommand`、`ProviderRunResult` 类型。
- [ ] 实现三个 provider adapter，并为非显而易见参数写注释。
- [ ] 实现 process runner，不拼接 shell 字符串。
- [ ] 将 `run` 非 dry-run 接入 adapter 与 process runner。
- [ ] 用 mock executable 运行集成测试。
- [ ] 更新三类留痕文档。
- [ ] 提交：`git commit -m "feat(M2): 增加 provider adapter 执行层"`

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
- 测试不依赖真实 `codex`、`claude`、`agy` 可用。

## Subagent Handoff

- `rolemux-researcher` 可先调研本机 CLI help，但不得把本机版本写成唯一事实。
- `rolemux-cli-builder` 负责 adapter、runner 和测试。
- `rolemux-reviewer` 审查 shell 注入、参数数组和错误保真度。
