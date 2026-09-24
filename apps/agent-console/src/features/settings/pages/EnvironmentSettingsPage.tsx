import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, CircleAlert, FolderOpen, Globe2, RefreshCw, ShieldCheck, Terminal } from "lucide-react";
import { Link } from "react-router-dom";

import { ConsoleShell } from "../../../app/ConsoleShell";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { isLocalRuntimeProfile } from "../../../lib/local-runtime";
import { cn } from "../../../lib/utils";

type EnvironmentBridgeState = {
  profiles: DesktopProfile[];
  activeProfileId: string;
  rootPath: string | null;
  watching: boolean;
};

const SAFE_ENVIRONMENT_KEYS = ["PATH", "HOME", "LANG", "LOGNAME", "SHELL", "TERM", "USER", "COLORTERM", "LC_*"];

export function EnvironmentSettingsPage() {
  const queryClient = useQueryClient();
  const desktopApi = typeof window === "undefined" ? undefined : window.desktopApi;
  const state = useQuery({
    queryKey: ["settings", "environment", "bridge"],
    queryFn: async (): Promise<EnvironmentBridgeState | null> => {
      if (!desktopApi) return null;
      const [profiles, root] = await Promise.all([
        desktopApi.profile?.list?.(),
        desktopApi.file?.getWorkspaceRoot?.(),
      ]);
      return {
        profiles: profiles?.profiles ?? [],
        activeProfileId: profiles?.activeProfileId ?? "",
        rootPath: root?.rootPath ?? null,
        watching: Boolean(root?.watching),
      };
    },
    retry: false,
  });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["settings", "environment", "bridge"] });
  const switchProfile = useMutation({
    mutationFn: async (profileId: string) => {
      if (!desktopApi?.profile?.switch) throw new Error("PROFILE_SWITCH_UNAVAILABLE");
      return desktopApi.profile.switch(profileId);
    },
    onSuccess: refresh,
  });
  const selectWorkspace = useMutation({
    mutationFn: async () => {
      if (!desktopApi?.file?.selectWorkspaceRoot) throw new Error("WORKSPACE_SELECTOR_UNAVAILABLE");
      return desktopApi.file.selectWorkspaceRoot();
    },
    onSuccess: refresh,
  });
  const bridgeState = state.data;
  const runtime = runtimeLabel(desktopApi);
  const activeProfile = bridgeState?.profiles.find((profile) => profile.id === bridgeState.activeProfileId);

  return (
    <ConsoleShell title="环境">
      <main className="min-h-0 flex-1 overflow-y-auto bg-slate-50/60 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <header className="mb-6 flex flex-col gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <Link to="/settings" className="text-xs font-medium text-slate-500 hover:text-slate-900">返回设置</Link>
              <h1 className="mt-3 text-2xl font-semibold text-slate-950">环境</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">管理运行边界、Profile 和可信 Workspace。环境变量只暴露经过过滤的元数据。</p>
            </div>
            <Button type="button" variant="secondary" onClick={refresh} disabled={state.isFetching}>
              <RefreshCw className={cn("h-3.5 w-3.5", state.isFetching && "animate-spin")} />
              刷新
            </Button>
          </header>

          <div className="space-y-5">
            <section className="overflow-hidden rounded-lg border border-slate-200 bg-white" aria-labelledby="runtime-environment-heading">
              <SectionHeading id="runtime-environment-heading" icon={<Globe2 className="h-4 w-4" />} title="运行环境" />
              <div className="grid gap-px bg-slate-100 sm:grid-cols-3">
                <StatusCell label="当前运行时" value={runtime} detail={runtimeDetail(desktopApi)} />
                <StatusCell label="Profile" value={activeProfile?.label ?? (desktopApi ? "尚未读取" : "由服务端会话管理")} detail={activeProfile ? "当前会话使用此 Profile" : "浏览器不会读取本地 Profile"} />
                <StatusCell label="执行模式" value={isLocalRuntimeProfile() ? "本地配置" : "组织服务"} detail={isLocalRuntimeProfile() ? "请求走本地运行时边界" : "请求遵循组织策略和审计"} />
              </div>
            </section>

            <section className="overflow-hidden rounded-lg border border-slate-200 bg-white" aria-labelledby="profiles-heading">
              <SectionHeading id="profiles-heading" icon={<ShieldCheck className="h-4 w-4" />} title="Profile 隔离" />
              <div className="divide-y divide-slate-100">
                {bridgeState?.profiles.length ? bridgeState.profiles.map((profile) => {
                  const active = profile.id === bridgeState.activeProfileId;
                  return (
                    <div key={profile.id} className="flex min-h-16 flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                          {active ? <Check className="h-4 w-4 text-emerald-600" aria-hidden="true" /> : null}
                          <span className="truncate">{profile.label}</span>
                          {active ? <Badge tone="success">当前</Badge> : null}
                        </div>
                        <p className="mt-1 text-xs text-slate-500">凭据和 Workspace 根与此 Profile 隔离。</p>
                      </div>
                      <Button type="button" variant={active ? "secondary" : "ghost"} disabled={active || switchProfile.isPending || !desktopApi?.profile?.switch} onClick={() => switchProfile.mutate(profile.id)}>
                        {active ? "已选择" : "切换"}
                      </Button>
                    </div>
                  );
                }) : (
                  <EmptyState text={desktopApi ? "尚未读取 Profile 状态" : "浏览器模式不提供本地 Profile 切换"} />
                )}
              </div>
            </section>

            <section className="overflow-hidden rounded-lg border border-slate-200 bg-white" aria-labelledby="workspace-environment-heading">
              <SectionHeading id="workspace-environment-heading" icon={<FolderOpen className="h-4 w-4" />} title="可信 Workspace" />
              <div className="divide-y divide-slate-100">
                <SettingRow title="根目录" description={bridgeState?.rootPath ? `已授权目录：${workspaceLabel(bridgeState.rootPath)}` : "尚未选择本地目录。选择后文件、项目知识和本地工具会使用同一信任根。"}>
                  <Button type="button" disabled={!desktopApi?.file?.selectWorkspaceRoot || selectWorkspace.isPending} onClick={() => selectWorkspace.mutate()}>
                    <FolderOpen className="h-3.5 w-3.5" />
                    选择目录
                  </Button>
                </SettingRow>
                <SettingRow title="文件监听" description={bridgeState?.watching ? "当前 Workspace 正在监听变化。" : "文件监听由 Desktop Profile 控制，浏览器模式保持只读。"}>
                  <Badge tone={bridgeState?.watching ? "success" : "neutral"}>{bridgeState?.watching ? "已启用" : "未启用"}</Badge>
                </SettingRow>
              </div>
            </section>

            <section className="overflow-hidden rounded-lg border border-slate-200 bg-white" aria-labelledby="terminal-environment-heading">
              <SectionHeading id="terminal-environment-heading" icon={<Terminal className="h-4 w-4" />} title="终端环境" />
              <div className="divide-y divide-slate-100">
                <SettingRow title="默认工作目录" description="PTY 会话使用当前受控 Workspace 根；服务端顺序为 HARNESS_TERMINAL_CWD、HARNESS_WORKSPACE_ROOT 和安全默认目录。">
                  <Badge tone={bridgeState?.rootPath ? "success" : "warning"}>{bridgeState?.rootPath ? "跟随 Workspace" : "使用安全默认值"}</Badge>
                </SettingRow>
                <SettingRow title="允许的基础变量" description="PATH、HOME、LANG、LOGNAME、SHELL、TERM、USER、COLORTERM 和 LC_*；包含密钥、Token、密码和认证标记的变量会被过滤。">
                  <span className="max-w-[28rem] text-right text-[11px] leading-5 text-slate-500">{SAFE_ENVIRONMENT_KEYS.join(" · ")}</span>
                </SettingRow>
              </div>
            </section>
          </div>

          {state.isError ? <div role="alert" className="mt-4 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />无法读取当前 Desktop 环境状态，已保留浏览器安全降级。</div> : null}
        </div>
      </main>
    </ConsoleShell>
  );
}

