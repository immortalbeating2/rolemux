# Grok Build Provider 设计

日期：2026-07-13

## 目标

把官方 Grok Build CLI 作为 RoleMux 的第四个 provider `grok`，使 `run`、`plan`、`review`、`discuss`、`dispatch`、manifest 和 `doctor` 复用现有执行、产物与监控链路。

## 已确认命令契约

- 官方 npm 包：`@xai-official/grok`。
- 本机验证版本：`grok 0.2.99`。
- 可执行文件：Windows 使用 `grok.exe`，其他平台使用 `grok`。
- 非交互调用：`grok --single <prompt>`。
- 工作目录：`--cwd <workdir>`。
- 输出：`--output-format plain`。

## 设计

新增 `src/providers/grok.ts`，只负责构造参数数组。默认追加：

- `--no-subagents`：由 RoleMux 负责编排，避免 provider 内再次递归分派。
- `--no-memory`：保持独立任务可复现，不读取跨 session 记忆。
- `--verbatim`：原样发送 RoleMux 已构造的 role prompt。

不默认传入 `--always-approve`、`bypassPermissions` 或其他降低安全边界的参数。Grok 原生支持 `GROK_SANDBOX`，RoleMux 直接继承环境，不新增重复配置层。模型与认证继续由 Grok CLI 自身管理，用户通过 `grok login` 完成登录。

把支持的 provider 名称集中到 `providerNames` tuple，供类型、CLI 校验、doctor、worker pool 和 manifest schema 复用，避免继续维护多份硬编码列表。

## 范围

包含：

- Grok adapter、registry、doctor、run/fallback、worker pool 和 manifest 支持。
- provider mock override：`ROLEMUX_PROVIDER_GROK_COMMAND` 与 `ROLEMUX_PROVIDER_GROK_ARGS_PREFIX`。
- 通用 Skill、配置模板、README、M2 spec 和进度留痕更新。
- adapter、doctor、worker pool、manifest、workflow dry-run 与 mock execution 测试。

不包含：

- 把 RoleMux Skill 安装到 Grok 宿主。
- Grok plugin、MCP 或 Agent SDK 集成。
- 自动登录、读取凭据、固定模型或默认危险权限。
- prompt-file 长文本优化；只有真实命令长度成为问题时再增加。

## 验收

- `rolemux doctor --providers grok` 能发现本机 `grok.exe`。
- `rolemux run --provider grok ... --dry-run` 输出参数数组且不执行 provider。
- mock Grok provider 能通过真实 `run` 写出任务产物。
- `dispatch --providers 'codex:1,grok:1' --dry-run` 可生成 Grok worker。
- typecheck、unit、E2E、build、pack dry-run 和 `git diff --check` 全部通过。
