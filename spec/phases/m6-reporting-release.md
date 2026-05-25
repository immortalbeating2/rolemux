# M6 阶段开发文档：报告与发布准备

状态：待执行

## 目标

完成 HTML run report、README、示例、npm 打包校验和发布准备，使 RoleMux MVP 可以被本地安装、试用和评审。

## 范围

本阶段包含：

- 生成 `report.html` 或等效静态报告。
- 完善 README：安装、doctor、run、Skill 使用、限制和示例。
- `npm pack` 文件清单校验。
- 本地全局安装和 `npx` 验证。
- 示例任务和演示脚本。
- 发布前风险清单。

本阶段不包含：

- 正式云端服务。
- 插件市场自动发布。
- 完整 Web dashboard。
- 多租户账号体系。

## 主责角色

- 主责：`rolemux-docs-keeper`
- 协作：`rolemux-cli-builder`
- 审查：`rolemux-reviewer`

## 关键产物

- `src/report/html-report.ts`
- `templates/report.html`
- `README.md`
- `examples/`
- `docs/release/checklist.md`
- `tests/report/html-report.test.ts`

## 退出标准

- mock provider 端到端运行后能生成可读报告。
- README 示例命令可复制执行。
- `npm pack --dry-run` 或等效命令显示包内包含必要文件。
- 全局安装后 `rolemux --help`、`rolemux doctor`、`rolemux run --dry-run` 可运行。
- 发布前限制和已知风险清晰记录。

## 风险

- HTML 报告容易变成重型 UI，M6 只做静态可读报告。
- 发布包文件清单必须避免包含 `.rolemux/tasks/`、本地日志、私有配置和临时文件。
