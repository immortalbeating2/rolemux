# AGENTS.md - RoleMux 项目代理工作指南

## 目的

本文件面向在 RoleMux 项目中工作的智能编码代理、后续开发 session 和协作开发者。

本文件是本项目的项目级约束文件。它只约束 RoleMux 仓库开发过程，不代表 RoleMux 安装后必须修改用户项目的 `AGENTS.md`。RoleMux 产品本身仍以“Skill + runner + role prompts + task artifacts”为核心，默认不要求用户项目引入重型 `AGENTS.md`。

RoleMux 的目标是建设一个轻量多 CLI 工作流插件/工具包，让当前 AI CLI 能按角色调用 `codex`、`claude`、`agy`、`grok` 等其他 AI CLI 协作完成分析、规划、实现、审查和验证任务。

优先做小而准、可验证、可复现、可安装的改动。不要为了“看起来完整”而过早扩张到复杂 dashboard、完整平台化 workflow engine、强 hooks 治理或生产级多租户插件市场。

## 项目快照

- 项目名称：RoleMux
- 项目根目录：`C:\Users\peng8\Desktop\Project\Tool\RoleMux`
- 当前阶段：需求说明、阶段开发文档、阶段实施文档、开发规范、subagent 角色设置已成稿，准备进入正式工程初始化
- 产品北极星：`spec/rolemux-development-spec.md`
- UI 概念图：`spec/assets/rolemux-ui-concept.png`
- 核心定位：npm/npx 可安装的轻量多 CLI 编排工具，以 Skill 作为入口，以 runner 调用 provider，以 role prompt 赋予职责，以任务目录保存产物
- 一期主目标：完成 TypeScript CLI 骨架、安装器、provider adapter、任务产物、Codex/Claude Skill bundle 和基础验证
- 推荐开发环境：Windows PowerShell + Node.js 20+；涉及 Linux/npm 兼容性时可补充 WSL2 验证
- 推荐技术栈：TypeScript、Node.js 20+、Commander 或 Clipanion、execa、zod、TOML parser、Vitest、tsup

## 规则优先级

1. 用户直接要求
2. 本项目 `AGENTS.md`
3. 产品北极星：`spec/rolemux-development-spec.md`
4. 阶段开发文档：`spec/phases/README.md` 与 `spec/phases/m*.md`
5. 阶段实施文档：`spec/implementation/README.md` 与 `spec/implementation/*-plan.md`
6. 进度留痕文档：`docs/progress/status.md`、`docs/progress/timeline.md`、`docs/progress/logs/YYYY-MM-DD.md`
7. 后续新增的架构设计、API/CLI 设计和开发规则文档
8. 通用工程习惯与辅助技能建议

如用户要求、spec 和本文件冲突，以用户要求为准；如实现必须偏离 spec，必须写明偏离原因、影响范围、是否为临时简化，以及后续如何回归。

## 必须遵守的硬约束

以下规则是项目级强制约束。除非用户明确要求改变，否则不得绕开、弱化或默默忽略。

- 未验证不得声称完成；最终汇报必须说明验证命令、验证结果和未验证风险。
- 未更新必要文档的开发不算完成；影响需求范围、CLI 命令、provider 参数、安装路径、Skill 行为、role prompt、任务产物结构、测试口径或发布流程时，必须同步更新相关文档。
- 三个留痕文档必须存在并持续维护：`docs/progress/status.md`、`docs/progress/timeline.md`、`docs/progress/logs/YYYY-MM-DD.md`。
- 大功能开始前必须读取 `spec/rolemux-development-spec.md`，明确目标、成功标准、不做项、文件范围和验证命令。
- 阶段开发必须读取对应 `spec/phases/m*.md` 和 `spec/implementation/*-plan.md`；未满足当前阶段退出标准，不得进入下一阶段。
- RoleMux 产品默认不得要求用户项目修改 `AGENTS.md`；`--with-agents` 只能作为显式可选能力。
- provider adapter 不得散落在 Skill 文档或命令实现里；`codex`、`claude`、`agy`、`grok` 的真实调用必须集中在 adapter 层。
- Windows shell quoting 必须谨慎处理；执行外部命令时优先使用参数数组，不拼接可执行 shell 字符串。
- 默认不使用危险 bypass/sandbox 参数；需要写操作、提权参数或绕过限制时必须由用户明确要求，并在输出中说明风险。
- 不得读取、记录或输出密钥、Token、Cookie、私有凭据、个人账号信息或本地敏感配置。
- 不得为了测试 RoleMux 而对真实用户项目执行不可逆写入；优先用 fixture、临时目录或 dry-run。
- 新增运行时依赖必须写明原因、使用范围和替代方案；重型依赖、外部服务或云资源接入必须先获得用户确认。
- 若需求存在歧义，必须先说明假设、可选解释和取舍；不得默默选择一种会影响范围、安全边界或安装行为的实现。

