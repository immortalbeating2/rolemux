# RoleMux 代码规范与注释约定

更新时间：2026-05-25

## 目标

本规范用于约束 RoleMux 后续 TypeScript CLI、provider adapter、Skill 安装器、任务产物和测试代码。目标是让后续代理或开发者能够快速判断模块职责、输入输出、安全边界和验证方式，而不是通过大量逐行注释猜测代码意图。

## 基础代码规范

- TypeScript 默认启用 `strict`，新代码不得依赖隐式 `any`。
- 运行时目标为 Node.js 20+，优先使用 ESM、显式导入和命名导出。
- 文件按职责拆分，单个源码文件原则上控制在 250 行以内；超过时优先拆出纯函数、类型定义或 adapter 细节。
- CLI 命令层只做参数解析、用户输出和调用 core 服务，不写 provider 参数细节。
- provider adapter 只负责构造可执行文件、参数数组、能力描述和 provider 特定错误映射。
- process runner 统一处理外部进程、超时、stdout/stderr、退出码和错误对象。
- task store 统一处理 `.rolemux/tasks/{task-id}/` 的目录创建、metadata 和产物路径。
- prompt builder 统一处理 role prompt、任务正文、上下文片段和输出格式要求。
- 文件系统写入必须可预测，测试优先使用临时目录或 fixture，不写真实用户项目。
- 外部命令必须优先使用参数数组，不拼接 shell 字符串。
- 运行时依赖必须有明确用途；只为一次性便利引入依赖需要先写明原因和替代方案。

## 类型与接口

- 对外暴露的 command option、provider config、task metadata、run result 必须有显式类型。
- 运行时输入必须通过 schema 或集中校验函数校验，避免在多个命令中重复散落判断。
- 错误对象应包含 `code`、`message`、可选 `details` 和可选 `cause`，不要只抛裸字符串。
- 函数返回值如果会被测试或其他模块消费，必须使用命名类型或清晰的内联结构。
- 不把 CLI 文案字符串当作测试唯一依据；测试优先验证结构化结果、退出码或产物文件。

## 命名约定

- 文件名使用 kebab-case，例如 `process-runner.ts`、`task-store.ts`。
- 类型、接口和类使用 PascalCase，例如 `ProviderAdapter`、`TaskMetadata`。
- 函数、变量和字段使用 camelCase，例如 `buildProviderCommand`、`taskDir`。
- 常量使用 camelCase 或 PascalCase；只有跨模块固定协议值才使用全大写。
- provider 名称使用稳定小写枚举值：`codex`、`claude`、`agy`。
- CLI 参数、JSON 字段、TOML 字段一经进入 spec 或测试，必须视为对外契约，修改时同步文档。

## 注释约定

RoleMux 需要“足够解释意图”的注释，不需要逐行复述代码。注释重点解释为什么这样做、边界是什么、未来修改不能破坏什么。

必须写注释的场景：

- provider adapter 中任何非显而易见的 CLI 参数、版本差异或兼容性分支。
- Windows、WSL、macOS、Linux 路径处理、quoting、换行和可执行文件查找逻辑。
- 安全边界，例如默认不使用危险权限、禁止读取密钥、dry-run 不产生副作用。
- task artifact schema、metadata 字段、文件布局和迁移兼容策略。
- 并发、fallback chain、超时、取消、重试和错误归类逻辑。
- 复杂正则、复杂路径解析、跨模块不变量和临时 workaround。
- Skill 触发规则、安装路径选择和不修改用户 `AGENTS.md` 的原因。

推荐注释形式：

- 导出的函数、类型、类、command handler、provider adapter 写简短 JSDoc。
- 复杂代码块前写 1 到 3 行中文注释，说明意图、约束或风险。
- 对外契约相关注释可引用 `spec/rolemux-development-spec.md` 或本规范中的章节。
- 测试中的注释只解释 fixture 目的、mock 行为或边界条件，不解释断言语法。

避免的注释：

- 不写“给变量赋值”“调用函数”这类逐行翻译。
- 不保留过期 TODO；若确实需要，必须写明原因、负责人或触发条件。
- 不用注释掩盖复杂代码；如果注释比实现更难懂，优先拆函数或重命名。
- 不在注释中记录密钥、真实账号、本地绝对隐私路径或一次性调试输出。

## 文档与代码同步

- 修改 CLI 命令、配置字段、provider 参数、任务产物结构、Skill 触发条件时，同步更新 spec、README 或进度文档。
- 新增模块时，在模块顶部或导出 JSDoc 中说明职责边界。
- 删除或重命名对外字段时，必须更新测试和验收标准。
- 注释和文档发现与代码不一致时，以代码真实行为为准先修正文档，再决定是否改代码。

## 提交前检查

提交前至少完成以下检查：

- `git status --short` 确认改动范围符合当前任务。
- 对文档改动执行文件存在性、关键内容和链接路径检查。
- 对源码改动执行对应的 test、typecheck、lint 或 build。
- 确认没有提交 `.env`、Token、Cookie、账号配置、本地缓存、真实运行任务产物。
- 更新 `docs/progress/status.md`、`docs/progress/timeline.md` 或当日日志中的必要记录。
