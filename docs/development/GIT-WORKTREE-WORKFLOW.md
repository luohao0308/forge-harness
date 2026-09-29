# Git Worktree 隔离开发流程

_模式：由 `docs/development/README.md` 选择 required / recommended / disabled_
_更新：YYYY-MM-DD_

## 1. 目标

先判断任务是否产生需要共享的 Git 交付，再决定是否创建分支；worktree 只在需要并行或目录隔离时使用。集成时只移动已经验证的提交，不覆盖项目工作树中的其他改动。

```text
确认仓库与基线
→ 判断是否需要共享交付、分支和 worktree
→ 修改与定向验证
→ 必要时重启任务服务并冒烟
→ 精确暂存与提交
→ 同步最新目标分支并重新验证
→ 按 manifest 权限策略 push 并创建/更新 PR
→ 通过 PR、CI 和独立 Review 门禁
→ 按权限策略合并远端 PR
```

## 2. 开始前核验

记录并确认：

```bash
git rev-parse --show-toplevel
git worktree list --porcelain
git branch --show-current
git rev-parse HEAD
git status --short --branch
```

### 分支与 Worktree 决策

分支隔离准备进入 Git 的提交；worktree 是同一仓库额外的工作目录，通常绑定一个分支。二者不决定文件是否应该提交，也不要求每个任务都创建。

| 任务/产物 | Git 处理 | 分支 | Worktree |
|---|---|---|---|
| 本机长期记忆、Agent 上下文、临时计划或会话日志 | 放在 `.dev-workflow/` 或明确的本机目录，由 `info/exclude` 忽略 | 不创建 | 不创建 |
| 临时部署流水、命令输出、环境快照 | 放在受控部署平台/CI artifact/日志系统；不把秘密或动态环境状态写入源码 | 不创建 | 不创建 |
| 团队可复用的开发说明、架构决策、Runbook、部署配置 | 作为共享项目事实纳入 Git；动态值和凭据留在外部系统 | 仅当需要独立提交/PR/评审时创建；小型文档改动可并入同一主题分支 | 默认不用，只有需要隔离时创建 |
| 产品代码、契约、安全、跨模块或其他需要独立评审的改动 | 按项目交付门禁进入 Git | 创建符合项目约定的任务分支 | 若有并行、运行时冲突或主工作树不宜修改，则创建 |
| 只读检查或不产生可交付文件的本地验证 | 不提交 | 不创建 | 不创建 |

- 不要为了遵守“每个任务必须有 worktree”而创建无交付内容的分支。仓库的 `Worktree 模式` 应定义为隔离偏好，而不是分支/提交授权。
- 分支选择看是否需要独立的共享提交和评审，不看文件扩展名；纯文档若是团队权威事实，仍可能需要分支/PR。纯本机资料则不应靠建分支来隔离。
- 若当前工作树有用户改动，不覆盖、不 stash、不顺手提交。只有任务能从干净基线独立进行时，才可从该基线另建 worktree；依赖未提交用户内容时先严格限定编辑范围。
- 只有在已确认的任务目录、仓库、分支和基线明确时才创建 worktree。

大型计划在创建任务 worktree、修改产品代码或创建交付 PR 前，先按 [实施计划](../plans/README.md) 的确认门拆成 `2-6` 个切片并获得用户确认；默认使用一个任务分支和一个 PR，每次只推进一个切片。

- 明确项目工作树、任务工作树、目标分支和基线 HEAD。
- 不复用归属、分支、HEAD 或状态不明确的 worktree。
- 项目工作树存在他人改动时，不 stash、reset、覆盖或顺带提交。
- 新 worktree 只能创建在已验证的任务目录中，不在产品仓库内部嵌套。

示例：

```bash
git worktree add <task-worktree-path> -b <task-branch> <base-ref>
```

## 3. 修改与验证

每组可独立验证的修改后：

