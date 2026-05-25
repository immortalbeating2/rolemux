# M0 Project Initialization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 初始化 RoleMux TypeScript CLI 工程基线。

**Architecture:** 建立 Node.js 20+、TypeScript strict、Vitest、tsup 的最小结构；CLI 入口先提供帮助输出，后续命令在 M1 扩展。文档和测试目录从一开始进入版本管理，避免后续大范围搬迁。

**Tech Stack:** TypeScript, Node.js 20+, Commander, Vitest, tsup.

---

## Files

- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `tsup.config.ts`
- Create: `src/cli.ts`
- Create: `src/index.ts`
- Create: `tests/cli-smoke.test.ts`
- Create or modify: `README.md`
- Modify: `docs/progress/status.md`
- Modify: `docs/progress/timeline.md`
- Modify: `docs/progress/logs/YYYY-MM-DD.md`

## Tasks

- [ ] 创建 `package.json`，固定 `type`、`bin`、`scripts`、运行时依赖和开发依赖。
- [ ] 创建 `tsconfig.json`，开启 `strict`、`noUncheckedIndexedAccess`、`moduleResolution` 和 Node 类型支持。
- [ ] 创建 `src/cli.ts`，导出 `createCli()` 和 `main()`，先注册全局帮助与版本。
- [ ] 创建 `src/index.ts`，导出后续命令和 core 模块入口。
- [ ] 创建 Vitest smoke test，验证 CLI 帮助文本包含 `rolemux`。
- [ ] 创建 tsup 配置，输出 `dist/cli.js` 和 declaration。
- [ ] 写 README 初稿，包含定位、本地安装、开发命令和当前阶段限制。
- [ ] 更新三类留痕文档，记录 M0 真实结果。
- [ ] 提交：`git commit -m "feat(M0): 初始化 TypeScript CLI 工程"`

## Validation

```powershell
npm install
npm run typecheck
npm test
npm run build
node .\dist\cli.js --help
git diff --check
```

Expected:

- 所有命令 exit code 为 0。
- `dist/cli.js` 存在。
- 帮助输出包含 `rolemux`。

## Subagent Handoff

- `rolemux-cli-builder` 负责工程文件、CLI 入口和测试。
- `rolemux-docs-keeper` 负责 README 与进度留痕。
- `rolemux-reviewer` 只读审查依赖、脚本、路径和测试缺口。
