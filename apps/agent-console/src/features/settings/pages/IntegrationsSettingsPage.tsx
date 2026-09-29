import { useQuery } from "@tanstack/react-query";
import { AppWindow, Cable, ExternalLink, Globe2, KeyRound, Link2, PlugZap, RefreshCw, Search, Server, Webhook } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { ConsoleShell } from "../../../app/ConsoleShell";
import { Badge, type BadgeTone } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { cn } from "../../../lib/utils";
import {
  getToolRegistry,
  listAgentKnowledgeSources,
  listAgentTriggers,
  listLocalAgentConnections,
  type KnowledgeSource,
  type LocalAgentConnection,
  type ToolRegistry,
} from "../../tasks/api";

type DirectoryItem = {
  id: string;
  label: string;
  category: string;
  description: string;
  state: "ready" | "configured" | "degraded" | "unavailable";
  detail: string;
  count?: number;
  to?: string;
  icon: typeof Cable;
};

type IntegrationSnapshot = {
  items: DirectoryItem[];
  failures: string[];
};

export function IntegrationsSettingsPage() {
  const [search, setSearch] = useState("");
  const desktopAvailable = typeof window !== "undefined" && Boolean(window.desktopApi);
  const snapshot = useQuery({
    queryKey: ["settings", "integrations", "directory"],
    queryFn: async (): Promise<IntegrationSnapshot> => {
      const [connections, knowledge, tools, triggers] = await Promise.allSettled([
        listLocalAgentConnections(),
        listAgentKnowledgeSources("default"),
        getToolRegistry("default"),
        listAgentTriggers("default"),
      ]);
      const failures: string[] = [];
      const localConnections = settledValue(connections, failures, "本地 Agent");
      const knowledgeSources = settledValue(knowledge, failures, "知识连接");
      const toolRegistry = settledValue(tools, failures, "MCP 与工具");
      const agentTriggers = settledValue(triggers, failures, "Webhook");
      return {
        failures,
        items: [
          {
            id: "browser",
            label: "浏览器与深链接",
            category: "浏览器",
            description: "Web Extension、Harness 深链接和外部浏览器入口。",
            state: desktopAvailable ? "ready" : "configured",
            detail: desktopAvailable ? "Desktop bridge 可用" : "浏览器模式：仅保留外部入口",
            to: "/desktop?section=web",
            icon: AppWindow,
          },
          {
            id: "mcp",
            label: "MCP 与工具",
            category: "编码",
            description: "已注册能力、MCP transport、权限和运行配置。",
            state: toolRegistry ? (toolRegistry.items.length ? "ready" : "configured") : "degraded",
            detail: toolRegistry ? `${toolRegistry.items.length} 个能力已注册` : "无法读取工具 Registry",
            count: toolRegistry?.items.length,
            to: "/tools/config",
            icon: PlugZap,
          },
          {
            id: "knowledge",
            label: "知识连接",
            category: "检索",
            description: "项目知识、外部知识库和 Secret Ref 配置。",
            state: knowledgeSources ? knowledgeState(knowledgeSources.items) : "degraded",
            detail: knowledgeSources ? knowledgeDetail(knowledgeSources.items) : "无法读取知识连接",
            count: knowledgeSources?.items.length,
            to: "/knowledge",
            icon: Cable,
          },
          {
            id: "local-agent",
            label: "本地 Agent",
            category: "运行时",
            description: "配对的本地 Agent bridge、在线状态和 Profile 边界。",
            state: localConnections ? (localConnections.items.length ? "ready" : "configured") : "degraded",
            detail: localConnections ? connectionDetail(localConnections.items) : "无法读取本地 Agent 连接",
            count: localConnections?.items.length,
            icon: Server,
          },
          {
            id: "webhooks",
            label: "Webhook 与触发器",
            category: "自动化",
            description: "受策略保护的外部触发入口和执行状态。",
            state: agentTriggers ? (agentTriggers.items.length ? "ready" : "configured") : "degraded",
            detail: agentTriggers ? `${agentTriggers.items.length} 个触发器已登记` : "无法读取触发器",
            count: agentTriggers?.items.length,
            to: "/agents",
            icon: Webhook,
          },
          {
            id: "secrets",
            label: "Secret Ref",
            category: "安全",
            description: "连接只引用 Secret Ref，不在目录中返回原始密钥。",
            state: "configured",
            detail: "查看密钥库中的引用和审计状态",
            to: "/settings/secrets",
            icon: KeyRound,
          },
        ],
      };
    },
    retry: false,
  });
  const query = snapshot.data;
  const filteredItems = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return query?.items ?? [];
    return (query?.items ?? []).filter((item) => `${item.label} ${item.category} ${item.description}`.toLowerCase().includes(needle));
  }, [query?.items, search]);

  return (
    <ConsoleShell title="连接与集成">
      <main className="min-h-0 flex-1 overflow-y-auto bg-ui-page px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <header className="mb-6 flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <Link to="/settings" className="text-xs font-medium text-slate-500 hover:text-slate-900">返回设置</Link>
              <h1 className="mt-3 text-2xl font-semibold text-slate-950">连接与集成</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">统一查看浏览器、MCP、知识库、本地 Agent 和 Webhook 的真实状态。目录只显示能力元数据，不回显 Secret、Token 或完整凭据 URL。</p>
            </div>
            <Button type="button" variant="secondary" onClick={() => void snapshot.refetch()} disabled={snapshot.isFetching}><RefreshCw className={cn("h-3.5 w-3.5", snapshot.isFetching && "animate-spin")} />刷新</Button>
          </header>

          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full max-w-md"><Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" /><Input aria-label="搜索连接" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索连接、类别或状态" className="pl-8" /></div>
            <div className="flex items-center gap-2 text-xs text-slate-500"><Globe2 className="h-3.5 w-3.5" />{desktopAvailable ? "Desktop 集成桥已连接" : "浏览器安全降级"}</div>
          </div>

          {query?.failures.length ? <div role="status" className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">部分目录读取失败：{query.failures.join("、")}。已保留其他连接状态，未用静态数据替代。</div> : null}
          <div className="grid gap-3 md:grid-cols-2">
            {filteredItems.map((item) => <DirectoryCard key={item.id} item={item} />)}
          </div>
          {!filteredItems.length ? <div className="glass-surface rounded-2xl border border-dashed border-ui-border px-4 py-10 text-center text-sm text-slate-500">没有匹配的连接。</div> : null}

          <section className="mt-5 rounded-lg border border-slate-200 bg-white px-3 py-3 text-xs leading-5 text-slate-500">
            <div className="flex items-center gap-2 font-medium text-slate-700"><Link2 className="h-3.5 w-3.5" />浏览器策略</div>
            <p className="mt-1">当前保留 `shell.openExternal`、Web Extension 和 Harness 深链接；嵌入式浏览器会话尚未启用，避免跨 Profile 复用 Cookie 或扩大权限边界。</p>
          </section>
        </div>
      </main>
    </ConsoleShell>
  );
}

