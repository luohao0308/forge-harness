# Codex 风格消息对话框与工作区上下文计划

_状态：completed | 更新：2026-08-21 | 关联任务：DESK-007 | 关联设计：[Codex Desktop Task Workspace](../../omx_wiki/session-2026-08-07-desktop-codex-task-workspace.md)_

## 1. 目标、成功标准与停止条件

- 目标结果：把 Agent Workspace 的消息输入区收敛为 Codex 风格的紧凑工作台输入框，并在同一交互层提供模型、推理强度、权限批准、Git 分支和项目文件夹上下文。
- 成功标准：
  - 输入框底部显示当前模型、当前推理强度、当前权限模式；模型菜单能切换模型，强度滑块能改变本次请求的规范化 `reasoning_effort`。
  - 权限菜单至少提供“请求批准 / 编辑自动批准 / 完全自动”三档，默认安全档；待审批数量和进入审批详情的动作可见。
  - Electron 桌面端显示项目文件夹名、原生工作区状态和 Git 分支（含 ahead/behind）；非 Git、无工作区、桥接不可用时显示明确降级状态，不伪造信息。
  - 选择项按工作区持久化，刷新/切换会话后恢复；请求、Run/Tool 审计和本地 Agent bridge 使用同一组选择值。
  - 390px 窄屏、键盘导航、屏幕阅读器和浏览器降级均无横向溢出或失焦。
- 停止条件：上述状态可从真实 store/API/IPC 读写，目标测试、lint、类型检查、构建、桌面/浏览器冒烟和文档校验通过；不再为输入框复制第二套审批、Git 或文件事实源。

## 2. 范围与非范围

### 范围

- `apps/agent-console/src/features/agents/components/ChatComposer.tsx`、`ChatSurface.tsx`、`WorkspaceShellBar.tsx`、`ComposerSettingsPanel`：输入框布局、菜单、状态展示和事件接线。
- `apps/agent-console/src/features/agents/pages/AgentWorkspacePage.tsx`、`useChatStream.ts`、`workspaceStore.ts`、`features/tasks/api.ts`：状态持久化和请求载荷。
- `apps/desktop-app/src/preload-api.ts`、`preload.ts`：仅在现有 `changeReview`/文件桥数据不足时补充只读桥接类型；优先复用现有 IPC。
- `services/api-server/app/api/schemas.py`、Workspace chat/local-agent 请求路径、模型 gateway 适配：校验并传递 `reasoning_effort`/`permission_mode`，写入可审计的请求元数据。
- focused Vitest、后端 Agent/local-agent schema/stream 测试、Desktop preload/Change Review 测试、浏览器/ Electron 冒烟与 docs write-back。

### 非范围

- 不重做 Console 全局视觉系统、Team 页面或设置页；只调整 Workspace 消息输入区和其紧邻的工作区头部。
- 不新增独立 Git 服务或第二套项目目录存储；Git 事实继续来自 `changeReview.getStatus()`，项目目录继续来自受控文件桥/Workspace store。
- 不让“完全自动”绕过服务端策略、工具风险、审批、沙箱或审计；服务端仍可收紧权限。
- 不在不支持 `reasoning_effort` 的供应商上伪造强度效果，也不展示模型隐藏思维内容。

## 3. 当前证据基线

- 输入框当前由 `ChatSurface` 渲染 `ChatComposer`，底部已有模型按钮、上下文环、附件、模式和 `BottomToolsPopover`；`ComposerSettingsPanel` 已有上下文 token 滑块和工具/文件入口（`ChatSurface.tsx:1598-1740`、`1802-1970`）。
- `ModelPicker` 已有 provider/model 菜单，但没有推理强度字段（`ModelPicker.tsx:34-135`）；`workspaceStore` 已按工作区持久化上下文 token 和本地文件根（`workspaceStore.ts:86-96`、`300-325`）。
- Workspace chat 请求目前携带模型、分支、上下文和工具字段，但没有 `reasoning_effort`/`permission_mode`；后端 `AgentChatStreamRequest` 允许未知字段并会忽略它们（`schemas.py:586-651`），因此必须显式扩展契约，不能只在前端加状态。
- 本地 Agent/hao 已有 `confirm`、`auto-edit`、`full-auto` 权限模式和持久审批链（`schemas.py:3050-3053`、`3318-3326`、`agent_local.py`）；Workspace 的 `InspectorDrawer` 已是 ToolApproval 的批准/拒绝/修改权威入口。
- Desktop `changeReview` 已返回 `rootPath`、`repositoryRoot`、`branch`、`upstream`、`ahead`、`behind` 及 Git 状态（`preload-api.ts:25-54`、`preload.ts:325-334`），文件桥已返回受控工作区根目录。
- 当前工作树已有用户改动：`docs/development/ai/task-progress.yaml`、`omx_wiki/index.md`、`omx_wiki/log.md` 以及两个未跟踪 session 文件；计划和实现不得覆盖这些改动。
- Unknown：当前上游各模型是否真正支持统一的 `reasoning_effort` 参数，以及 cloud Workspace 的 permission mode 是否可以放宽现有 ToolRunner 策略；S1 需以 provider capability 和后端策略为准。

