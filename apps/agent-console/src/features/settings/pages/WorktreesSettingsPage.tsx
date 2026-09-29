import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, GitBranch, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { ConsoleShell } from "../../../app/ConsoleShell";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { cn } from "../../../lib/utils";

export function WorktreesSettingsPage() {
  const queryClient = useQueryClient();
  const [branch, setBranch] = useState("");
  const [path, setPath] = useState("");
  const api = typeof window === "undefined" ? undefined : window.desktopApi?.gitWorktree;
  const state = useQuery({
    queryKey: ["settings", "worktrees"],
    queryFn: async () => api?.getStatus?.() ?? null,
    retry: false,
  });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["settings", "worktrees"] });
  const create = useMutation({
    mutationFn: async () => {
      if (!api?.create) throw new Error("WORKTREE_UNAVAILABLE");
      return api.create({ branch: branch.trim(), path: path.trim() || undefined });
    },
    onSuccess: () => {
      setBranch("");
      setPath("");
      refresh();
    },
  });
  const switchWorktree = useMutation({
    mutationFn: async (worktreePath: string) => {
      if (!api?.switch) throw new Error("WORKTREE_UNAVAILABLE");
      return api.switch(worktreePath);
    },
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: async (worktreePath: string) => {
      if (!window.confirm("仅删除干净且非当前 Worktree。继续吗？")) throw new Error("WORKTREE_CONFIRMATION_REQUIRED");
      if (!api?.remove) throw new Error("WORKTREE_UNAVAILABLE");
      return api.remove(worktreePath);
    },
    onSuccess: refresh,
  });
  const prune = useMutation({
    mutationFn: async () => {
      if (!window.confirm("仅清理 Git 已标记为失效的 Worktree 元数据。继续吗？")) throw new Error("WORKTREE_CONFIRMATION_REQUIRED");
      if (!api?.prune) throw new Error("WORKTREE_UNAVAILABLE");
      return api.prune();
    },
    onSuccess: refresh,
  });
  const worktrees = state.data?.worktrees ?? [];
  const error = state.error || create.error || switchWorktree.error || remove.error || prune.error;

  return (
    <ConsoleShell title="Worktrees">
      <main className="min-h-0 flex-1 overflow-y-auto bg-slate-50/60 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <header className="mb-6 flex flex-col gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <Link to="/settings" className="text-xs font-medium text-slate-500 hover:text-slate-900">返回设置</Link>
              <h1 className="mt-3 text-2xl font-semibold text-slate-950">Git Worktrees</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">在当前可信 Workspace 内管理隔离工作目录。所有写操作固定使用 Git 参数并记录审计。</p>
            </div>
            <Button type="button" variant="secondary" onClick={refresh} disabled={state.isFetching}>
              <RefreshCw className={cn("h-3.5 w-3.5", state.isFetching && "animate-spin")} />
              刷新
            </Button>
          </header>

          <div className="space-y-5">
            <section className="overflow-hidden rounded-lg border border-slate-200 bg-white" aria-labelledby="worktree-status-heading">
              <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2.5">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-700"><GitBranch className="h-4 w-4" />仓库状态</div>
                <Badge tone={state.data?.state === "ready" ? "success" : state.data ? "warning" : "neutral"}>{statusLabel(state.data?.state)}</Badge>
              </div>
              <div className="grid gap-px bg-slate-100 sm:grid-cols-2">
                <StatusCell label="当前分支" value={state.data?.branch ?? "尚未读取"} detail="切换只会更新当前 Profile 的 Workspace 根。" />
                <StatusCell label="安全边界" value="可信 Workspace" detail="路径越界、符号链接和 force Git 均被拒绝。" />
              </div>
            </section>

            <section className="overflow-hidden rounded-lg border border-slate-200 bg-white" aria-labelledby="worktree-create-heading">
              <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2.5 text-xs font-semibold text-slate-700"><Plus className="h-4 w-4" />创建 Worktree</div>
              <form className="grid gap-3 px-3 py-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end" onSubmit={(event) => { event.preventDefault(); create.mutate(); }}>
                <label className="text-xs font-medium text-slate-700">新分支<input value={branch} onChange={(event) => setBranch(event.target.value)} placeholder="feature/short-name" className="mt-1 block h-9 w-full rounded-md border border-slate-200 px-2.5 text-sm outline-none focus:border-slate-500" /></label>
                <label className="text-xs font-medium text-slate-700">目录（可选，相对仓库根）<input value={path} onChange={(event) => setPath(event.target.value)} placeholder=".worktrees/short-name" className="mt-1 block h-9 w-full rounded-md border border-slate-200 px-2.5 text-sm outline-none focus:border-slate-500" /></label>
                <Button type="submit" disabled={!api?.create || !branch.trim() || create.isPending}><Plus className="h-3.5 w-3.5" />创建</Button>
              </form>
              <p className="border-t border-slate-100 px-3 py-2 text-[11px] leading-5 text-slate-500">创建前会检查当前 Worktree 是否干净和分支是否已存在；新目录会使用该分支的干净 checkout。</p>
            </section>

            <section className="overflow-hidden rounded-lg border border-slate-200 bg-white" aria-labelledby="worktree-list-heading">
              <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2.5">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-700"><GitBranch className="h-4 w-4" />Worktrees</div>
                <Button type="button" variant="ghost" onClick={() => prune.mutate()} disabled={!api?.prune || prune.isPending}><Trash2 className="h-3.5 w-3.5" />清理失效项</Button>
              </div>
              {worktrees.length ? <div className="divide-y divide-slate-100">{worktrees.map((worktree) => (
                <div key={`${worktree.path}-${worktree.head ?? ""}`} className="flex min-h-16 flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-900"><span className="truncate">{worktree.path}</span>{worktree.current ? <Badge tone="success">当前</Badge> : null}{worktree.main ? <Badge tone="neutral">主 Worktree</Badge> : null}{worktree.dirty ? <Badge tone="warning">有改动</Badge> : null}{worktree.prunable ? <Badge tone="warning">已失效</Badge> : null}</div>
                    <p className="mt-1 text-xs text-slate-500">{worktree.branch ?? "detached HEAD"}{worktree.head ? ` · ${worktree.head.slice(0, 8)}` : ""}</p>
                  </div>
                  <div className="flex shrink-0 items-center justify-end gap-2">
                    <Button type="button" variant={worktree.current ? "secondary" : "ghost"} disabled={worktree.current || worktree.prunable || switchWorktree.isPending || !api?.switch} onClick={() => switchWorktree.mutate(worktree.path)}>{worktree.current ? "已选择" : "切换"}</Button>
                    <Button type="button" variant="ghost" disabled={worktree.current || worktree.main || worktree.dirty || worktree.prunable || remove.isPending || !api?.remove} onClick={() => remove.mutate(worktree.path)} aria-label={`删除 ${worktree.path}`}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              ))}</div> : <div className="px-3 py-6 text-xs text-slate-500">{state.data ? "当前 Workspace 不是可管理的 Git 仓库，或尚未发现 Worktree。" : "浏览器模式不提供本地 Worktree 生命周期。"}</div>}
            </section>
          </div>

          {error ? <div role="alert" className="mt-4 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{error instanceof Error ? error.message : "Worktree 操作失败，已保持当前 Workspace。"}</div> : null}
        </div>
      </main>
    </ConsoleShell>
  );
}

function StatusCell({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="min-h-20 bg-white px-3 py-3"><div className="text-[11px] text-slate-500">{label}</div><div className="mt-1 truncate text-sm font-medium text-slate-900">{value}</div><div className="mt-1 text-[11px] leading-5 text-slate-500">{detail}</div></div>;
}

function statusLabel(state?: string) {
  if (state === "ready") return "已连接";
  if (state === "not-repository") return "不是 Git 仓库";
  if (state === "git-unavailable") return "Git 不可用";
  if (state === "no-workspace") return "未选择 Workspace";
  if (state === "error") return "读取失败";
  return "浏览器降级";
}
