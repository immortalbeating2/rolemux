# M0 阶段开发文档：项目初始化

状态：待执行

## 目标

建立 RoleMux 的 TypeScript CLI 工程基线，使后续命令、provider adapter、任务产物和 Skill 安装器都有可测试、可打包、可提交的基础设施。

## 范围

本阶段包含：

- 初始化 `package.json`、TypeScript、Vitest、tsup、lint/typecheck 脚本。
- 创建 `src/cli.ts`、`src/index.ts` 和基础目录。
- 建立 `tests/`、fixture 目录和最小 smoke test。
- 创建 README 初稿，说明项目定位和本地开发命令。
- 保持现有 `spec/`、`docs/progress/`、`.codex/agents/` 文档入口可追踪。

本阶段不包含：

- 真实 provider 调用。
- 完整 `install`、`doctor`、`run` 行为。
- Skill 文件安装。
- npm 发布。

## 主责角色

- 主责：`rolemux-cli-builder`
- 协作：`rolemux-docs-keeper`
- 审查：`rolemux-reviewer`

## 关键产物

- `package.json`
- `tsconfig.json`
- `vitest.config.ts`
- `tsup.config.ts`
- `src/cli.ts`
- `src/index.ts`
- `tests/cli-smoke.test.ts`
- `README.md`

## 退出标准

- `npm install` 可安装依赖。
- `npm run typecheck` 可运行并通过。
- `npm test` 可运行并通过。
- `npm run build` 可输出 `dist/`。
- `node dist/cli.js --help` 或等效入口能显示基础帮助。
- 状态、时间线和当日日志已记录 M0 结果。

## 风险

- Node.js 与包管理器版本差异会影响 lockfile 策略，M0 应明确是否提交 lockfile。
- Windows PowerShell 下 bin 入口和 shebang 行为需要在后续 M1/M6 再次验证。
