# Desktop 二级页面 Codex 风格收敛实施计划

_状态：completed | 更新：2026-08-27 | 关联任务：DESK-SHELL-001 | 关联设计：[DESIGN.md](../../DESIGN.md)_

## 1. 目标、成功标准与停止条件

- 目标结果：让 Team、Terminal、Runs、Attention、Changes、Automations 和 Settings 与任务工作区共享同一套任务优先 Desktop 壳层，消除常驻窄操作轨道和重复导航。
- 可验收成功标准：Desktop 同一时间最多出现一列对象侧栏；所有二级页具备来源感知返回和统一上下文工具入口；Team 不再同时展示操作轨道、团队 rail、主内容和常驻系统看板；浏览器 Console 壳层不变。
- 完成后停止条件：四个切片按序完成，相关 Vitest、lint、build、Electron 冒烟、宽窄屏视觉检查、文档校验和差异检查通过，或验证缺口已明确记录。

## 2. 范围与非范围

### 范围

- Agent Console Desktop 壳层、路由返回契约和上下文工具菜单。
- Team 列表、概览、专注、任务图、多列、检查器和操作反馈的信息编排。
- Terminal、Runs、Attention、Changes、Automations 和 Settings 的 Desktop 页面框架。
- 组件回归、路由回归、响应式视觉验证和本地 Electron 包冒烟。

### 非范围

- 不修改 Team、Run、Approval、Git、Terminal 或 Trigger 后端契约与运行语义。
- 不改变浏览器 Console 的全局导航结构。
- 不执行生产发布、签名、公证或外部环境变更。
- 不把二级页面改成营销型卡片页面，也不新增 UI 依赖。

## 3. 当前证据基线

- `ConsoleShell.tsx` 对任务工作区使用 chrome-free shell，但为 Team、Run、Terminal、Attention、Changes、Automations 和 Desktop Settings 额外挂载 `DesktopOperationRail`。
- `TeamPage` 在操作轨道内继续挂载 `TeamRail`、Team header、视图切换和常驻系统看板，形成多层导航。
- Attention 和 Run Detail 已有局部来源返回逻辑，可作为共享返回契约的迁移基础。
- Terminal、Changes 和 Attention 已接近全幅工具页；Run History 和 Automations 仍使用较重的独立页面构图。
- 当前工作树包含语音、设置、Worktree 和既有视觉收敛改动；本计划必须保留这些用户变更。

## 4. 规模判定与用户确认

- 规模：large
- 触发信号：跨壳层与七类页面；四个有序切片；导航、响应式和视觉验收可独立验证。
- 确认状态：approved
- 用户确认时间或消息指针：2026-08-27，用户回复“确认”。
- 用户调整：除 Team 外需同步审计并调整其他 Desktop 二级页面，整体尽量向任务工作区风格靠拢。

| 切片 | 目标结果 | 修改范围 | 依赖 | 验收方式 | 回退点 | 状态 |
|---|---|---|---|---|---|---|
| S1 | 单一 Desktop Shell、上下文工具菜单和来源返回 | `ConsoleShell`、Desktop shell 组件、Workspace header、路由测试 | 无 | Desktop 操作路由无旧 rail；浏览器壳层不变；返回与 deep-link 正确 | 恢复旧 operation shell 分支 | completed |
| S2 | Team 只保留一列团队导航，概览与检查器收敛 | Team list/page/rail/header/overview/inspector/toast 与测试 | S1 | 创建、成员、目标、三视图、专注和实时状态不回归；无多重导航 | 回退 Team 视觉与布局组件 | completed |
| S3 | 操作页统一使用共享壳层和页面头部 | Terminal、Runs、Attention、Changes、Automations 与测试 | S1 | 各页核心交互、来源返回、空态和窄屏通过 | 按页面独立回退 | completed |
| S4 | 设置入口收口并完成整体 QA | Settings、路由矩阵、视觉截图、Electron 包、文档 | S1-S3 | 定向/全量检查、build、Electron smoke、宽窄屏无溢出 | 按前三切片回退 | completed |

## 5. 原则与决策

| 决策 | 选择 | 理由 | 代价 |
|---|---|---|---|
| 全局导航 | 删除常驻 `DesktopOperationRail`，使用工作区顶栏上下文工具菜单 | 避免第二套全局信息架构，与任务优先壳层一致 | 二级页必须提供稳定返回和工具入口 |
| 左侧栏 | 同时最多一列对象侧栏 | 任务、团队、设置都是对象选择；图标 rail 不是对象 | Team 窄屏需要完整抽屉降级 |
| Team 看板 | 系统看板改为按需检查器 | 避免四栏并存，给对话和任务证据留空间 | 聚合状态不再永久可见 |
| 兼容性 | 仅改 UI 编排和前端路由上下文 | 降低运行语义与数据风险 | 不借机重构后端或状态模型 |

## 6. 实施切片

### S1：Desktop 壳层与导航契约

- 状态：completed
- 修改范围：`ConsoleShell`、Desktop shell/header/menu/return helper、Workspace header、壳层与路由测试、`DESIGN.md`。
- 步骤：建立共享 Desktop frame；迁移操作入口；删除页面常驻 rail；统一来源返回 fallback；保留浏览器 Console 分支。
- 切片验收：Workspace 和所有 Desktop 操作路由使用同一壳层规则；旧 rail 不渲染；文件/审批 deep-link 和返回工作区正确。
- 回退点：恢复 `ConsoleShell` 的旧 operation shell 分支和 `DesktopOperationRail` 测试契约。
- 验证证据：`ConsoleShell`、Workspace header、Conversation History、Automation Entry 定向回归 4 文件 / 31 项通过；`npm run lint` 通过。