function DirectoryCard({ item }: { item: DirectoryItem }) {
  const Icon = item.icon;
  const body = <><div className="flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600"><Icon className="h-4 w-4" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="text-sm font-semibold text-slate-900">{item.label}</h2><Badge tone={toneForState(item.state)}>{stateLabel(item.state)}</Badge>{item.count !== undefined ? <span className="text-[11px] text-slate-400">{item.count}</span> : null}</div><p className="mt-1 text-xs leading-5 text-slate-500">{item.description}</p></div>{item.to ? <ExternalLink className="h-4 w-4 shrink-0 text-slate-400" /> : null}</div><p className="mt-3 border-t border-slate-100 pt-2 text-[11px] text-slate-500">{item.detail}</p></>;
  return item.to ? <Link to={item.to} className="rounded-lg border border-slate-200 bg-white p-3 transition-colors hover:border-slate-300 hover:bg-slate-50">{body}</Link> : <div className="rounded-lg border border-slate-200 bg-white p-3">{body}</div>;
}

function settledValue<T>(result: PromiseSettledResult<T>, failures: string[], label: string): T | null {
  if (result.status === "fulfilled") return result.value;
  failures.push(label);
  return null;
}

function knowledgeState(items: KnowledgeSource[]): DirectoryItem["state"] {
  if (!items.length) return "configured";
  if (items.some((item) => item.connector_validation_status === "invalid" || item.health_status === "UNHEALTHY")) return "degraded";
  return "ready";
}

function knowledgeDetail(items: KnowledgeSource[]) {
  const configured = items.filter((item) => item.connector_secret_configured).length;
  return `${items.length} 个知识源，${configured} 个连接已配置 Secret Ref`;
}

function connectionDetail(items: LocalAgentConnection[]) {
  const online = items.filter((item) => ["online", "ready", "healthy"].includes(item.status.toLowerCase())).length;
  return `${online}/${items.length} 个 bridge 在线，状态来自 API 心跳`;
}

function toneForState(state: DirectoryItem["state"]): BadgeTone {
  if (state === "ready") return "success";
  if (state === "degraded") return "warning";
  return "neutral";
}

function stateLabel(state: DirectoryItem["state"]) {
  if (state === "ready") return "正常";
  if (state === "configured") return "已配置";
  if (state === "degraded") return "需检查";
  return "不可用";
}
