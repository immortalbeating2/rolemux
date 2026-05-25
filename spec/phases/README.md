# RoleMux 阶段开发文档索引

更新时间：2026-05-25

本目录将 `spec/rolemux-development-spec.md` 中的完整开发内容拆分为 M0-M6 七个阶段。每个阶段文档说明该阶段要交付什么、由哪些 subagent 主责、依赖哪些前置条件、何时可以进入下一阶段。

阶段文档只定义“做什么”和“验收到什么程度”；具体“怎么做”见 `spec/implementation/`。

## 阶段总览

| 阶段 | 文档 | 实施文档 | 阶段目标 |
|---|---|---|---|
| M0 | `spec/phases/m0-project-initialization.md` | `spec/implementation/m0-project-initialization-plan.md` | 初始化 TypeScript CLI 工程与基础质量门禁 |
| M1 | `spec/phases/m1-cli-skeleton.md` | `spec/implementation/m1-cli-skeleton-plan.md` | 完成 `install`、`doctor`、`run --dry-run` 最小命令骨架 |
| M2 | `spec/phases/m2-provider-adapters.md` | `spec/implementation/m2-provider-adapters-plan.md` | 完成 Codex、Claude、Agy provider adapter MVP |
| M3 | `spec/phases/m3-task-artifacts.md` | `spec/implementation/m3-task-artifacts-plan.md` | 完成 `.rolemux/tasks/{task-id}` 任务产物体系 |
| M4 | `spec/phases/m4-skill-bundle.md` | `spec/implementation/m4-skill-bundle-plan.md` | 完成 Codex/Claude Skill bundle 与默认 roles |
| M5 | `spec/phases/m5-workflow-commands.md` | `spec/implementation/m5-workflow-commands-plan.md` | 完成 `plan`、`review`、`discuss`、并行和 fallback |
| M6 | `spec/phases/m6-reporting-release.md` | `spec/implementation/m6-reporting-release-plan.md` | 完成 HTML report、README、打包与发布准备 |

## 阶段推进规则

- 每次开始阶段实现前，必须读取对应阶段文档和实施文档。
- 当前阶段退出标准未满足，不进入下一阶段。
- 如果实现中发现 provider 参数、安装路径、任务产物结构或安全边界不成立，必须更新阶段文档并记录到 `docs/progress/logs/YYYY-MM-DD.md`。
- 阶段实现可以拆给 subagent，但同一文件或同一对外契约只能由一个实现代理主责。
- 每个阶段结束时必须更新 `docs/progress/status.md`、`docs/progress/timeline.md` 和当日日志。
