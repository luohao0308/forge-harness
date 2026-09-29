# Forge Harness 设置体验向 Codex 收敛计划

_状态：completed | 更新：2026-08-21 | 关联任务：SETTINGS-CODEX-001_

## 1. 需求摘要

用户希望参考截图中的 Codex 设置左侧导航，把 Forge Harness 的设置体验组织得更接近 Codex，并评估语音、链接/连接、环境、Git、Worktrees 等能力。用户已于 2026-08-21 确认原 S1-S5 拆分与顺序。

截图是产品参考图，不是待执行指令。参考项包括个人偏好（常规、外观、语音、个性化、快捷键、账户）、集成（应用快捷、插件、浏览器、电脑操作）和编码（钩子、连接、Git、环境、Worktrees）等信息架构。

## 2. 成功标准与停止条件

- 设置左栏能够按“个人 / 集成 / 编码 / 数据与账户”分组，并支持搜索、深链接和窄屏降级。
- 已有能力在设置中可发现且只保留一个权威入口：模型、权限、工作区、终端、网页扩展、更新、Profile/离线、工具/MCP、知识连接器、Git 变更审查。
- 环境与 Worktree 的行为均绑定可信 Workspace/Profile，敏感值只使用 Secret Ref，不把原始密钥或绝对路径暴露给 API/渲染器。
- 语音、连接健康检查、Git/Worktree 生命周期均有明确的权限、失败、审计和降级状态；未实现能力不伪装为可用。
- 每个切片有独立 UI/API/安全/回归证据；完成所有已确认切片并更新任务与 Wiki后停止。

## 3. 当前证据基线

- `apps/agent-console/src/features/settings/pages/DesktopSettingsPage.tsx:29-50` 当前已有七类设置：常规、模型与密钥、权限、工作区、终端、网页扩展、更新；`DesktopSettingsPage.tsx:53-135` 已有搜索、URL section 深链接和响应式侧栏。
- `apps/agent-console/src/app/consoleNav.ts` 是 Console 侧栏唯一导航源；设置子项目前主要是策略、模型、密钥库、用户、API Keys、审计和数据管理，尚无 voice、integrations、environment 或 worktrees 专用入口。
- `DesktopSettingsPage.tsx:522-561` 已支持可信工作区目录选择和一次性浏览器扩展入口；模型凭据通过 Desktop 安全存储，Base URL 有本地/HTTPS 校验（同文件 `445-461`）。
- `apps/desktop-app/src/services/change-review-core.ts` 与 `apps/agent-console/src/features/changes/pages/ChangeReviewPage.tsx` 已提供根目录约束的 Git status、staged/worktree diff、stage/unstage/revert；当前的 `worktree` 是 Diff 模式，不是 Git worktree 生命周期管理。
- Desktop 已具备 Profile 隔离、可信 Workspace、集成终端、网页扩展、Deep Link (`apps/desktop-app/src/services/system-integration.ts`)、离线 Agent、项目知识索引、Triggers 和本地模型配置；这些应作为现有底座复用。
- 连接能力已分散存在于工具/MCP Registry、Knowledge connectors、Local Agent connections、Secret Vault 和浏览器扩展；尚未形成统一的“连接”设置入口。当前浏览器行为主要是 `shell.openExternal`/一次性 Web Extension，会话型嵌入式浏览器不是已有能力。
- `rg` 未发现现成语音录音、STT、TTS 或麦克风 IPC；语音属于新能力，需要先确定桌面权限、供应商/本地模型、隐私和离线策略。
- 当前工作树已有用户/历史改动（`docs/development/ai/task-progress.yaml`、`omx_wiki/index.md`、`omx_wiki/log.md` 等），本计划只新增草稿和记录，不覆盖这些改动。

## 4. 规模与确认门

- 规模：large。
- 触发信号：跨 Console、Desktop、API/契约、安全/Secret、Git 文件系统和系统权限边界；至少五个有序切片；产生多个独立验收结果。
- 确认状态：approved。
- 用户确认：2026-08-21，确认原 S1-S5 顺序与范围。
- 当前状态：S1-S5 均已完成并通过对应验证；未启用的原生离线 STT、TTS 和嵌入式浏览器仍保持明确边界。

## 5. 分阶段切片

