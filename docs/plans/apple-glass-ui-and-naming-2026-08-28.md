# Apple Glass UI 与对话/Team 命名实施计划

_状态：completed | 更新：2026-08-28 | 关联任务：TEAM-COMPOSER-001 follow-up | 关联设计：[DESIGN.md](../../DESIGN.md)_

## 1. 目标、成功标准与停止条件

- 目标结果：Forge Harness Console / Desktop 工作台获得克制的 Apple 风格透明毛玻璃层次，首页对话支持改名，Team 支持改团队名和任务名。
- 可验收成功标准：共享 UI 基础组件统一透明度、模糊、边框、阴影和圆角；对话/团队/任务名称可编辑、持久化并有校验；1440px 与 390px 不出现文档级横向溢出；现有行为和审批/实时语义不变。
- 完成后停止条件：S1-S4 均按顺序验证，Console、后端契约、Desktop 打包/启动和文档门禁通过；未签名本地预览的发布边界仍保持明确。

## 2. 范围与非范围

### 范围

- 共享视觉 token、Card/Button/Dialog/Input/Badge、Console/Desktop/Workspace/Team/操作页表层样式。
- Agent Workspace 对话历史和当前会话改名，沿用现有本地持久化。
- Team 名称更新；Team Task subject 更新及 API/OpenAPI/事件审计。
- 响应式截图、Console 回归、后端契约回归、Desktop 目录包和隔离启动验证。

### 非范围

- 不引入新 UI 依赖，不重做业务信息架构，不改变 Team mailbox/wake/task/goal 语义。
- 不把权限模式改造成新的审批引擎，不修改生产安装、签名、公证或外部发布状态。
- 不进行破坏性数据迁移；任务标题使用现有字段的兼容性 PATCH 扩展。

## 3. 当前证据基线

- 代码/配置：`styles.css`、Tailwind token、共享 Card/Button/ConfigDialog/Input 已存在；Team Header/TaskBoard 已有操作菜单和任务展示。
- 命名能力：Workspace store 已有 `renameConversation`，但历史面板未接入入口；Team API 已有 `PATCH /api/teams/{team_id}` 和 `renameTeam`；Team task PATCH 尚未接受 `subject`。
- 测试/CI：Team 页面回归、Console lint/build、后端 Team/runtime 和 Desktop type-check 已有稳定基线。
- Unknown：全局硬编码表层 class 的完整数量需在 S1/S4 扫描后确认；不同页面的视觉截图基线需重新采集。

## 4. 规模判定与用户确认

- 规模：large
- 触发信号：跨 Console/Team/API/桌面包；包含多个独立验收结果；需要顺序实施和多轮验证。
- 确认状态：approved
- 用户确认时间或消息指针：2026-08-28 当前会话用户回复“确认”。
- 用户调整：接受 S1 → S4 原顺序。

| 切片 | 目标结果 | 修改范围 | 依赖 | 验收方式 | 回退点 | 状态 |
|---|---|---|---|---|---|---|
| S1 | 共享 Apple Glass 视觉基础 | token、基础组件、壳层 | 无 | 单测、lint/build、响应式 smoke | 回退共享 token/组件 | completed |
| S2 | 首页对话可改名 | 历史面板、Workspace store、改名交互 | S1 | 持久化/刷新/重启和 UI 回归 | 回退对话改名入口 | completed |
| S3 | Team 与任务可改名 | Team UI、task subject API/OpenAPI、审计 | S1、S2 的交互模式 | API/UI/事件/刷新回归 | 回退 task subject PATCH 和入口 | completed |
| S4 | 全局 rollout 与桌面交付 | Team/Workspace/操作页视觉收口、打包 | S1-S3 | 全量相关测试、截图、Electron smoke | 按页面回退视觉 class | in_progress |

## 5. 原则与决策

| 决策 | 选择 | 理由 | 代价 |
|---|---|---|---|
| 玻璃效果 | 低不透明度 + `backdrop-filter` + 细边框 | 保留 Apple 式层次，同时保证文字和数据可读 | 需要高对比度/不支持 blur 的降级样式 |
| 圆角 | 10–14px 为主，控件不全部做胶囊 | 更圆润但保持工作台密度与可扫描性 | 需要同步较多硬编码 class |
| 对话命名 | 复用现有 store 和 workspace-scoped 持久化 | 不引入新后端实体，避免历史兼容风险 | 只在当前 Desktop/Console workspace 范围内生效 |
| Team 任务命名 | 通过现有 PATCH 增加 `subject` | 保持现有 TeamTask 主键和事件链 | 需同步 API schema、前端类型和测试 |

## 6. 实施切片

### S1：共享 Apple Glass 视觉基础

- 状态：completed
- 修改范围：`apps/agent-console/src/styles.css`、Tailwind 配置、共享 UI 基础组件、主要 Console/Desktop shell。
- 步骤：定义玻璃 surface/border/shadow/radius token；更新 Card/Button/Dialog/Input/Badge；加入 blur 不可用、高对比度、减少动效和窄屏降级。
- 切片验收：共享组件测试、Console lint/build、1440px/390px 无溢出截图。
- 回退点：共享 token 和基础组件 class 可单独回退。