### S2：Team 收敛

- 状态：completed
- 修改范围：Team list/page/rail/header/overview/inspector/view switch、反馈提示和 Team 页面测试。
- 步骤：团队列表对齐任务侧栏；简化 Team header；系统看板改按需；保持三视图和专注状态；压缩成功反馈尺寸。
- 切片验收：Desktop Team 不出现旧 rail；宽屏只有团队列表和主工作区；窄屏使用抽屉；Team 行为测试通过。
- 回退点：仅恢复 Team 布局组件，不改 API 与查询状态。
- 验证证据：Team 全量 27 项通过，覆盖创建、成员、目标、三视图、专注、任务图、多列、上下文压缩和流式完成；`npm run lint` 通过。

### S3：操作页收敛

- 状态：completed
- 修改范围：Terminal、Run History/Detail、Attention、Changes、Automations 的页面布局和相关测试。
- 步骤：复用统一页面头部与返回；Terminal/Changes 保持全幅工具区；Run/Attention 使用线性扫描布局；Automations 使用列表/详情结构。
- 切片验收：核心行为与 Desktop/Web 降级不变；各路由标题、返回、工具入口和宽窄屏布局一致。
- 回退点：每个业务页可独立恢复旧页面容器。
- 验证证据：Terminal、Runs、Attention、Changes、Automations 与共享壳层扩展定向回归 `14 files / 107 tests` 通过；真实 Electron 路由矩阵确认各页只有一个共享页头、无旧 operation rail、来源返回正确且宽屏无文档级横向溢出。

### S4：设置、回归与视觉 QA

- 状态：completed
- 修改范围：Desktop Settings frame、路由矩阵、Console/Desktop tests、文档与 Electron 本地预览。
- 步骤：设置仅保留设置分类侧栏；运行定向与全量检查；进行宽窄屏和 Electron 截图验证；构建本地包并冒烟。
- 切片验收：设置返回工作区且无旧 rail；lint/build/tests/visual smoke/docs/diff gates达标。
- 回退点：设置框架和各切片均可单独回退，无数据迁移。
- 验证证据：Console 全量 `118 files / 862 tests`、lint、生产 build 与 Desktop type-check 通过；最终未签名 macOS x64 目录包完成，真实 Electron Team 空态与 Terminal 在 1440px/390px 下通过返回链、工具菜单和无溢出检查。

## 7. 偏移控制

- 当前允许修改的切片范围：无，计划已完成并进入证据维护状态。
- 跨切片共享前置修改：共享 Desktop frame、header/menu 和 route context helper。
- 需要重新确认的变化：新增后端契约、改变 Team/Run 数据语义、扩大到 Web Console 全局导航或引入新依赖。
- 不需要重新确认的变化：已确认切片内部的组件拆分、CSS 细节和测试 fixture 调整。

## 8. 契约、迁移与发布

- 兼容策略：Desktop 与 Web 路由保持 URL 兼容；来源信息只接受应用内路径并提供活动工作区 fallback。
- 数据迁移/回填：无。
- 发布顺序：S1 壳层后依次落 Team、操作页、设置与 QA。
- 回滚/恢复：纯前端可逆变更；无数据库、IPC 或服务端迁移。

## 9. 测试与验证矩阵

| 层级 | 场景 | 命令/入口 | 通过条件 |
|---|---|---|---|
| 单元 | 壳层、Team、各操作页、返回路径 | 相关 Vitest 文件 | 定向用例全通过 |
| 静态 | Console 类型与代码质量 | `npm run lint`、`npm run build` | 无新增错误 |
| E2E/冒烟 | Desktop 宽屏、窄屏、真实 Electron 路由 | Browser/Playwright/Electron | 无旧 rail、无溢出、返回可用、无页面错误 |
| 文档 | 计划、设计与任务记录 | `python3 scripts/validate-docs.py`、`git diff --check` | 全部通过 |

## 10. 风险与缓解

| 风险 | 概率/影响 | 早期信号 | 缓解/恢复 |
|---|---|---|---|
| 来源返回在刷新后丢失 | 中/中 | 二级页只能回默认 Agent | allowlist 查询上下文 + 活动工作区 fallback |
| Team 状态因布局切换重置 | 中/高 | 草稿、流式状态或选中成员丢失 | 只移动编排组件，不复制查询与 composer 状态 |
| 小屏多列溢出 | 中/中 | 390px 出现文档级横向滚动 | 侧栏/检查器互斥抽屉与固定容器约束 |
| 既有脏工作树冲突 | 中/高 | 同文件存在语音/设置改动 | 小补丁合并，逐文件复核，不还原用户改动 |

## 11. 文档同步

- [x] `docs/development/ai/task-progress.yaml`
- [x] `omx_wiki/session-2026-08-27-frontend-desktop-shell-convergence.md`
- [x] `omx_wiki/index.md` / `omx_wiki/log.md`
- [x] `DESIGN.md`
- [x] `docs/plans/README.md`

## 12. 完成定义

- [x] 大型计划已获得用户确认并记录切片版本。
- [x] 所有切片验收通过，且过程状态按顺序更新。
- [x] 适用测试、构建和冒烟通过。
- [x] 设计、计划、任务和 Wiki 已同步。
- [x] 最终证据和剩余风险已记录。
