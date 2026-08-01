# RoleMux Eval Pack 设计

## 目标

用同一批 20 个只读、可判定的 RoleMux 仓库事实任务，对比三种执行方式：

1. `single`：单个 Codex CLI。
2. `unstructured`：Codex、Claude、Grok 使用相同通用提示并行分析，再汇总。
3. `structured`：相同 provider 按 architect/reviewer/counter-reviewer 分工，再由 summarizer 汇总。

## 公共契约

- 输入：版本化 `cases.json`，每个案例包含问题、允许读取路径、预先固定的事实匹配组和证据路径。
- 输出：版本化 `result.json`，包含 `mode`、摘要及每个案例的 claim、evidence、confidence。
- 评分：确定性字符串事实匹配、证据路径匹配和案例覆盖率；不得用 LLM judge。
- 安全：真实 provider 只在临时 detached git worktree 中读取仓库；运行结束强制移除该 worktree。

## 最小实现

- `eval/cases.json`：20 个案例。
- `eval/result.ts`：schema、输出解析、确定性评分和 Markdown 报告。
- `eval/run.ts`：复用现有 `runWorkflow`、provider adapter、role prompt 和 process runner 执行三种模式。
- `npm run eval:pack`：开发期实验入口，不新增公开 `rolemux eval` 命令。
- `tests/eval-pack.test.ts`：验证结果契约与评分 seam。

## 非目标

- Web Dashboard、数据库、自动学习路由、费用估算。
- 修改现有任务产物 schema。
- 把一次 Eval Pack 结果宣传为所有项目上的普遍性能结论。

## 成功标准

- 20 个案例均可由当前 HEAD 的明确源码事实判定。
- scorer 对完整、缺失和非法输出有稳定结果。
- mock/单元测试和全量项目门禁通过。
- 至少完成一次三模式真实运行，报告 provider 状态、正确率、证据率、覆盖率、耗时和残余风险。