## 核心文档入口

新 session 和任何大功能都必须从这些文档建立上下文：

- `AGENTS.md`：项目级约束、subagent 设置和工作流门禁。
- `docs/progress/status.md`：当前真实状态入口，顶部必须保持最新。
- `docs/progress/timeline.md`：跨阶段时间线，记录关键日期、里程碑和状态变化。
- `docs/progress/logs/YYYY-MM-DD.md`：当日详细开发日志。
- `spec/rolemux-development-spec.md`：需求、功能、流程图、技术方案、验收标准和测试清单。
- `spec/phases/README.md`：M0-M6 阶段开发文档索引。
- `spec/phases/m0-project-initialization.md`：M0 项目初始化阶段目标、范围、产物和退出标准。
- `spec/phases/m1-cli-skeleton.md`：M1 CLI 骨架阶段目标、范围、产物和退出标准。
- `spec/phases/m2-provider-adapters.md`：M2 provider adapter 阶段目标、范围、产物和退出标准。
- `spec/phases/m3-task-artifacts.md`：M3 任务产物阶段目标、范围、产物和退出标准。
- `spec/phases/m4-skill-bundle.md`：M4 Skill bundle 与默认 roles 阶段目标、范围、产物和退出标准。
- `spec/phases/m5-workflow-commands.md`：M5 工作流命令阶段目标、范围、产物和退出标准。
- `spec/phases/m6-reporting-release.md`：M6 报告与发布准备阶段目标、范围、产物和退出标准。
- `spec/implementation/README.md`：M0-M6 阶段实施文档索引和通用实施门禁。
- `spec/implementation/m0-project-initialization-plan.md`：M0 具体实施任务、文件范围、验证命令和 subagent 交接。
- `spec/implementation/m1-cli-skeleton-plan.md`：M1 具体实施任务、文件范围、验证命令和 subagent 交接。
- `spec/implementation/m2-provider-adapters-plan.md`：M2 具体实施任务、文件范围、验证命令和 subagent 交接。
- `spec/implementation/m3-task-artifacts-plan.md`：M3 具体实施任务、文件范围、验证命令和 subagent 交接。
- `spec/implementation/m4-skill-bundle-plan.md`：M4 具体实施任务、文件范围、验证命令和 subagent 交接。
- `spec/implementation/m5-workflow-commands-plan.md`：M5 具体实施任务、文件范围、验证命令和 subagent 交接。
- `spec/implementation/m6-reporting-release-plan.md`：M6 具体实施任务、文件范围、验证命令和 subagent 交接。
- `spec/assets/rolemux-ui-concept.png`：后续报告 UI/TUI/Web UI 的视觉参考。
- `docs/dev/code-style.md`：代码规范、命名约定、注释约定和提交前检查。
- `.codex/agents/`：RoleMux 项目本地 subagent 角色设置和 prompt 片段。

后续如新增 `README.md`、`docs/architecture/` 或 `tests/fixtures/`，应在本节补充入口。

## 产品北极星

`spec/rolemux-development-spec.md` 是当前范围、业务目标、MVP 边界、技术方案和验收标准的总依据。

关键锚点：