### S2：Workspace 对话改名

- 状态：completed
- 修改范围：ConversationHistoryPanel、AgentWorkspacePage、workspaceStore、conversation history 测试。
- 步骤：增加条目更多菜单或标题编辑入口；接入 store rename；校验空值/长度；补刷新、重启、流式期间回归。
- 切片验收：改名后历史列表、当前标题和持久化快照一致。
- 回退点：移除改名交互和回调即可保留原有会话功能。

### S3：Team 与任务改名

- 状态：completed
- 修改范围：TeamHeader、TeamTaskBoard、TeamPage 状态 mutation、tasks API、`services/api-server/app/api/teams.py`、`TeamService.update_task`、相关测试和 OpenAPI。
- 步骤：Team Header 添加改团队名；任务行添加改标题；后端 subject trim/长度校验、事件审计和响应；保持状态/负责人/依赖字段兼容。
- 切片验收：团队名/任务名即时更新、刷新后保留，错误响应可见，任务运行语义无变化。
- 回退点：保留已有团队 PATCH，单独回退 task subject 扩展和 UI 入口。

### S4：全局 rollout 与桌面交付

- 状态：completed
- 修改范围：Workspace、Team、Runs、Attention、Settings、Terminal、弹层、空状态和 Desktop 预览包。
- 步骤：清理剩余硬编码白底/小圆角/硬阴影；跑全量相关测试和响应式 smoke；构建新的隔离 macOS x64 包并启动。
- 切片验收：主路径视觉一致、文字可读、390px 无溢出、命名流程通过、Electron 进程树和 `harnessd` 健康。
- 回退点：按页面撤销 rollout class，保留已验证的命名 API/状态逻辑。

## 7. 偏移控制

- 当前允许修改的切片范围：S4；S1-S3 已完成验证，继续收口视觉并交付桌面预览。
- 跨切片共享前置修改：视觉 token、命名弹层交互约定和测试 fixtures。
- 需要重新确认的变化：新增依赖、破坏性迁移、Team 数据语义变化、范围/顺序/接口/风险实质变化。
- 不需要重新确认的变化：已确认切片内部的 class、组件拆分和测试实现调整。

## 8. 契约、迁移与发布

- 兼容策略：保留旧 Team PATCH 字段；`subject` 为可选更新字段；旧对话快照无 title 变化时继续按现有 fallback 读取。
- 数据迁移/回填：无数据库迁移；只更新现有 `Team.name` / `TeamTask.subject` 和 workspace-scoped conversation snapshot。
- 发布顺序：先 Console 源码验证，再 Desktop renderer/main/runtime 构建，最后隔离目录包启动。
- 回滚/恢复：按切片回退共享视觉或命名入口；不触碰用户 `/Applications` 安装和现有 profile。

## 9. 测试与验证矩阵

| 层级 | 场景 | 命令/入口 | 通过条件 |
|---|---|---|---|
| 单元 | store/API/schema/组件 | Vitest、pytest | 新增和既有用例通过 |
| 集成/契约 | Team rename、task subject PATCH、事件 | Team API tests、OpenAPI 生成 | 响应、审计和兼容字段正确 |
| E2E/冒烟 | 1440px、390px、改名刷新、Team 操作 | Playwright/Chromium | 无溢出、名称保持、反馈可见 |
| 观测/部署 | Desktop 目录包、harnessd、进程树 | electron-builder、health、ps | 新包启动，旧包不被覆盖 |

## 10. 风险与缓解

| 风险 | 概率/影响 | 早期信号 | 缓解/恢复 |
|---|---|---|---|
| 透明层降低对比度 | 中/中 | 截图或对比度检查失败 | 使用不透明降级、边框和高对比度主题 |
| 全局 class 改动造成布局回归 | 中/高 | 390px 溢出或组件快照失败 | 先共享组件，按页面 rollout，保留回退点 |
| Team task subject 与运行中任务竞争 | 低/高 | PATCH 与 wake/事件时序冲突 | 仅更新 subject/updated_at，保持任务状态机不变 |
| 浏览器不支持 backdrop blur | 中/低 | 渲染层无模糊 | 使用半透明实色 fallback，不依赖 blur 才可读 |

## 11. 文档同步

- [x] `TASKS.md` / 上下文
- [x] `PROJECT-SUMMARY.md`
- [x] 架构/ADR
- [x] 设计/契约/生成物
- [x] Runbook/工作日志

## 12. 完成定义

- [x] 大型计划已获得用户确认并记录切片版本。
- [x] 所有切片验收通过，且过程状态按顺序更新。
- [x] 适用测试、构建、重启和冒烟通过。
- [x] 契约、文档和长期知识已同步。
- [x] 最终证据、产物身份和剩余风险已记录。