1. 运行与改动直接相关的测试、lint、类型、静态或构建检查。
2. 执行 `git diff --check`。
3. 若运行时代码、配置、依赖或启动逻辑变化：
   - 核验任务服务的 PID、启动时间、命令行、工作目录和监听端口；
   - 只停止当前任务拥有的进程；
   - 使用项目已有启动方式重启；
   - 验证端口、进程和至少一个健康/业务冒烟入口。
4. 不按进程名批量结束共享的 Python、Node、Java、容器或其他进程。

## 4. 精确暂存与提交

```bash
git status --short
git diff -- <task-owned-files>
git add -- <task-owned-files>
git diff --cached --check
git diff --cached
git commit -m "<project commit format>"
```

- 禁止使用 `git add .` 和 `git add -A` 暂存范围不明的文件。
- 提交后确认任务工作树干净并记录已验证 SHA。
- push、PR 创建/更新和远端 PR merge 的 mode/actor 以 `.dev-workflow/manifest.json` 的 `gitPolicy` 为准；缺失时按 `manual + user`。
- 持久策略变更固定需要人工确认；一次性授权必须绑定 repo、remote URL、operation、source/target ref、准确 SHA、有效期和使用次数。
- AI 执行远端操作前运行 `python3 scripts/delivery_guard.py check`，最终检查必须带 `--consume`；guard 不允许时停止。
- `forcePushAllowed=false`、`directProtectedBranchPushAllowed=false`；不使用 `git push --force`、`git reset --hard` 或语义不明的 ours/theirs。

## 5. 同步与重新验证

集成前重新读取目标分支 HEAD。目标已前进且任务分支未发布时，可以按项目策略 rebase：

```bash
git rebase <current-target-head>
```

发生冲突时先 `git rebase --abort`，再根据双方语义做明确决定。rebase 改变 SHA 后，重新执行所有适用检查、服务重启和冒烟。

## 6. PR 与集成

- 仅在项目工作树和任务工作树都满足项目的干净状态要求时集成。
- `codex/*` 只用于本地 Agent 临时 worktree，不得直接 push 或作为线上 PR source branch；交付前移动到项目允许的 `feat/*`、`fix/*`、`docs/*` 等分支。
- 本地 merge 不获得远端 push 或 PR merge 权限；线性历史场景先验证祖先关系，再使用 `git merge --ff-only <task-head>`。
- `pullRequestRequired`、`ciRequired`、`independentReviewRequired` 为默认质量门；实现者不得作为唯一审批者，AI review 不计作独立批准。
- 远端 PR merge 前 fail-closed 验证 PR 状态、head/base、准确 SHA、required CI、独立 Review、mergeable 和分支保护；证据缺失、过期或不一致时停止。
- `deleteAllowed=false`；`privilegedOperationsDefault=deny`。删除、发布、部署、迁移/回填、回滚、流量切换、仓库设置、凭据和发布工作流操作都需要目标明确的独立授权。
- 本地 manifest 不能替代远端 branch protection、required checks、CODEOWNERS 和 environment approval。

## 7. 完成条件

- 任务提交来自已核验的任务 worktree。
- 适用检查、重启和冒烟已完成。
- 最终 SHA、验证证据和剩余风险已记录。
- 无任务外文件被暂存或提交。
- 交付状态只记录实际到达的 `committed → pushed → pr_open → ci_passed → review_approved → merged` 阶段，并绑定准确 SHA、PR、CI 和独立 Review 证据。
- 如果本任务创建的临时 worktree/本地分支没有共享交付价值，结束前先确认归属、工作树状态、未跟踪文件和未保存差异；只清理本任务创建且已确认可丢弃的本地资源。任何状态不明、包含用户改动或含有需要保留提交的资源都保留并报告。
- 对已提交并合并的任务，按项目保留策略清理本地 worktree 与已合并分支；远端分支删除不属于本规则，仍需独立授权。
- 集成、push、PR 和 worktree 清理符合项目规则。
