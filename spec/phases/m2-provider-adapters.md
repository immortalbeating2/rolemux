# M2 阶段开发文档：Provider Adapter MVP

状态：已完成，并于 2026-07-13 扩展 Grok Build provider；2026-07-31 开始扩展 OpenCode provider

## 目标

将 Codex、Claude、Agy、Grok Build、OpenCode 五类 CLI 的真实调用集中到 provider adapter 层，形成可 mock、可审计、可替换的执行边界。

## 范围

本阶段包含：

- 定义统一 `ProviderAdapter` 接口。
- 实现 `codex`、`claude`、`agy`、`grok`、`opencode` adapter 的命令构造。
- OpenCode 使用 `opencode run --pure --dir <workdir>` 非交互入口，默认不启用危险的 `--auto`。
- Windows 下直接启动官方 npm 包内的 `opencode.exe`，不把多行或含 `%` 的用户 prompt 交给 `cmd.exe` shim 重新解析。
- 实现 `process-runner`，统一超时、退出码、stdout/stderr 和错误对象。
- 用 mock executable 验证参数数组，不依赖真实 AI CLI 成功。
- 在 `run` 命令中接入 adapter 执行链。

本阶段不包含：

- 并行执行。
- fallback chain。
- HTML report。
- provider 版本自动适配的完整矩阵。

## 主责角色

- 主责：`rolemux-cli-builder`
- 调研：`rolemux-researcher`
- 审查：`rolemux-reviewer`

## 关键产物

- `src/providers/provider.ts`
- `src/providers/codex.ts`
- `src/providers/claude.ts`
- `src/providers/agy.ts`
- `src/providers/grok.ts`
- `src/providers/opencode.ts`
- `src/providers/index.ts`
- `src/core/process-runner.ts`
- `tests/providers/*.test.ts`
- `tests/fixtures/bin/`

## 退出标准

- 五个 adapter 都返回可执行文件名、参数数组和能力描述。
- `process-runner` 覆盖 success、non-zero exit、timeout、stderr 捕获。
- provider 参数测试证明没有 shell 字符串拼接。
- `run` 能通过 mock provider 执行并返回结构化结果。
- provider 参数假设已记录在注释、测试或文档中。
- OpenCode 真实固定输出与只读文件探针必须产生非空 stdout；退出码 `0` 但空输出仍按失败处理。

## 风险

- 各 CLI 参数可能随版本变化；adapter 注释必须说明当前假设来自 spec，后续由 `doctor` 和测试缓冲。
- 外部进程输出可能很长，M2 只需稳定捕获，不急于做流式 UI。