function SectionHeading({ id, icon, title }: { id: string; icon: React.ReactNode; title: string }) {
  return <div id={id} className="flex items-center gap-2 border-b border-slate-100 px-3 py-2.5 text-xs font-semibold text-slate-700">{icon}{title}</div>;
}

function StatusCell({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="min-h-20 bg-white px-3 py-3"><div className="text-[11px] text-slate-500">{label}</div><div className="mt-1 truncate text-sm font-medium text-slate-900">{value}</div><div className="mt-1 text-[11px] leading-5 text-slate-500">{detail}</div></div>;
}

function SettingRow({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <div className="flex min-h-16 flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><div className="text-sm font-medium text-slate-900">{title}</div><div className="mt-1 text-xs leading-5 text-slate-500">{description}</div></div><div className="flex shrink-0 items-center justify-end">{children}</div></div>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="px-3 py-5 text-xs text-slate-500">{text}</div>;
}

function runtimeLabel(desktopApi: Window["desktopApi"] | undefined) {
  if (desktopApi) return "Desktop 本地运行时";
  if (isLocalRuntimeProfile()) return "本地 Web 运行时";
  return "服务端环境";
}

function runtimeDetail(desktopApi: Window["desktopApi"] | undefined) {
  if (desktopApi) return "Electron bridge 可用";
  if (isLocalRuntimeProfile()) return "浏览器安全降级";
  return "组织 API 与审计策略";
}

function workspaceLabel(rootPath: string) {
  const normalized = rootPath.replace(/[\\/]+$/, "");
  return normalized.split(/[\\/]/).filter(Boolean).pop() || "已选择目录";
}
