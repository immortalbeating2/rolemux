# RoleMux Evidence Workflows 实施计划

实施状态：完成；最终 release gate 与受控真实 smoke 状态已记录。

## Phase 1：结果与 provenance

1. RED：TaskStore 在结构化运行中应写入 `result.json`，metadata 应引用它并保存 provenance。
2. GREEN：实现 `task-result.ts`、provenance 收集和向后兼容 metadata。
3. 将 `--result-json` 接入 `run`、`review`、`plan`；默认路径不变。

## Phase 2：预算

1. RED：fallback 应遵守最大尝试和总 deadline。
2. GREEN：用一个共享 budget helper 约束 `run`，保留首个 success 即停止。
3. 接入 CLI 的 `--timeout-ms`、`--max-attempts`。

## Phase 3：结构化讨论

1. RED：独立候选不能读取其他候选；counter-review 和 summarizer 必须收到阶段证据。
2. GREEN：扩展 `discuss --mode structured`，复用 `runWorkflow`/TaskStore。
3. 新增版本化验证清单，使用 `runProcess` 参数数组执行并保存结果。

## Phase 4：规则路由

1. RED：每种 task kind、exclude、available、maxProviders 均有确定性选择结果。
2. GREEN：扩展 provider capability，新增 `route` 命令；structured discuss 可在未显式 provider 时采用路由结果。

## Phase 5：评测与收口

1. 扩展 Eval Pack 案例覆盖 result、provenance、budget、structured、routing。
2. 运行 mock structured E2E 和受控真实 smoke。
3. 更新 README、Skill、总 spec、status、timeline 和日志。
4. 运行 `npm run lint`、`npm run typecheck`、`npm test`、`npm run test:e2e`、`npm run build`、`npm audit --omit=dev --audit-level=high`、`npm pack --dry-run`、`git diff --check`。

不新增依赖，不自动提交或推送，不修改用户安装目录。