## 4. 规模判定与用户确认

- 规模：large
- 触发信号：跨 Console、API、Electron 三个边界；至少四个有序切片；模型、权限、工作区上下文、审批各有独立验收结果。
- 确认状态：approved
- 用户确认时间或消息指针：2026-08-21 用户确认“确认”
- 用户调整：无

大型计划确认前切片：

| 切片 | 目标结果 | 修改范围 | 依赖 | 验收方式 | 回退点 | 状态 |
|---|---|---|---|---|---|---|
| S1 | 统一模型强度/权限状态和请求契约 | `workspaceStore`、前端 API 类型、`useChatStream`、后端 schemas/审计元数据、provider capability | 无 | schema/stream/local-agent focused tests，确认旧请求兼容 | 保留旧字段默认值；不支持参数不发送 | completed |
| S2 | Codex 风格输入框可操作 | `ChatComposer`、`ChatSurface`、`ComposerSettingsPanel`、新强度/权限控件、a11y 测试 | S1 | Workspace Vitest + axe + 390px/桌面浏览器冒烟 | 保留当前 `BottomToolsPopover` 与旧布局开关 | completed |
| S3 | 项目文件夹/Git 分支在工作区头部可见 | `WorkspaceShellBar`、Desktop bridge 状态 hook/类型、Change Review 读取接线 | 现有文件桥；S2 可并行但建议 S2 后接线 | Desktop/browser fallback、Git/no-Git/无目录测试，Electron smoke | 只显示“浏览器模式/未连接”，不显示猜测值 | completed |
| S4 | 权限批准回写与全链路收口 | `InspectorDrawer` 接线、local bridge payload、cloud policy clamp、文档/契约/生成物、全量验证 | S1-S3 | 审批批准/拒绝/待审批恢复，backend+Console+Desktop build/docs gates | 默认回退 `confirm`，禁止 full-auto 绕过服务端策略 | completed |

## 5. 原则与决策

| 决策 | 选择 | 理由 | 代价 |
|---|---|---|---|
| 强度语义 | 规范化 `reasoning_effort: light\|medium\|high\|xhigh\|max`；仅向声明支持的 provider 转发 | UI 与请求语义一致，避免把温度伪装成推理深度 | 需要 provider capability 检查和 unsupported UI 状态 |
| 权限语义 | UI 使用 `confirm\|auto-edit\|full-auto`；cloud 由服务端策略 clamp，local bridge 复用现有权限引擎 | 与已有 hao/local-agent 契约一致，保持 fail-closed | “完全自动”不是无条件放权，需在 UI 明确说明 |
| 工作区上下文 | Git 读取 `changeReview.getStatus()`，目录读取受控 file bridge/store；头部默认显示 basename，详情再显示完整路径 | 复用已有事实源，避免重复 IPC/状态；减少路径泄露 | bridge 不可用时需清晰降级 |
| 交互布局 | 保留当前 `ChatComposer`/`BottomToolsPopover` 边界，增加 Codex 风格 footer 与两个轻量 popover | 变更集中、兼容现有 slash/附件/审批/上下文能力 | 不会一次性重写所有历史 composer 组件 |
| 默认值 | 强度 `high`（或 provider 默认），权限 `confirm` | 与附图和 Harness 安全默认一致 | 首次显示需解释当前模型不支持时的降级 |

## 6. 实施切片

### S1：请求契约与工作区状态基础

- 状态：completed
- 修改范围：`workspaceStore.ts`、`features/tasks/api.ts`、`useChatStream.ts`、`AgentWorkspacePage.tsx`、`services/api-server/app/api/schemas.py` 及请求/审计投影。
- 步骤：
  1. 增加规范化强度和权限模式类型、默认值、每工作区持久化字段与迁移兼容读取。
  2. 将两字段加入 cloud stream、local-agent send/resume、Run/Tool metadata；旧客户端缺省仍为 `high`/`confirm`。
  3. 服务端校验枚举、按 provider capability 决定是否传给 gateway；不支持时返回结构化 unsupported 状态，不改变现有模型调用默认参数。
  4. 对 cloud permission mode 执行服务端 policy clamp；local bridge 继续由已有 `PermissionEngine`/ToolApproval 决定最终执行。
