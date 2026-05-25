# M3 Task Artifacts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 `.rolemux/tasks/{task-id}/` 任务产物体系。

**Architecture:** task store 是唯一写入任务目录的模块；命令层只请求创建任务、写入产物和读取状态；metadata schema 集中定义。

**Tech Stack:** TypeScript, Node.js fs/promises, zod, Vitest temp directories.

---

## Files

- Create: `src/core/task-metadata.ts`
- Create: `src/core/task-store.ts`
- Create: `src/commands/status.ts`
- Create: `src/commands/clean.ts`
- Modify: `src/commands/run.ts`
- Modify: `src/cli.ts`
- Create: `tests/core/task-store.test.ts`
- Create: `tests/commands/status-clean.test.ts`
- Modify: `docs/progress/*`

## Tasks

- [ ] 写 metadata schema 测试，覆盖 success、failed、timeout 状态。
- [ ] 写 task store 测试，覆盖目录创建、重复 id、路径带空格。
- [ ] 定义 task metadata 类型和 zod schema。
- [ ] 实现 task id 生成，包含时间戳和短随机后缀。
- [ ] 实现写入 `task.md`、`prompt.md`、`output.md`、`stderr.log`、`metadata.json`。
- [ ] 将 `run` 接入 task store，dry-run 不写任务产物。
- [ ] 实现 `status` 最近任务摘要。
- [ ] 实现 `clean --dry-run` 和受限清理。
- [ ] 更新三类留痕文档。
- [ ] 提交：`git commit -m "feat(M3): 增加任务产物存储"`

## Validation

```powershell
npm run typecheck
npm test
npm run build
node .\dist\cli.js run --provider codex --role builder --task .\README.md --workdir . --dry-run
git diff --check
```

Expected:

- 非 dry-run mock 执行生成完整任务目录。
- dry-run 不创建 `.rolemux/tasks/` 运行产物。
- `clean --dry-run` 不删除文件。

## Subagent Handoff

- `rolemux-cli-builder` 负责 task store、命令和测试。
- `rolemux-reviewer` 审查误删风险和 metadata 兼容性。
