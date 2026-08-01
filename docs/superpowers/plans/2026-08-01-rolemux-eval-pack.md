# RoleMux Eval Pack 实施计划

1. RED：为 `result.json` 解析和确定性评分编写失败测试。
2. GREEN：实现最小 schema、scorer 和 Markdown renderer。
3. 增加 20 个固定案例并验证 pack schema。
4. 实现复用 `runWorkflow` 的三模式 runner 和临时 worktree 生命周期。
5. 用 provider override/mock 验证 runner，不调用真实 provider。
6. 执行 Codex/Claude/Grok 真实批量评测并生成报告。
7. 运行 `npm run lint`、`npm run typecheck`、`npm test`、`npm run test:e2e`、`npm run build`、`npm audit --omit=dev --audit-level=high` 和 `git diff --check`。
8. 更新 README、总 spec、当前状态、时间线和当日日志。

不新增依赖，不新增公开 CLI 命令，不提交 `.rolemux/` 或 Eval 原始临时目录。