- 切片验收：新旧 payload schema 测试通过；选择值能在 stream/local send 中观察到；不支持参数不会被静默当作生效；旧请求行为不回归。
- 回退点：删除新字段的发送路径即可回到旧请求；保留 store 旧默认值与兼容读取，不需要数据迁移。

### S2：Codex 风格消息输入框

- 状态：completed
- 修改范围：`ChatComposer.tsx`、`ChatSurface.tsx`、`ComposerSettingsPanel`、`ModelPicker.tsx`，新增纯展示的强度滑块和权限菜单组件及 focused tests。
- 步骤：
  1. 将 footer 固定成左侧附件/权限状态，中部上下文/审批摘要，右侧模型名称 + 强度值 + 发送/停止按钮；保持稳定高度、可换行和 390px 适配。
  2. 模型菜单保留现有 provider/model 选择，在同一面板增加五档强度滑块/键盘步进、当前值和 unsupported 提示。
  3. 权限菜单展示“请求批准 / 编辑自动批准 / 完全自动”解释、当前待审批数和打开审批详情动作；切换后立即持久化但不能直接批准已有高风险操作。
  4. 保留附件、slash command、计划/目标模式、上下文压缩、流式停止和现有 focus trap；所有图标按钮补齐 aria-label/tooltip。
- 切片验收：模型选择、强度滑块、权限菜单、附件和发送流程均可键盘操作；axe 无违规；既有 `ChatSurface.shell.test.tsx` 不回归；宽/窄屏无横向溢出。
- 回退点：通过保留旧 `BottomToolsPopover` 的触发和内容结构，可回退到现有 footer，不影响请求契约。

### S3：项目文件夹与 Git 分支上下文

- 状态：completed
- 修改范围：`WorkspaceShellBar.tsx`、`ChatSurface.tsx` 的只读状态接线，必要时 `preload-api.ts`/`preload.ts` 类型；不新增后端 Git endpoint。
- 步骤：
  1. 在 Desktop mount/工作区切换/目录变更后读取 `desktopApi.changeReview.getStatus()`，与 `file.getWorkspaceRoot()` 对齐 root path。
  2. 头部显示文件夹 icon + 项目 basename、`本地`/`浏览器模式`状态、Git branch；Git 状态可展开显示 upstream/ahead/behind 和未提交文件数量。
  3. 处理 `no-workspace`、`not-repository`、`git-unavailable`、`error` 和 preload 缺失；浏览器不调用本地 API，不显示虚假 branch。
  4. 复用现有 `/changes` 的状态类型和审计边界，完整路径仅在明确展开/辅助文本中显示。
- 切片验收：真实 Git 仓库、非仓库、无目录、桥接失败、浏览器 fallback 五类状态都有可读文本；目录/分支刷新不影响对话草稿和流式状态。
- 回退点：隐藏新增上下文行即可恢复旧头部；现有 `/changes` 和文件面板继续独立工作。

### S4：审批回写、文档与全链路验证

- 状态：completed
- 修改范围：`InspectorDrawer.tsx`、local bridge payload/恢复路径、OpenAPI/契约文档、测试与 wiki write-back。
- 步骤：
  1. 让输入框权限入口只导航/打开现有 `InspectorDrawer`/`/attention` 权威审批；批准、拒绝、修改后刷新 pending count 和会话状态。
  2. 验证 local `confirm`/`auto-edit`/`full-auto` 与现有 approval resume、取消、过期、冲突路径；cloud 端验证策略拒绝仍 fail closed。
  3. 更新 API schema/OpenAPI（必要时运行 `python3 scripts/generate-api-docs.py`）、设计/计划索引和本次 wiki 会话证据。
  4. 执行 focused、全量适用测试、lint/type/build、Electron/browser smoke、docs/diff/secret 检查。
- 切片验收：审批状态在输入框、Inspector、Run/Tool 审计一致；全量适用门禁通过；没有真实 token、完整路径或响应体写入日志/文档。
- 回退点：权限入口退回 `/attention`/Inspector 现有链接；新字段仍按 `confirm` 默认解析，旧客户端可继续运行。

## 7. 偏移控制

- 当前允许修改的切片范围：用户确认后一次只推进一个切片；确认前不修改产品代码、契约、OpenAPI 或外部状态。
- 跨切片共享前置修改：类型/默认值和测试 fixture可由 S1 提供，S2-S4 不复制定义。
- 需要重新确认的变化：新增数据库迁移、改变 cloud 权限语义、引入新的 Git/文件事实源、改变默认安全档、扩展到 Team/移动端或需要真实凭据。
- 不需要重新确认的变化：组件拆分、CSS 间距、icon 选择、测试 fixture 和不改变契约的文案调整。

## 8. 契约、迁移与发布

