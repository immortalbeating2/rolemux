# RoleMux Evidence Workflows 设计

## 目标

在不引入通用 DAG、数据库、Dashboard 或机器学习路由器的前提下，完成六项增强：评测基线、统一结果契约、独立分析/质疑/验证/汇总、轻量能力路由、预算与提前停止、可复现元数据。

## 兼容边界

- 现有 `output.md`、`metadata.json` 和命令默认行为不变。
- `result.json` 仅在显式请求结构化结果或 structured discussion 时生成。
- 新 metadata 字段保持可选，旧 artifact 仍可解析。
- provider adapter 继续集中构造参数数组；不得把 provider 参数散落到 command 或 Skill。
- 验证命令只接受 JSON 中的 `executable + args[]`，不接受 shell 字符串。
- 自动路由只给出/采用确定性规则结果，用户显式 provider 始终优先。

## 公共契约

### Task result

`result.json` 使用 `schemaVersion: 1`：

- `summary`
- `findings[]`: `id`、`severity`、`claim`、`evidence[]`、`confidence`、`status`
- `risks[]`
- `recommendedActions[]`
- `verification[]`: 验证名称、状态、退出码和简短输出

结构化输出解析失败时保留原始 `output.md`，运行状态标记为 `failed`，stderr 写入明确诊断。

### Provenance

新运行记录：Git HEAD、prompt SHA-256、执行配置 SHA-256、provider executable、可获取的 CLI version、模型报告状态和人工批准记录状态。无法确认的模型或版本使用 `null/not-reported`，不得猜测。

### Budget

- 总 deadline/timeout。
- 最大 provider 数。
- 最大 fallback 尝试次数。
- 已成功时停止 fallback。
- structured workflow 只把唯一候选输出交给后续阶段；不做语义相似度推断。

### Structured discussion

```text
独立候选分析（并行）
  -> 单一 counter-reviewer 读取匿名候选并找反例
  -> 参数数组验证命令
  -> 单一 summarizer 结合候选、质疑和验证生成 result.json
```

每个 provider 调用继续使用现有 task artifacts；structured command 返回阶段 task id、状态和验证结果。

### Routing

支持固定 task kind：`architecture`、`research`、`implementation`、`ui-review`、`failure-review`。adapter capability 声明 task kinds，router 按固定优先级、available/exclude/maxProviders 选择；不学习、不联网、不自动修改配置。

## 非目标

- 通用 workflow graph、循环自治规划和动态代码生成器。
- token/费用精确计费（CLI 当前不能统一提供）。
- 通过多数票代替代码或测试验证。
- 猜测 provider 实际模型名。
- 默认调用全部 provider。

## 验收

- 所有新契约有版本化 schema 和公开 seam 测试。
- 旧 metadata、旧 CLI 默认路径与现有 E2E 保持通过。
- structured workflow 可用 mock provider 完整生成阶段产物与最终 `result.json`。
- route、budget、fallback 和验证清单有确定性测试。
- Eval Pack 增加新能力案例；至少一次受控真实 smoke 保存 provider 状态。
- 完整 release 门禁与 runtime audit 通过。