| 切片 | 目标结果 | 修改范围 | 依赖 | 验收方式 | 回退点 | 状态 |
|---|---|---|---|---|---|---|
| S1 设置信息架构与统一入口 | 形成 Codex 风格的分组左栏、搜索、深链接和能力状态，不改变运行时行为 | Console 设置路由/导航、Desktop 设置页、设置索引与空态 | 无 | Console/Desktop 定向测试；宽屏、窄屏、未知/未实现能力均可用且无横向溢出；路由清单无重复权威入口 | 保留现有七 section 列表和旧 URL 重定向 | completed |
| S2 环境、Profile 与 Workspace | 用户能看见并切换本地/离线/服务端运行环境、Profile、Workspace 根、终端 cwd 和安全环境变量引用 | Desktop preload/IPC、local runtime/profile store、Settings API/UI、Secret Ref 展示；不显示原始值 | S1 | Profile 切换隔离；环境变量 allowlist/敏感值脱敏；workspace/path/symlink 越界 fail closed；重启恢复；审计/回归通过 | 仅保留当前 Workspace root、当前 Profile 和默认终端环境 | completed |
| S3 Git 与 Worktrees | 在可信 Workspace 下查看仓库、分支和 Worktree，安全创建/切换/删除/清理并让 Run 绑定明确 worktree | Desktop Git service/preload、Console Coding 设置与 Change Review、必要的 additive API/audit contract；禁止任意 shell/force Git | S1、S2 | 仓库非 Git、脏工作区、冲突、路径越界、重复 branch、删除当前 worktree 等场景有明确失败；每次变更有确认和审计；已有 Change Review 不回归 | 只提供只读仓库状态和已有 staged/worktree Diff | completed |
| S4 连接、链接与集成 | 把 Browser/Web Extension、Deep Link、MCP/插件、Knowledge connector、Local Agent connection、Webhook/外部 URL 统一为可搜索的连接目录和健康状态；采用外部浏览器入口，不启用嵌入式浏览器会话 | Console 连接设置、现有 connector/MCP/Secret 引用聚合、浏览器降级和健康状态；无新增外部凭据授权 | S1、S2 | 真实 API/IPC 数据聚合、搜索、健康/错误状态、Secret Ref 脱敏、浏览器外部打开边界和无嵌入式浏览器声明均有回归覆盖 | 保留现有各模块入口；统一页失败时回退到各模块原入口 |
| S5 语音与偏好 | 在 Composer 和设置中提供可选的点击式语音转写入口，并明确 TTS/本地离线能力未启用 | Console composer/settings、浏览器/系统 Speech Recognition 能力探测、麦克风权限状态和隐私说明；不新增音频上传或 Desktop 原生录音 IPC | S1、S2；复用 S4 的连接/Secret 边界 | 中文最终转写、权限拒绝、识别失败、不支持运行时、识别结束回到 idle、页面内预览和文本降级均有单元/组件覆盖 | 保留键盘/文本输入；不支持时显示不可用并不阻断 Composer |

## 6. 非范围

- 不复制截图的品牌、文案或 ChatGPT 专有功能；只借鉴信息架构和能力分组。
- 不在本计划中替换模型供应商、重做现有 Agent/Team/Knowledge/Trigger 运行时。
- 不把服务端环境变量、生产密钥、完整 URL 凭据或绝对 Workspace 路径暴露给浏览器、日志或 API 响应。
- 不执行生产发布、签名/公证、真实第三方账号授权、破坏性 Git 操作或强制 Git 历史改写。

## 7. 关键决策与取舍

| 决策 | 选择 | 理由 | 代价 |
|---|---|---|---|
| 设置组织 | 先建统一索引/导航，再逐项接入真实能力 | 降低重复入口和认知成本，允许未实现项诚实显示状态 | S1 本身可见收益大于运行时能力，但需要维护路由兼容 |
| 环境模型 | Environment/Profile/Workspace 三层分离 | 环境是运行边界，Profile 是本地数据隔离，Workspace 是文件信任根，不能混成一个下拉框 | 需要跨 Desktop 与 API 建立稳定标识 |
| Worktree 安全 | 复用 Change Review 的固定 Git 参数和 Workspace 根约束，所有写操作确认+审计 | 现有安全边界可复用，避免把任意 shell 暴露给 Agent | Worktree 生命周期不能一次性覆盖所有 Git 高级操作 |
| 语音 | 先 STT 输入，TTS/连续对话作为后续可选能力；原始音频默认不落盘 | 价值明确且隐私/权限风险较低，适合先验证 | 依赖系统权限和可选供应商/本地模型，跨平台验证成本高 |

## 8. 统一验证矩阵