- RoleMux 不是重型 agent 平台，而是轻量多 CLI 调度层。
- Skill 负责让 Codex/Claude 知道何时调用 RoleMux；runner 负责真实 CLI 调用；roles 负责角色提示词；task store 负责留痕。
- MVP 优先完成稳定 CLI、provider adapter、任务产物和 Skill bundle，不先做复杂 dashboard。
- 默认不修改用户项目 `AGENTS.md`。
- 默认不使用危险权限参数。
- 所有运行都必须能 dry-run 或保存可审计产物。

## 交互语言约定

- 面向用户的说明、过程更新、任务拆分、项目文档默认使用中文。
- 代码、目录、命令、API 路径、包名、函数名和字段名使用英文。
- 提交信息使用“中文 + English”。
- CLI、provider、adapter、runner、Skill、role prompt、task store 等术语可保留英文，但文档中首次出现时尽量给出中文解释。

## Agent 行为准则

### 先理解再执行

- 开始编码前先读取 `AGENTS.md`、当前状态、时间线、最近日志和与任务相关的 spec。
- 如果需求存在多种合理解释，先说明理解、假设和取舍。
- 如果任务边界不清，先拆成可验证的小目标。
- 不在没有输入、输出、成功标准和不做项的情况下扩张范围。
- 用户已经给出明确边界时，按边界执行，不借“顺手优化”改变目标。

### 简洁优先

- 优先使用能解决当前阶段问题的最小实现。
- 不为单次使用场景提前抽象。
- 不新增未要求的服务拆分、复杂插件市场、Web 平台或通用 workflow engine。
- 抽象必须服务于真实复杂度，例如 provider adapter、prompt builder、task store、process runner 和 install target。

### 精准修改

- 每一行改动都应能追溯到当前任务。
- 不顺手重构、格式化或删除无关文件。
- 发现无关问题可以记录到后续建议，不混入当前改动。
- 修改 CLI 命令、provider 参数、配置 schema、task artifact、Skill 触发条件或 role prompt 时，必须评估影响范围。

### 目标驱动执行

- 多步骤任务按“步骤 -> 验证”推进。
- 不把“写了代码”当成完成，只有验证证据支持时才算完成。
- 若无法运行目标验证，必须说明原因、替代检查和残余风险。
- 最终汇报优先说明达成内容、验证方式、文件位置和剩余风险。

## 工作流门禁

满足任一条件，按大功能处理：

- 初始化或重构 TypeScript CLI 工程。
- 新增或重做 `install`、`doctor`、`run`、`plan`、`review`、`discuss` 等命令。
- 新增或修改 provider adapter，包括 `codex`、`claude`、`agy`、`grok` 的调用参数。
- 新增或修改配置 schema、task artifact schema、metadata schema。
- 新增或修改 Codex Skill、Claude Skill 或默认 role prompt。
- 引入运行时依赖、打包方式、发布方式或跨平台路径处理。
- 新增并行执行、fallback chain、HTML report、TUI 或 Web UI。
- 任何影响 spec 范围、安全边界、安装行为或后续开发方向的工作。

大功能必须遵循：

1. 设计确认：明确目标、成功标准、不做项和关键取舍。
2. 文档确认或补写：必要时更新总 spec、阶段开发文档、阶段实施文档、README 或开发规则。
3. 实施计划：读取对应 `spec/implementation/*-plan.md`，写明模块边界、文件范围、验证命令和退出条件。
4. 实现。
5. 验证。
6. 更新 `docs/progress/status.md`、`docs/progress/timeline.md` 或当日日志。

即使表面看起来是小改动，只要改变 CLI 对外契约、安装路径、provider 调用、安全默认值、任务产物格式或 Skill 触发行为，也必须升级为大功能流程。

## 默认阶段路线

当前默认按以下路线推进：

