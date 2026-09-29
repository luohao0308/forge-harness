import { AlertTriangle, CheckCircle2, Circle, ListTodo, X } from "lucide-react";

import { Badge } from "../../../../components/ui/badge";
import type { Team, TeamAgent, TeamTask } from "../../../tasks/api";

import type { TextFn } from "./types";

export function DesktopTeamStatusPanel({
  team,
  agents,
  tasks,
  text,
  onClose,
}: {
  team: Team;
  agents: TeamAgent[];
  tasks: TeamTask[];
  text: TextFn;
  onClose: () => void;
}) {
  const visibleTasks = tasks.filter((task) => task.status !== "deleted");
  const activeTasks = visibleTasks.filter((task) => task.status === "in_progress");
  const completedTasks = visibleTasks.filter((task) => task.status === "completed");
  const blockedTasks = visibleTasks.filter(
    (task) => task.blocked_by_json.length > 0 && task.status !== "completed",
  );
  const failedAgents = agents.filter((agent) => agent.status === "failed");
  const goal = team.active_goal;
  const goalProgress = goal?.progress_json ?? {};
  const goalCompleted = Number(goalProgress.completed_task_count ?? completedTasks.length);
  const goalTotal = Math.max(
    completedTasks.length + Number(goalProgress.open_task_count ?? visibleTasks.length - completedTasks.length),
    visibleTasks.length,
  );

  return (
    <aside
      role="complementary"
      aria-label={text("团队系统看板", "Team system board")}
      className="absolute inset-y-0 right-0 z-40 flex w-[min(320px,calc(100vw-1rem))] flex-col border-l border-ui-border bg-ui-surface shadow-[-12px_0_32px_rgba(36,36,40,0.08)]"
    >
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-ui-border px-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-ui-ink">
          <ListTodo aria-hidden="true" className="h-4 w-4 text-ui-muted" />
          {text("团队状态", "Team status")}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={text("关闭团队状态", "Close team status")}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-ui-muted hover:bg-ui-subtle hover:text-ui-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-border-strong"
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-4 py-3 text-xs">
        <section className="border-b border-ui-border py-3">
          <div className="text-[11px] text-ui-muted">{text("当前目标", "Current goal")}</div>
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="min-w-0 truncate font-semibold text-ui-ink">
              {goal?.objective || text("未设置", "Not set")}
            </span>
            <span className="shrink-0 tabular-nums text-ui-muted">
              {goalTotal ? `${goalCompleted}/${goalTotal}` : "-"}
            </span>
          </div>
          {goal ? <div className="mt-2 text-ui-muted">{goalStatusLabel(goal.status, text)}</div> : null}
        </section>

        <section className="border-b border-ui-border py-3">
          <div className="text-[11px] text-ui-muted">{text("任务", "Tasks")}</div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-ui-ink">{text("进行中", "In progress")}</span>
            <Badge className="px-1.5 py-0 text-[10px]" tone="running">{activeTasks.length}</Badge>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-ui-ink">{text("已完成", "Completed")}</span>
            <Badge className="px-1.5 py-0 text-[10px]" tone="success">{completedTasks.length}</Badge>
          </div>
        </section>

        <section className="border-b border-ui-border py-3">
          <div className="text-[11px] text-ui-muted">{text("需要关注", "Needs attention")}</div>
          {blockedTasks.length || failedAgents.length ? (
            <div className="mt-2 space-y-2 text-ui-ink">
              <div className="flex items-center gap-2">
                <AlertTriangle aria-hidden="true" className="h-3.5 w-3.5 text-amber-500" />
                {blockedTasks.length} {text("项任务受阻", "blocked tasks")}
              </div>
              <div className="flex items-center gap-2">
                <AlertTriangle aria-hidden="true" className="h-3.5 w-3.5 text-red-500" />
                {failedAgents.length} {text("名成员失败", "failed members")}
              </div>
            </div>
          ) : (
            <div className="mt-2 flex items-center gap-2 text-ui-muted">
              <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5 text-emerald-500" />
              {text("暂无异常", "No issues")}
            </div>
          )}
        </section>

        <section className="py-3">
          <div className="text-[11px] text-ui-muted">{text("状态说明", "Status legend")}</div>
          <div className="mt-2 space-y-2 text-ui-muted">
            <div className="flex items-center gap-2"><Circle aria-hidden="true" className="h-3 w-3 text-blue-500" />{text("执行中 / 待命", "Running / idle")}</div>
            <div className="flex items-center gap-2"><Circle aria-hidden="true" className="h-3 w-3 text-emerald-500" />{text("已完成", "Completed")}</div>
          </div>
        </section>
      </div>
    </aside>
  );
}

function goalStatusLabel(status: string, text: TextFn) {
  if (status === "active") return text("执行中", "Active");
  if (status === "paused") return text("已暂停", "Paused");
  if (status === "completed") return text("已完成", "Completed");
  if (status === "blocked") return text("受阻", "Blocked");
  if (status === "failed") return text("失败", "Failed");
  return status;
}
