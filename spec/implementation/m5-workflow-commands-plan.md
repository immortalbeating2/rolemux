# M5 Workflow Commands Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 `plan`、`review`、`discuss`、并行执行和 fallback。

**Architecture:** workflow runner 复用 provider adapter、process runner、prompt builder 和 task store；并行 run 使用独立 run id；fallback 保留全部失败尝试。

**Tech Stack:** TypeScript, Vitest, promise concurrency control.

---

## Files

- Create: `src/commands/plan.ts`
- Create: `src/commands/review.ts`
- Create: `src/commands/discuss.ts`
- Create: `src/core/workflow-runner.ts`
- Create: `src/core/fallback.ts`
- Create: `src/core/prompt-builder.ts`
- Modify: `src/cli.ts`
- Modify: `src/core/task-store.ts`
- Create: `tests/commands/workflow.test.ts`
- Create: `tests/core/fallback.test.ts`
- Modify: `docs/progress/*`

## Tasks

- [ ] 写 prompt builder 测试，验证 role、task、context、输出要求拼接顺序。
- [ ] 写 fallback 测试，覆盖首选失败、备用成功、全部失败。
- [ ] 写 discuss 并行测试，验证输出文件互不覆盖。
- [ ] 实现 `prompt-builder`。
- [ ] 实现 `workflow-runner`，复用 M2/M3 能力。
- [ ] 实现 `plan`、`review`、`discuss` 命令和 dry-run。
- [ ] 实现 fallback metadata，记录每次尝试。
- [ ] 更新 README workflow 示例。
- [ ] 更新三类留痕文档。
- [ ] 提交：`git commit -m "feat(M5): 增加多 provider 工作流命令"`

## Validation

```powershell
npm run typecheck
npm test
npm run build
node .\dist\cli.js plan --providers codex,claude --task .\README.md --dry-run
node .\dist\cli.js review --provider codex --task .\README.md --dry-run
node .\dist\cli.js discuss --providers codex,claude,agy --task .\README.md --mode parallel --dry-run
git diff --check
```

Expected:

- dry-run 不执行 provider。
- 并行输出路径隔离。
- fallback 不吞掉原始错误。

## Subagent Handoff

- `rolemux-architect` 先确认 workflow 数据结构。
- `rolemux-cli-builder` 实现命令、runner 和测试。
- `rolemux-reviewer` 审查并发、fallback 和写操作边界。
