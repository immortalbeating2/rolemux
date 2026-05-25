# M5 阶段开发文档：工作流命令

状态：待执行

## 目标

在单次 `run` 基础上补齐 `plan`、`review`、`discuss`、并行执行和 fallback，让 RoleMux 能支撑多 CLI 多角色协作。

## 范围

本阶段包含：

- `plan` 命令：调用一个或多个 provider 生成方案。
- `review` 命令：调用 reviewer role 审查文件、diff 或任务说明。
- `discuss` 命令：多个 provider 并行输出观点并保存产物。
- fallback chain：主 provider 失败后按用户配置尝试备用 provider。
- 基础并发控制和输出合并。
- 工作流级 metadata。

本阶段不包含：

- 复杂有向图 workflow engine。
- 长生命周期后台任务。
- Web dashboard。
- 自动修改项目代码。

## 主责角色

- 主责：`rolemux-cli-builder`
- 架构：`rolemux-architect`
- 审查：`rolemux-reviewer`

## 关键产物

- `src/commands/plan.ts`
- `src/commands/review.ts`
- `src/commands/discuss.ts`
- `src/core/workflow-runner.ts`
- `src/core/fallback.ts`
- `tests/commands/workflow.test.ts`
- `tests/core/fallback.test.ts`

## 退出标准

- `plan`、`review`、`discuss` 都支持 dry-run。
- 并行执行不会让多个 provider 写同一个 output 文件。
- fallback 行为能记录每次尝试和失败原因。
- 工作流产物能被 `status` 读取。
- 写操作仍由用户明确指定，不由 workflow 命令默认接管。

## 风险

- 并行输出和任务目录命名容易冲突，需要以 run id 或 provider-role 组合隔离。
- fallback 可能掩盖真实错误，metadata 必须保留所有失败尝试。