- 兼容策略：所有新字段可选；旧请求默认 `reasoning_effort=high`、`permission_mode=confirm`；provider 不支持时不发送该参数并返回可解释 capability 状态。
- 数据迁移/回填：不新增数据库列；Workspace 选择值走已有 renderer/profile persistence，未知值按默认值修正。
- 发布顺序：S1 契约/状态 -> S2 UI -> S3 Desktop 状态 -> S4 审批/文档/验证；默认一个分支、一个 PR。
- 回滚/恢复：删除新 UI 接线即可回退；服务端仍接受旧 payload；full-auto 永不绕过服务端 policy。

## 9. 测试与验证矩阵

| 层级 | 场景 | 命令/入口 | 通过条件 |
|---|---|---|---|
| 单元 | 强度/权限枚举、默认值、provider unsupported、状态派生 | `cd apps/agent-console && npx vitest run src/features/agents/...`；后端 schema/agent tests | 枚举边界、旧 payload、fallback 全通过 |
| 组件/a11y | 模型菜单、滑块键盘步进、权限菜单、focus trap、附件/发送 | `cd apps/agent-console && npx vitest run src/features/agents/__tests__/ChatSurface.shell.test.tsx src/features/agents/__tests__/agent-chat.a11y.test.tsx ...` | axe 0 violation；关键按钮/slider 可定位和操作 |
| 集成/契约 | cloud stream/local bridge 携带选择值；审批批准/拒绝/恢复 | `cd services/api-server && .venv/bin/python -m pytest tests/test_agents.py tests/test_local_agents.py tests/test_tool_approvals.py` | 审计 metadata 与最终策略决定一致 |
| Desktop | changeReview 状态、无 Git/无根目录/桥接失败、preload 类型 | `cd apps/desktop-app && npm test -- src/__tests__/preload-extended.test.ts src/__tests__/change-review-service.test.ts` | native 状态可读，桥接失败不崩溃 |
| E2E/冒烟 | Desktop/browser Workspace 宽窄屏、真实目录/Git 分支、审批入口 | 现有 Agent Workspace Playwright/Electron smoke 入口 | 390px 无溢出；folder/branch/permission/model 可见且可交互 |
| 质量门禁 | lint/type/build/docs/diff | `npm run lint`、`npm run build`、Desktop `npm run type-check`/`build:main`、`python3 scripts/validate-docs.py`、`git diff --check` | 全部通过；无敏感信息泄露 |

## 10. 风险与缓解

| 风险 | 概率/影响 | 早期信号 | 缓解/恢复 |
|---|---|---|---|
| provider 不支持统一强度参数 | 中/高 | capability 缺失或 gateway 拒绝未知参数 | capability-gated 发送；UI 显示不支持，保留默认模型行为 |
| full-auto 被误解为绕过 Harness 审批 | 中/高 | cloud Run 未生成 approval 或越过 ToolRunner | 服务端 clamp + policy/audit 测试；默认 confirm；UI 写明“仍受服务端策略约束” |
| Git/目录读取滞后或泄露完整路径 | 中/中 | 分支与当前仓库不一致、日志出现绝对路径 | 只读刷新、状态时间戳、basename 默认展示、错误信息脱敏 |
| Composer 改造破坏现有 slash/附件/流式状态 | 中/高 | focused tests 失败、Enter/Shift+Enter 回归 | 先锁定现有测试；保留当前 `BottomToolsPopover` 和 props；逐切片验证 |
| 浏览器无 `window.desktopApi` | 高/中 | 页面初始化异常或空白 | 明确 browser fallback，不访问 preload API，不阻塞消息输入 |

## 11. 文档同步

- [x] 确认后将本草案复制到 `docs/plans/desktop-codex-composer-2026-08-21.md` 并标记 `completed`。
- [x] `docs/TASKS.md`：保留现有任务指针并同步当前切片状态。
- [x] `docs/development/ai/task-progress.yaml`：完成后写验证命令、结果和剩余风险。
- [x] `omx_wiki/`：新增本次 session/handoff 证据，并更新 `index.md`、`log.md`。
- [x] API schema/OpenAPI 已包含实际新增的请求字段。

## 12. 完成定义

- [x] 用户确认了切片版本；计划从 `awaiting_user_confirmation` 变为 `approved`。
- [x] S1-S4 按顺序完成，任一时刻只有一个 `in_progress`。
- [x] 适用测试、lint、类型检查、浏览器 smoke、docs/diff 门禁通过；Electron 打包未在本切片重复执行。
- [x] 模型强度、权限批准、Git 分支、项目文件夹均来自真实状态并有降级路径。
- [x] 契约、文档和长期知识同步；保留用户已有改动；没有敏感信息泄露。
