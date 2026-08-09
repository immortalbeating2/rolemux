# RoleMux Preflight 与原生子代理监控设计

## 目标

按 P0-P3 渐进增强现有工作流，不替换 RoleMux worker：

1. 所有真实 provider 命令在启动任何进程前完成 executable preflight。
2. 可选深度 probe 验证认证、网络和非交互 stdout，并返回结构化 `blocked` 诊断。
3. 只在显式 opt-in 时读取 provider 的机器事件流，把可确认的原生子代理映射到现有 monitor。
4. Codex、Claude、Grok 先行；Agy、OpenCode 只在真实事件包含稳定 child id/lifecycle 后启用。
5. 顶层 fan-out 的并发 worker 状态不得互相覆盖，terminal 状态必须在对应 provider 完成时立即可见。

## 公共 seam

- CLI JSON：preflight 失败返回 `status=blocked`、provider、reason、next action，且不启动任何 provider。
- Manifest/dispatch：所有 assignment provider 先统一检查，不允许部分启动。
- Agents monitor：保留现有顶层 agent；原生 child 作为可选嵌套 activity，不改变 write policy 或 merge 边界。
- Fan-out monitor：完整 read-modify-write 串行化；provider terminal 与后续 artifact 事件分离。

## 安全与兼容

- dry-run 不做认证或网络 probe。
- 用户显式 provider 不自动替换；blocked 后由宿主汇报并等待用户决定。
- CLI 不保持空等待进程；修复后重跑原命令。
- 原生子代理共享父 provider 的 workdir 与权限，不获得独立 `writePolicy`，不能冒充 RoleMux isolated worker。
- 继续使用参数数组，不新增依赖，不读取 credential 文件。

## 非目标

- 通用 ACP 平台或跨 provider event database。
- 默认启用 provider-native subagents。
- 为无法证明 child lifecycle 的 provider 猜测事件。
- 自动登录、自动修改配置或自动降级权限。

## 真实支持矩阵（2026-08-04）

| Provider | 结果 | RoleMux 行为 |
|---|---|---|
| Claude | 稳定 `task_id` 与 start/completion | 支持 `--native-agents` |
| Agy | 稳定 `conversation_id` 与 ACTIVE/DONE | 支持 `--native-agents` |
| Codex | 本机 `collab spawn failed` | capability blocked |
| Grok | 原生 spawn 未成功，伴随认证刷新告警 | capability blocked |
| OpenCode | 只有 completion tool event | capability blocked |
