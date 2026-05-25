# RoleMux 阶段实施文档索引

更新时间：2026-05-25

本目录保存 M0-M6 的阶段实施文档。实施文档面向后续 agent 或开发者，说明每个阶段要按什么顺序修改哪些文件、运行哪些验证、什么时候提交。

阶段实施必须先读取对应 `spec/phases/` 文档，再读取本目录对应 plan。

## 实施顺序

1. `m0-project-initialization-plan.md`
2. `m1-cli-skeleton-plan.md`
3. `m2-provider-adapters-plan.md`
4. `m3-task-artifacts-plan.md`
5. `m4-skill-bundle-plan.md`
6. `m5-workflow-commands-plan.md`
7. `m6-reporting-release-plan.md`

## 通用实施门禁

- 每个阶段先写或更新测试，再实现最小代码。
- 每个阶段结束前运行该阶段列出的验证命令。
- 如果验证命令因工程尚未具备而无法运行，必须记录原因和替代检查。
- 每个阶段结束前更新 `docs/progress/status.md`、`docs/progress/timeline.md` 和当日日志。
- 阶段提交信息格式：`feat(Mn): 中文说明` 或 `docs(Mn): 中文说明`。