1. M0：项目初始化，完成 package、TypeScript、lint/test/build 基础设施。阶段文档：`spec/phases/m0-project-initialization.md`；实施文档：`spec/implementation/m0-project-initialization-plan.md`。
2. M1：CLI 骨架，完成 `install`、`doctor`、`run --dry-run`。阶段文档：`spec/phases/m1-cli-skeleton.md`；实施文档：`spec/implementation/m1-cli-skeleton-plan.md`。
3. M2：Provider MVP，完成 Codex、Claude、Agy、Grok Build 四个 adapter 的真实调用。阶段文档：`spec/phases/m2-provider-adapters.md`；实施文档：`spec/implementation/m2-provider-adapters-plan.md`。
4. M3：任务产物，完成 `.rolemux/tasks/{task-id}` 保存、metadata、日志、输出。阶段文档：`spec/phases/m3-task-artifacts.md`；实施文档：`spec/implementation/m3-task-artifacts-plan.md`。
5. M4：Skill Bundle，完成 Codex Skill、Claude Skill、默认 roles、安装复制逻辑。阶段文档：`spec/phases/m4-skill-bundle.md`；实施文档：`spec/implementation/m4-skill-bundle-plan.md`。
6. M5：工作流命令，完成 `plan`、`review`、`discuss`、并行执行、fallback。阶段文档：`spec/phases/m5-workflow-commands.md`；实施文档：`spec/implementation/m5-workflow-commands-plan.md`。
7. M6：报告与打包，完成 HTML report、npm publish 准备、README、示例。阶段文档：`spec/phases/m6-reporting-release.md`；实施文档：`spec/implementation/m6-reporting-release-plan.md`。

未达到当前阶段退出标准，不进入下一阶段。若发现 provider 参数、跨平台路径、安装路径或 task artifact 结构明显不成立，允许回退到上一阶段修正。

## MVP 边界

MVP 必做：

- `npx rolemux install` 可执行。
- `rolemux doctor` 能检查 `codex`、`claude`、`agy`、`grok`。
- `rolemux run` 能按 provider + role 执行任务或 dry-run。
- 至少支持 Codex、Claude、Antigravity/agy、Grok Build 四类 provider adapter。
- 任务执行产物写入 `.rolemux/tasks/{task-id}/`。
- 产物至少包含 `task.md`、`prompt.md`、`output.md`、`metadata.json`。
- 默认 roles 至少包含 architect、builder、reviewer、frontend-reviewer、summarizer。
- Codex Skill 和 Claude Skill 能按需调用 RoleMux。
- 默认不修改用户项目 `AGENTS.md`。

非 MVP：

- 完整 Web dashboard。
- 生产级工作流平台。
- 云端插件市场。
- 强 hooks 治理。
- 自动接管用户所有开发流程。
- 绕过 CLI 权限、安全限制或认证边界。
- 对所有 AI CLI 一次性全覆盖。

非 MVP 内容只能作为后续版本规划或清晰隔离的扩展点，不得阻塞 MVP 主线。

## 目录与环境约束

正式开发仓库建议形成以下目录：

- `src/`：TypeScript 源码。
- `src/commands/`：CLI 命令入口。
- `src/core/`：配置、任务存储、prompt 拼接、进程运行、日志。
- `src/providers/`：provider adapter。
- `skills/`：Codex/Claude Skill bundle。
- `roles/`：默认 role prompt。
- `templates/`：默认配置模板。
- `spec/`：需求、设计、实施说明和 UI 概念图。
- `docs/progress/`：状态、时间线和开发日志。
- `tests/`：单元、集成、端到端和 fixture。

环境约束：

- Node.js 版本默认 20+。
- 正式进程调用优先使用 `execa` 参数数组。
- Windows PowerShell 是当前主开发入口，路径带空格必须被测试。
- 涉及 Linux/npm 兼容性时，可补充 WSL2 Ubuntu2 验证。
- 新增依赖必须进入依赖文件，并同步 README 或相关环境说明。

## Subagent 设置

默认允许按需启用 subagents 或 multi-agents 并行处理，但主代理始终负责结果整合、最终验证和对用户交付。项目本地角色设置落地在 `.codex/agents/`，其中 `agents.json` 是角色索引，各 `rolemux-*.md` 文件是可复用 prompt 片段。

启用 subagent 前必须确认写入范围可分离，并为每个代理明确文件或模块所有权。不要让多个代理同时改同一 CLI 命令、同一 provider adapter、同一配置 schema、同一 Skill 文件或同一任务产物结构。

### 推荐 subagent 角色

