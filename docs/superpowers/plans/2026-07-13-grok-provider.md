# Grok Build Provider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将官方 Grok Build CLI 作为 RoleMux 第四个 provider `grok` 接入现有工作流。

**Architecture:** 新增一个只构造参数数组的 Grok adapter，并复用现有 provider registry、process runner、task store、fallback、dispatch 和 mock override。支持的 provider 名称由单一 tuple 提供，避免 run、doctor、worker 和 manifest 各自维护列表。

**Tech Stack:** TypeScript, Commander, Zod, Vitest, tsup, official `@xai-official/grok` CLI.

---

### Task 1: 固化 provider 契约

**Files:**
- Modify: `tests/providers/provider-adapters.test.ts`
- Modify: `tests/commands/doctor.test.ts`
- Modify: `tests/core/worker-pool.test.ts`
- Modify: `tests/core/subtask-manifest.test.ts`

- [ ] 添加断言：registry 可取得 `grok`，命令使用 `grok.exe|grok`、`--cwd`、`--output-format plain`、`--no-subagents`、`--no-memory`、`--verbatim`、`--single <prompt>`。
- [ ] 添加断言：doctor 可发现 `grok.exe`，worker pool 与 manifest 接受 `grok`。
- [ ] 运行 `npx vitest run tests/providers/provider-adapters.test.ts tests/commands/doctor.test.ts tests/core/worker-pool.test.ts tests/core/subtask-manifest.test.ts`，确认因 `grok` 尚未进入 `ProviderName`/registry/schema 而失败。

### Task 2: 实现最小 provider 支持

**Files:**
- Create: `src/providers/grok.ts`
- Modify: `src/providers/provider.ts`
- Modify: `src/providers/index.ts`
- Modify: `src/commands/doctor.ts`
- Modify: `src/commands/run.ts`
- Modify: `src/core/worker-pool.ts`
- Modify: `src/core/subtask-manifest.ts`
- Modify: `src/cli.ts`

- [ ] 在 `provider.ts` 导出 `providerNames = ['codex', 'claude', 'agy', 'grok'] as const`、派生 `ProviderName` 和集中 `isProviderName()`。
- [ ] 新增 `grokAdapter`，通过 `applyProviderCommandOverride()` 构造以下参数：

```ts
[
  '--cwd', input.workdir,
  '--output-format', 'plain',
  '--no-subagents',
  '--no-memory',
  '--verbatim',
  '--single', input.prompt
]
```

- [ ] registry 注册 `grokAdapter`；run、doctor、worker、manifest 和 CLI 改为复用集中 provider 名称/校验。
- [ ] 运行 Task 1 定向测试，确认全部通过。
- [ ] 运行 `npm run lint` 和 `npm run typecheck`，修复全部类型或格式问题。

### Task 3: 验证完整执行链

**Files:**
- Modify: `tests/commands/workflow.test.ts`
- Modify: `tests/commands/run.test.ts`（若该文件不存在，则在现有最接近的真实 run 测试中增加 Grok case）

- [ ] 添加 Grok workflow dry-run，断言 `run`/`discuss` 返回 Grok command。
- [ ] 使用 `ROLEMUX_PROVIDER_GROK_COMMAND` 与 `ROLEMUX_PROVIDER_GROK_ARGS_PREFIX` 运行 mock provider，断言任务状态、provider 和产物内容。
- [ ] 先运行新增测试确认失败，再写最小实现或测试接线使其通过。
- [ ] 运行相关测试与 `npm run lint`。

### Task 4: 同步用户契约与项目文档

**Files:**
- Modify: `skills/rolemux-workflow/SKILL.md`
- Modify: `AGENTS.md`
- Modify: `templates/config.toml`
- Modify: `README.md`
- Modify: `package.json`
- Modify: `spec/rolemux-development-spec.md`
- Modify: `spec/phases/m2-provider-adapters.md`
- Modify: `spec/implementation/m2-provider-adapters-plan.md`
- Modify: `docs/dev/code-style.md`
- Modify: `docs/progress/status.md`
- Modify: `docs/progress/timeline.md`
- Create: `docs/progress/logs/2026-07-13.md`

- [ ] 将产品描述、provider 示例、doctor、run、discuss、dispatch、配置示例和验收标准更新为支持 Grok。
- [ ] 明确 Grok 是 provider，不是新的 Skill 安装目标；默认不使用危险权限参数。
- [ ] 更新状态顶部、时间线和当日日志，记录命令依据、改动范围、验证结果与残余风险。
- [ ] 运行 `git diff --check`。

### Task 5: 发布级验证与本地插件刷新

**Files:**
- Verify only; install command may update configured RoleMux plugin source/cache outside the repository.

- [ ] 运行 `npm run typecheck`、`npm test`、`npm run test:e2e`、`npm run build`、`npm pack --dry-run`、`npm audit --audit-level=high`、`git diff --check`。
- [ ] 运行 `node .\dist\cli.js doctor --providers grok`，确认发现本机 Grok Build CLI。
- [ ] 运行 `node .\dist\cli.js run --provider grok --role reviewer --task .\examples\basic-task.md --workdir . --dry-run`。
- [ ] 运行 `node .\dist\cli.js dispatch --manifest <temporary-manifest> --providers 'codex:1,grok:1' --dry-run`。
- [ ] 运行 `node .\dist\cli.js install --codex-plugin` 刷新 Codex 插件源与缓存，并检查已安装 Skill 包含 Grok 示例。
