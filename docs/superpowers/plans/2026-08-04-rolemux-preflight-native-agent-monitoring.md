# RoleMux Preflight 与原生子代理监控实施计划

实施状态：进行中。

## P0：执行前门禁

1. RED：`run` 与 `dispatch` 在 provider 缺失时必须 blocked，且不写运行产物或启动其他 provider。
2. GREEN：新增共享 preflight core；接入 run/plan/discuss/dispatch，review 复用 run。
3. CLI 将 preflight 错误输出为结构化 JSON 和非零退出码。

## P1：深度 probe

1. RED：`doctor --probe` 必须区分 executable missing、timeout、auth/output failure 和 passed。
2. GREEN：复用 adapter、process/PTY runner 执行固定只读 token probe；输出只保留紧凑诊断。
3. 更新 Skill：长任务先 probe，blocked 时汇报并等待用户，不自动替换显式 provider。

## P2：Codex、Claude、Grok

1. [x] 真实捕获三者机器事件，确认 child id/type/lifecycle；Claude 通过，Codex/Grok 记录真实阻塞。
2. [x] 只为已确认事件增加 provider event parser 和显式 native-agents 选项。
3. [x] 映射到 monitor/TUI；取消与写入边界仍由顶层 RoleMux worker 负责。

## P3：Agy、OpenCode

1. [x] 真实认证 stream-json/json 是否包含稳定子代理生命周期；Agy 通过，OpenCode 为 completion-only。
2. [x] 证据充分才接入；否则记录 blocked capability，不做文本启发式解析。

## P4：顶层 fan-out 最小优化

1. [x] RED：并发 worker start 更新不得丢失；快速 worker 的 terminal 事件必须早于慢 worker 完成。
2. [x] GREEN：monitor read-modify-write 使用单一事务队列；provider completion 与 artifact completion 分离。
3. [x] Skill 默认仅为两个以上独立、预计约 30 秒以上的子任务使用 fan-out；普通执行不重复深度 probe。

## 最终门禁

`npm run lint`、`npm run typecheck`、`npm test`、`npm run test:e2e`、`npm run build`、runtime audit、pack dry-run、CLI smoke、`git diff --check`。

结果：全部通过；unit `165/165`，E2E `3/3`，runtime audit `0 vulnerabilities`。