| Agent 名称 | 类型 | 主要职责 | 默认写入范围 |
|---|---|---|---|
| `rolemux-researcher` | read-only | 调研现有 spec、CLI 参数、参考项目和影响范围 | 默认不写文件；必要时只写 `docs/progress/logs/YYYY-MM-DD.md` 的发现摘要 |
| `rolemux-architect` | planning | 设计 CLI 边界、模块接口、任务产物 schema 和安全默认值 | `spec/`、`docs/progress/` |
| `rolemux-cli-builder` | implementation | 实现 CLI 命令、core 模块、provider adapter 和测试 | `src/`、`tests/`、`package.json`、`tsconfig.json` |
| `rolemux-skill-builder` | implementation | 编写 Codex/Claude Skill、role prompt、安装复制逻辑 | `skills/`、`roles/`、`src/commands/install.ts`、`tests/` |
| `rolemux-reviewer` | review | 审查正确性、安全边界、跨平台路径、测试缺口 | 默认只读；若用户明确允许修复，写入范围必须单独指定 |
| `rolemux-docs-keeper` | documentation | 更新状态、时间线、日志、README、验收说明 | `docs/progress/`、`README.md`、`spec/` |

### Subagent 调用规则

- 研究类任务优先派给 `rolemux-researcher`，不让其修改源码。
- 实现类任务按文件所有权拆分，不交叉修改。
- reviewer 默认只读；如果 reviewer 修改文件、格式化文件或提交，主代理必须检查其改动。
- 每个 subagent 的 prompt 必须包含：目标、文件所有权、禁止修改范围、验证命令、返回格式。
- 每个 subagent 返回必须包含：改动摘要、涉及文件、验证结果、未完成项、风险。
- 主代理不得直接信任 subagent 的完成声明，必须自己读取 diff 或文件并运行必要验证。

### 推荐 prompt 模板

```text
你是 RoleMux 项目的 <agent-name>。

目标：
- <具体任务>

项目约束：
- 先遵守 AGENTS.md。
- 产品默认不要求用户项目修改 AGENTS.md。
- 不输出或读取密钥、Token、Cookie。
- 不使用危险 bypass/sandbox 参数，除非用户明确要求。

文件所有权：
- 允许修改：<路径列表>
- 禁止修改：<路径列表>

验证要求：
- 运行：<命令>
- 如无法运行，说明原因和替代检查。

返回格式：
- 改动摘要
- 涉及文件
- 验证结果
- 风险与后续建议
```

## 文档留痕与时间线

所有开发活动都必须留痕。未更新文档的开发不算完成，未记录验证结果的改动不算真正交付。

每次记录至少写明：

- 做了什么
- 为什么做
- 影响了什么
- 验证结果
- 风险或遗留问题
- 下一步建议

三个必须维护的留痕文档：

- `docs/progress/status.md`：当前真实状态入口，顶部必须最新。
- `docs/progress/timeline.md`：跨阶段里程碑、基线变化和关键决策。
- `docs/progress/logs/YYYY-MM-DD.md`：当日详细开发日志。

## 验证约定

未验证不得声称完成。根据改动类型选择最小但有效的验证。

- 文档改动：检查文件存在、关键路径、内部链接和非空状态。
- CLI 命令改动：运行对应命令的 dry-run、help 或 mock 测试。
- provider adapter 改动：用 mock executable 验证 spawn 参数，不直接依赖真实 CLI 成功。
- 安装器改动：在临时目录或 dry-run 中验证目标路径，不覆盖用户已有配置。
- task store 改动：验证目录创建、metadata 写入、错误状态和重复 id。
- Skill 改动：检查触发条件、调用命令、禁止硬编码复杂 provider 规则。
- UI/report 改动：运行构建或截图复核，确保文本不溢出、状态可读。

最终汇报必须包含验证命令和结果。若无法验证，必须明确说明未验证项和风险。

## 代码与提交约定

详细规范见 `docs/dev/code-style.md`。本节是必须遵守的摘要。

