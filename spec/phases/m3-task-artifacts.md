# M3 阶段开发文档：任务产物体系

状态：待执行

## 目标

建立 `.rolemux/tasks/{task-id}/` 任务产物目录，保存任务输入、prompt、输出、stderr、metadata 和 provider run 记录，让每次执行可审计、可复现、可清理。

## 范围

本阶段包含：

- 定义 task id 生成策略。
- 实现 `task-store` 创建任务目录和写入产物。
- 定义 `metadata.json` schema。
- 将 `run` 命令接入 task store。
- 实现 `status` 和 `clean` 的最小能力。
- 测试重复 id、失败运行、超时运行和路径带空格场景。

本阶段不包含：

- HTML report。
- 跨机器任务同步。
- 数据库或远程存储。
- 长期任务索引优化。

## 主责角色

- 主责：`rolemux-cli-builder`
- 协作：`rolemux-docs-keeper`
- 审查：`rolemux-reviewer`

## 关键产物

- `src/core/task-store.ts`
- `src/core/task-metadata.ts`
- `src/commands/status.ts`
- `src/commands/clean.ts`
- `tests/core/task-store.test.ts`
- `tests/commands/status-clean.test.ts`

## 退出标准

- 每次非 dry-run 执行都会生成唯一任务目录。
- `task.md`、`prompt.md`、`output.md`、`metadata.json` 至少存在。
- provider 失败时保存 stderr、退出码和失败状态。
- `status` 能读取最近任务并输出摘要。
- `clean` 只清理 RoleMux 管理的任务目录，不能删除任意路径。

## 风险

- 清理命令存在误删风险，必须严格限制路径并优先支持 dry-run。
- metadata 一旦被 Skill 和 report 使用，将成为对外契约，字段变更必须走文档和测试同步。
