import { Link } from "react-router-dom";
import { MessageSquare, Network, Plus, Settings2, Users } from "lucide-react";

import { useDesktopWorkspaceReturnPath } from "../../../components/desktop/useDesktopWorkspaceReturnPath";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { desktopOperationPath } from "../../../lib/desktop-navigation";
import { cn } from "../../../lib/utils";
import type { Team } from "../../tasks/api";

export function TeamRail({
  teams,
  activeTeamId,
  onCreate,
  desktop = false,
  className,
}: {
  teams: Team[];
  activeTeamId?: string;
  onCreate: () => void;
  desktop?: boolean;
  className?: string;
}) {
  const activeTeams = teams.filter((team) => team.status !== "ARCHIVED");
  const returnTo = useDesktopWorkspaceReturnPath();

  return (
    <aside
      className={cn(
        desktop
          ? "hidden w-[280px] shrink-0 flex-col border-r border-ui-border bg-ui-sidebar lg:flex"
          : "glass-surface hidden w-14 shrink-0 flex-col border-r border-ui-border/70 md:flex xl:w-[152px]",
        className,
      )}
      aria-label="团队侧栏"
    >
      <div className={cn("flex items-center", desktop ? "h-14 px-4" : "h-10 justify-center border-b border-slate-100 px-1.5 xl:justify-between xl:px-2.5")}>
        {desktop ? (
          <>
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-ui-ink font-mono text-xs font-semibold text-white">H</span>
            <span className="ml-2 text-sm font-semibold text-ui-ink">Harness</span>
          </>
        ) : (
          <>
            <div className="flex min-w-0 items-center gap-2">
              <Network className="h-4 w-4 shrink-0 text-slate-700" />
              <span className="hidden truncate text-[13px] font-semibold text-slate-950 xl:inline">团队</span>
            </div>
            <Button variant="ghost" className="h-7 w-7 px-0" onClick={onCreate} aria-label="新团队" title="新团队">
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
      </div>

      {desktop ? (
        <div className="px-3 pb-2">
          <button
            type="button"
            onClick={onCreate}
            className="flex h-9 w-full items-center gap-2 rounded-md border border-ui-border-strong bg-ui-surface px-3 text-sm font-medium text-ui-ink transition-colors hover:bg-ui-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-border-strong"
          >
            <Plus className="h-4 w-4" />
            <span>创建团队</span>
          </button>
          <div className="px-1 pb-1 pt-4 text-xs font-medium text-ui-muted">团队</div>
        </div>
      ) : null}

      <div className={cn("min-h-0 flex-1 overflow-auto", desktop ? "px-3 pb-3" : "px-1.5 py-1.5")}>
        <div className="space-y-0.5">
          {activeTeams.map((team) => {
            const unreadTotal = Object.values(team.unread_counts).reduce((total, count) => total + count, 0);
            const isActive = team.id === activeTeamId;
            return (
              <Link
                key={team.id}
                to={desktop ? desktopOperationPath(`/teams/${team.id}`, returnTo) : `/teams/${team.id}`}
                title={team.name}
                aria-label={team.name}
                className={cn(
                  desktop
                    ? "group flex h-9 min-w-0 items-center gap-2 rounded-md px-2 text-sm transition-colors"
                    : "group flex h-8 min-w-0 items-center justify-center gap-1.5 rounded-md px-1.5 text-[12px] transition-colors xl:justify-start",
                  isActive
                    ? desktop ? "bg-ui-selected text-ui-ink" : "bg-slate-100 text-slate-950"
                    : desktop ? "text-ui-muted hover:bg-ui-subtle hover:text-ui-ink" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950",
                )}
              >
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-md",
                    isActive
                      ? desktop ? "bg-ui-surface text-ui-ink" : "border border-slate-300 bg-white text-slate-900"
                      : desktop ? "text-ui-muted" : "border border-slate-200 bg-slate-50 text-slate-500",
                  )}
                >
                  <Users className="h-3.5 w-3.5" />
                </span>
                <span className={cn("min-w-0 flex-1 truncate font-medium", !desktop && "hidden xl:inline")}>{team.name}</span>
                {unreadTotal > 0 ? (
                  <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-red-600 px-1.5 text-[10px] font-semibold leading-none text-white">
                    {unreadTotal > 99 ? "99+" : unreadTotal}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      </div>

      {desktop ? (
        <nav aria-label="桌面快捷入口" className="border-t border-ui-border p-2">
          <Link
            to={desktopOperationPath("/desktop", returnTo)}
            className="flex h-9 items-center gap-2 rounded-md px-2 text-sm text-ui-muted transition-colors hover:bg-ui-selected hover:text-ui-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-border-strong"
          >
            <Settings2 className="h-4 w-4" />
            <span>设置</span>
          </Link>
        </nav>
      ) : (
        <div className="border-t border-slate-100 px-2 py-2">
          <Button className="h-8 w-full justify-center px-0 text-xs xl:px-3" onClick={onCreate} aria-label="新团队" title="创建团队">
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden xl:inline">创建团队</span>
          </Button>
        </div>
      )}
    </aside>
  );
}

export function TeamRailMobileStrip({
  teams,
  activeTeamId,
  desktop = false,
}: {
  teams: Team[];
  activeTeamId?: string;
  desktop?: boolean;
}) {
  const activeTeams = teams.filter((team) => team.status !== "ARCHIVED");
  const returnTo = useDesktopWorkspaceReturnPath();

  if (activeTeams.length === 0) {
    return null;
  }

  return (
    <div aria-hidden="true" className="glass-surface border-b border-ui-border/70 px-2 py-2 md:hidden">
      <div className="flex gap-1 overflow-x-auto">
        {activeTeams.map((team) => {
          const unreadTotal = Object.values(team.unread_counts).reduce((total, count) => total + count, 0);
          return (
            <Link
              key={team.id}
              to={desktop ? desktopOperationPath(`/teams/${team.id}`, returnTo) : `/teams/${team.id}`}
              className={cn(
                "inline-flex h-8 max-w-48 shrink-0 items-center gap-1.5 rounded-md border px-2 text-xs",
                team.id === activeTeamId
                  ? "border-slate-300 bg-slate-100 text-slate-950"
                  : "border-slate-200 bg-white text-slate-600",
              )}
            >
              <MessageSquare className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{team.name}</span>
              {unreadTotal > 0 ? <Badge tone="warning" className="px-1.5">{unreadTotal}</Badge> : null}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