- TypeScript 代码优先小模块、显式类型、清晰函数边界和可测试接口。
- TypeScript 默认使用 `strict`；新增对外类型、配置、metadata、run result 必须显式建模。
- 源码文件按职责拆分，原则上单文件控制在 250 行以内；超过时优先拆出纯函数、类型或 adapter 细节。
- 文件名使用 kebab-case；类型使用 PascalCase；函数、变量和字段使用 camelCase；provider 值使用 `codex`、`claude`、`agy`、`grok`。
- CLI 命令层只做参数解析和用户输出，不承载 provider 细节。
- provider adapter 只负责构造命令、参数和 provider 特定能力。
- process runner 统一处理 spawn、超时、stdout/stderr、退出码和错误对象。
- prompt builder 统一拼接 role prompt、任务内容、上下文和输出格式要求。
- task store 统一处理 `.rolemux/tasks/{task-id}/` 目录和 metadata。
- 外部命令必须优先使用参数数组，不拼接 shell 字符串。
- 文件系统写入必须可预测；测试优先使用 fixture、临时目录或 dry-run。
- 默认代码注释使用中文；命令、函数、类型和字段保持英文。
- 导出的函数、类型、类、command handler、provider adapter 必须有简短 JSDoc。
- 注释解释意图、边界、兼容性和风险，不逐行复述代码。
- provider 参数、跨平台路径、安全边界、task artifact schema、并发/fallback/超时、复杂正则或 workaround 必须写注释。
- 过期注释必须随代码修改同步删除或更新；不得保留没有触发条件的 TODO。
- 提交前至少确认改动已验证、相关文档已更新、未提交真实账号、Cookie、Token、私有配置、本地缓存和临时产物。

## Session 接续顺序

新 session 进入项目时，必须按以下顺序读取：

1. `AGENTS.md`
2. `docs/progress/status.md`
3. `docs/progress/timeline.md`
4. 最近一篇 `docs/progress/logs/YYYY-MM-DD.md`
5. `spec/rolemux-development-spec.md`
6. `spec/phases/README.md`
7. `spec/implementation/README.md`
8. 与当前阶段对应的 `spec/phases/m*.md`
9. 与当前阶段对应的 `spec/implementation/*-plan.md`
10. `docs/dev/code-style.md`
11. 与当前任务相关的源码、测试、Skill、role 或配置文件

不要只凭聊天末尾几句直接进入编码。

## 按任务类型继续读取

完成基础接续读取后，必须按任务类型继续读取专题文档和相关代码。若文档不存在，先记录缺口，必要时补写设计或实施计划。

- 产品范围、MVP 边界、验收标准：读取 `spec/rolemux-development-spec.md`。
- 阶段推进、阶段退出标准：读取 `spec/phases/README.md` 和对应 `spec/phases/m*.md`。
- 阶段实现、文件范围、验证命令：读取 `spec/implementation/README.md` 和对应 `spec/implementation/*-plan.md`。
- CLI 命令、参数、帮助信息：读取 `src/cli.ts`、`src/commands/` 和相关测试。
- Provider adapter：读取 `src/providers/`、`src/core/process-runner.ts` 和 provider 测试。
- 配置、task artifact、metadata：读取 `src/core/config.ts`、`src/core/task-store.ts` 和相关测试。
- Skill 与 role prompt：读取 `skills/`、`roles/`、install 命令和 Skill 测试。
- 安装、发布、npm 包：读取 `package.json`、`tsconfig.json`、打包配置和 README。
- 文档整理、进度留痕、演示准备：读取 `docs/progress/status.md`、`docs/progress/timeline.md`、最近日志和 `spec/`。
- 代码规范、注释规范、提交检查：读取 `docs/dev/code-style.md`。
- 子代理、worker、reviewer、多代理协作：读取本文件的 Subagent 设置和 `.codex/agents/`，并为每个代理明确文件所有权。

## 演示收口标准

MVP 或任何对外展示候选版本必须满足：

- 一条命令或清晰命令序列可以安装并运行基础命令。
- README 能让评审者在本地复现核心结果。
- `rolemux doctor` 能展示 provider 检查结果。
- `rolemux run --dry-run` 能展示将要执行的 provider 命令。
- 至少一个 mock provider 测试能完整生成任务产物。
- Skill 调用链路有文档或示例。
- 任务产物包含 prompt、output、metadata 和错误记录。
- 明确列出已知限制和后续版本规划。
