# M1 阶段开发文档：CLI 骨架

状态：待执行

## 目标

完成 RoleMux 最小可用 CLI 骨架，让用户能运行 `rolemux install`、`rolemux doctor` 和 `rolemux run --dry-run`，并看到稳定、可测试的输出。

## 范围

本阶段包含：

- CLI 参数解析和帮助信息。
- `install` 命令的 dry-run 与目录规划输出。
- `doctor` 命令的 provider 可执行文件探测框架。
- `run --dry-run` 的 provider、role、task、workdir 参数校验和预览输出。
- 基础错误格式、退出码约定和命令测试。

本阶段不包含：

- 真实调用 `codex`、`claude`、`agy`。
- 真实复制 Skill 和 roles。
- 写入完整任务产物。
- 并行执行或 fallback。

## 主责角色

- 主责：`rolemux-cli-builder`
- 协作：`rolemux-docs-keeper`
- 审查：`rolemux-reviewer`

## 关键产物

- `src/commands/install.ts`
- `src/commands/doctor.ts`
- `src/commands/run.ts`
- `src/core/cli-error.ts`
- `src/core/find-executable.ts`
- `tests/commands/*.test.ts`

## 退出标准

- `rolemux --help` 展示命令列表。
- `rolemux doctor` 在 provider 存在和缺失时都有明确输出。
- `rolemux run --dry-run --provider codex --role builder --task <file>` 不执行外部 CLI，只打印将要执行的结构化预览。
- 参数缺失时返回非零退出码和清晰错误。
- 所有命令测试覆盖 Windows 空格路径。

## 风险

- CLI 框架选择会影响 help 文案和测试方式，M1 必须固定一种框架。
- doctor 不能把 provider 缺失当作 RoleMux 自身失败，除非用户要求 strict 模式。