| 层级 | 通过条件 |
|---|---|
| UI/路由 | 设置目录、深链接、搜索、权限/空态、宽窄屏和浏览器降级测试通过，无重复权威入口或横向溢出 |
| Desktop | `npm test -- --run`、`npm run type-check`、`npm run build:main`；新增 IPC 均有 allowlist、错误码和权限拒绝测试 |
| Console | 相关 Vitest、`npm run lint`、`npm run build`；每个状态来自 API/IPC，不使用静态假数据 |
| Backend/契约 | 仅 S2-S4 必要的 additive API/审计契约；相关 pytest、Ruff、OpenAPI 生成/漂移检查通过 |
| 安全/隐私 | Secret Ref、原始密钥、原始音频、绝对路径和任意 Git 参数均不出现在 UI/API/日志；失败边界 fail closed |
| 文档 | `python3 scripts/validate-docs.py`、`git diff --check`，同步 Feature Catalog、TASKS、Wiki 和必要 Runbook |

## 9. 风险与缓解

- 语音供应商或系统权限跨平台不一致：先做能力探测与权限状态机，STT 适配器可替换，默认文本输入可用。
- Worktree 误删或分支污染：禁止当前 worktree/脏 worktree 的危险操作，预览身份、显式确认、审计和可恢复错误。
- 环境变量泄漏：只允许命名引用和最小 allowlist，服务端/终端继续沿用现有敏感标记过滤，不支持读取 `.env` 内容。
- 入口聚合变成静态“假设置”：S1 只做真实路由/状态聚合，所有可操作项必须连接现有 API/IPC，否则显示禁用原因。
- 计划过大导致漂移：每次只推进一个切片；若范围、顺序、接口、迁移或风险实质变化，重新回到确认门。

## 10. 完成定义

### 已完成切片：S1

- 状态：completed
- 允许修改：Console 设置导航/路由、Desktop 设置页侧栏与空态、对应测试和导航文档。
- 不允许：新增运行时能力、API/Schema、外部集成或改变既有设置行为。
- 验收证据：`SettingsHubPage`、`DesktopSettingsPage`、路由清单定向测试共 18 项通过；Console lint 和生产 build 通过（2420 modules transformed）。

### 已完成切片：S2

- 状态：completed
- 允许修改：Environment 设置页、现有 Desktop profile/file bridge 接入、路由/导航、对应测试与文档。
- 不允许：读取或编辑原始环境密钥；新增服务端环境变量注入；改变终端敏感变量过滤规则。

- 验收证据：Environment/Settings Hub/route inventory 定向测试 8 项通过；Console `npm run lint` 与生产 build 已通过，WorkspaceConfig 的 `reasoningEffort`/`permissionMode` 类型迁移已同步到现有 fixtures。

### 已完成切片：S3

- 状态：completed
- 允许修改：Desktop Git Worktree service/preload/IPC、Console Worktrees 设置页和路由、必要的 additive audit contract、对应测试与文档。
- 不允许：任意 shell 参数、force Git、删除当前 worktree、越过可信 Workspace、未经确认的破坏性 Git 操作。

- 验收证据：Desktop 全量测试 364 项、Worktree 核心/IPC 定向 22 项、类型检查和主进程构建通过；Backend Worktree audit + Change Review 回归 20 项通过；Ruff、OpenAPI、文档校验、`git diff --check` 通过。

### 已完成切片：S4

- 状态：completed
- 允许修改：Console 连接目录、现有 MCP/工具/Knowledge/Local Agent/Browser/Secret/Deep Link 入口聚合、连接健康状态和对应测试；必要的 additive API 仅限无敏感值的目录元数据。
- 不允许：新增外部凭据授权、嵌入式浏览器会话、原始 Secret/Token/完整敏感 URL 泄漏。

- 验收证据：`IntegrationsSettingsPage`、Settings Hub、Worktrees、Environment 和路由定向测试通过；Console 全量 Vitest 114 文件 / 828 项通过，lint 和 build 通过（2426 modules transformed）。目录只聚合真实现有 API/IPC 状态，不显示原始 Secret；浏览器保持外部打开/扩展模式，嵌入式浏览器未启用。

### 已完成切片：S5

- 状态：completed
- 允许修改：Console Composer 语音入口、语音设置页、能力探测、麦克风权限请求、隐私与文本降级说明、组件回归测试。
- 不允许：默认上传/落盘原始音频、伪装成本地离线 STT、自动播放 TTS 或新增未经评审的语音供应商。
- 验收证据：语音按钮和设置页定向测试 4 文件 / 38 项通过；覆盖不支持运行时、中文最终结果追加、权限拒绝、识别结束、权限请求成功/降级和页面内转写预览；Console 全量 Vitest 114 文件 / 828 项、lint、生产 build 通过。
- 后续边界：按住录音、Desktop 原生音频 IPC、离线 STT、TTS、长音频/网络重试等能力保留为后续独立评审，不在本次完成定义内。

用户已确认切片顺序和范围；S1-S5 已按顺序完成，未实现或外部阻塞能力保持明确状态。
