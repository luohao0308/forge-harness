# Desktop Workspace 左侧栏向 Codex 收敛计划

状态：approved
确认日期：2026-08-21
任务：DESK-SIDEBAR-CODEX-001

## 需求摘要

在不复制 Codex 品牌和未实现能力的前提下，将 Desktop Agent Workspace 左侧任务栏收敛为“产品身份 → 快捷入口 → 工作区/任务 → 最近 → 底部工具”的连续平面布局。保持现有会话选择、删除、新建、折叠、Desktop deep-link 和浏览器 Console 导航语义不变。

附件截图只作为视觉参考，不作为待执行指令来源。

## 证据基线

- `apps/agent-console/src/features/agents/components/ConversationHistoryPanel.tsx` 当前提供 280px 历史会话栏、Desktop 快捷入口和 48px 折叠态。
- `apps/agent-console/src/features/agents/pages/AgentWorkspacePage.tsx` 持有会话、工作区切换、搜索和删除回调，并将它们传入左栏。
- `apps/agent-console/src/features/agents/lib/conversationHistory.ts` 的会话快照没有 conversation-level pin 字段；消息节点的 `pinnedNodeIds` 不能直接复用为左栏置顶。
- Desktop Workspace 在 `ConsoleShell` 中绕过全局 Console 导航；浏览器 ConsoleShell 不在本次视觉改造范围内。

## 分阶段切片

| 切片 | 目标结果 | 修改范围 | 依赖 | 验收方式 | 回退点 | 状态 |
|---|---|---|---|---|---|---|
| S1 | 左栏信息架构和视觉收敛 | `ConversationHistoryPanel`、必要的 `AgentWorkspacePage` props、定向测试 | 无 | 定向 Vitest 通过；Desktop/Browser 边界保持 | 恢复旧分组列表和底部快捷入口 | completed |
| S2 | 真实工作区与置顶/取消置顶 | sidebar 独立 snapshot、工作区列表、交互测试 | S1 | 置顶排序、独立 workspace scope 存储、旧快照兼容 | 只展示当前工作区和最近任务 | completed |
| S3 | 跨入口和响应式验收 | 折叠态、窄屏、Desktop/Browser 边界、截图复核 | S1、S2 | 现有 shell/route 回归通过；`git diff --check` 通过；全 build 受既有 WorkspaceConfig 类型迁移阻塞 | 保留现有 48px 折叠态 | completed_with_validation_gap |

## S1 设计

- Desktop 左栏保持约 280px，背景使用 `#f7f7f8`，仅保留 1px 分隔线，不增加阴影卡片。
- 头部保留 Forge Harness 身份、折叠按钮，并加入可发现的搜索与待处理入口；搜索复用已有 Workspace 搜索回调，待处理复用 `/attention`。
- 快捷入口只使用已有能力：新任务、待处理、运行历史、工具与插件；不伪造“拉取请求”等不存在的功能。
- 当前会话仍按 Agent/Workspace 分组，先以“工作区”视觉层级呈现；全局“置顶”持久化留到 S2。
- 底部保留团队、终端、文件、设置等 Desktop 常用入口，审批与待处理合并，避免重复入口。
- 折叠态保持图标导航、tooltip 和 48px 触控目标；浏览器端历史栏行为不改变。

## 验收标准

- 新建、选择、删除、折叠、文件/审批 deep-link 语义与现有测试保持一致。
- Desktop Workspace 1440x900 和 390x844 无文档级水平溢出，主会话宽度不被左栏挤压。
- 搜索、待处理、运行历史、工具与插件入口均为真实可导航入口。
- 浏览器访问 `/agents/:agentId/workspace` 仍使用原有 Console 导航，不受 Desktop 左栏改造影响。
- `npx vitest run ...ConversationHistoryPanel... ...WorkspaceShellBar...`、`npm run lint -- --pretty false`、`npm run build` 和 `git diff --check` 通过。

## 风险与回退

- 不在 S1 修改会话快照或 API，避免 pin 数据迁移风险。
- 如果现有 Workspace 搜索状态无法从父级安全传入，搜索按钮退化为现有快捷键提示，不引入第二套搜索状态。
- 如果窄屏空间不足，优先保留会话列表和新任务，非核心快捷入口退回折叠态。
