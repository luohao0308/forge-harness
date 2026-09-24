import {
  AppWindow,
  ArrowUpRight,
  Database,
  FolderOpen,
  GitBranch,
  KeyRound,
  Mic,
  Palette,
  PlugZap,
  Settings2,
  ShieldCheck,
  Terminal,
  UserCircle,
} from "lucide-react";
import { Link } from "react-router-dom";

import { ConsoleShell } from "../../../app/ConsoleShell";
import { cn } from "../../../lib/utils";

type SettingsItem = {
  id: string;
  label: string;
  description: string;
  icon: typeof Settings2;
  to?: string;
  status: "available" | "planned";
  statusLabel: string;
};

type SettingsSection = {
  id: string;
  label: string;
  description: string;
  items: SettingsItem[];
};

const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    id: "personal",
    label: "个人",
    description: "应用偏好和输入方式",
    items: [
      available("general", "常规", "启动、桌面运行和本地应用设置。", Settings2, "/desktop?section=general"),
      planned("appearance", "外观", "主题、对比度和显示密度。", Palette),
      available("voice", "语音", "麦克风权限和可选语音转写。", Mic, "/settings/voice"),
      planned("shortcuts", "快捷键", "全局唤醒和工作区快捷操作。", Settings2),
    ],
  },
  {
    id: "integrations",
    label: "集成",
    description: "浏览器、插件和外部连接",
    items: [
      available("browser", "浏览器与链接", "打开网页扩展和 Harness 深链接入口。", AppWindow, "/settings/integrations"),
      available("plugins", "插件与模板", "管理插件市场和提示词模板。", PlugZap, "/settings/advanced#plugins"),
      available("secrets", "密钥库", "管理受控的 Secret Ref，不显示原始密钥。", KeyRound, "/settings/secrets"),
      available("knowledge", "知识连接", "管理项目知识和检索连接器。", PlugZap, "/settings/integrations"),
    ],
  },
  {
    id: "coding",
    label: "编码",
    description: "模型、权限、工作区和 Git",
    items: [
      available("models", "模型", "供应商、默认模型、限流和健康检查。", Settings2, "/settings/models"),
      available("permissions", "权限与沙箱", "工具审批、风险等级、沙箱和审计策略。", ShieldCheck, "/settings/policies"),
      available("workspace", "工作区", "可信目录、文件访问和项目索引。", FolderOpen, "/desktop?section=workspace"),
      available("terminal", "终端", "在当前工作区打开受控终端。", Terminal, "/terminal"),
      available("git", "Git 变更审查", "查看 Diff 并执行受控的暂存、撤销和恢复。", GitBranch, "/changes"),
      available("environment", "环境", "运行环境、Profile 和安全环境变量引用。", Settings2, "/settings/environment"),
      available("worktrees", "Worktrees", "创建、切换和清理隔离的 Git Worktree。", GitBranch, "/settings/worktrees"),
    ],
  },
  {
    id: "account",
    label: "数据与账户",
    description: "组织访问、审计和数据生命周期",
    items: [
      available("account", "账户与用户", "组织成员和账户访问。", UserCircle, "/settings/users"),
      available("data", "数据管理", "保留、导出和删除策略。", Database, "/settings/data-management"),
      available("audit", "审计日志", "查看设置和运行操作的审计记录。", ShieldCheck, "/settings/audit"),
    ],
  },
];

export function SettingsHubPage() {
  return (
    <ConsoleShell title="设置">
      <main className="min-h-0 flex-1 overflow-y-auto bg-ui-page px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <header className="mb-7 border-b border-slate-200 pb-5">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.12em] text-slate-400">
              <Settings2 className="h-4 w-4" aria-hidden="true" />
              Forge Harness
            </div>
            <h1 className="mt-3 text-2xl font-semibold text-slate-950">设置</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              从一个入口管理运行环境、工作区、连接和账户策略。未开放的能力会保留在目录中并标明状态。
            </p>
          </header>

          <div className="space-y-8">
            {SETTINGS_SECTIONS.map((section) => (
              <section key={section.id} aria-labelledby={`settings-section-${section.id}`}>
                <div className="mb-2">
                  <h2 id={`settings-section-${section.id}`} className="text-sm font-semibold text-slate-950">
                    {section.label}
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">{section.description}</p>
                </div>
                <div className="glass-surface divide-y divide-slate-100 overflow-hidden rounded-2xl border border-ui-border/70">
                  {section.items.map((item) => <SettingsItemRow key={item.id} item={item} />)}
                </div>
              </section>
            ))}
          </div>
        </div>
      </main>
    </ConsoleShell>
  );
}

function SettingsItemRow({ item }: { item: SettingsItem }) {
  const Icon = item.icon;
  const content = (
    <>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block text-sm font-medium text-slate-900">{item.label}</span>
        <span className="mt-0.5 block text-xs leading-5 text-slate-500">{item.description}</span>
      </span>
      <span className={cn(
        "shrink-0 rounded-full px-2 py-1 text-[10px] font-medium",
        item.status === "available" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500",
      )}>
        {item.statusLabel}
      </span>
      {item.status === "available" ? <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" /> : null}
    </>
  );

  if (item.to) {
    return (
      <Link to={item.to} className="flex min-h-16 items-center gap-3 px-3 py-2.5 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-400">
        {content}
      </Link>
    );
  }
  return (
    <div aria-disabled="true" className="flex min-h-16 items-center gap-3 px-3 py-2.5 opacity-75">
      {content}
    </div>
  );
}

function available(id: string, label: string, description: string, icon: typeof Settings2, to: string): SettingsItem {
  return { id, label, description, icon, to, status: "available", statusLabel: "可用" };
}

function planned(id: string, label: string, description: string, icon: typeof Settings2): SettingsItem {
  return { id, label, description, icon, status: "planned", statusLabel: "规划中" };
}
