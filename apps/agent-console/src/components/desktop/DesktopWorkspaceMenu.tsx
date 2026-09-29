import type { JSX } from "react";
import { useEffect, useRef, useState } from "react";
import {
  FileDiff,
  FolderOpen,
  History,
  LayoutGrid,
  ListChecks,
  ShieldCheck,
  SquareTerminal,
  Users,
  Workflow,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";

import {
  desktopOperationPath,
  desktopWorkspacePanelPath,
} from "../../lib/desktop-navigation";
import { useI18n } from "../../lib/i18n";
import { cn } from "../../lib/utils";
import { useDesktopWorkspaceReturnPath } from "./useDesktopWorkspaceReturnPath";

type DesktopWorkspaceMenuItem = {
  key: string;
  label: string;
  to: string;
  icon: typeof Users;
  active: boolean;
};

export function DesktopWorkspaceMenu({
  className,
  returnTo: returnToOverride,
}: {
  className?: string;
  returnTo?: string;
}): JSX.Element {
  const { text } = useI18n();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const panel = new URLSearchParams(location.search).get("desktop_panel");
  const detectedReturnTo = useDesktopWorkspaceReturnPath();
  const returnTo = returnToOverride ?? detectedReturnTo;

  useEffect(() => {
    if (!open) return;
    const closeOnPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnPointerDown);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnPointerDown);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const items: DesktopWorkspaceMenuItem[] = [
    {
      key: "teams",
      label: text("团队", "Teams"),
      to: desktopOperationPath("/teams", returnTo),
      icon: Users,
      active: /^\/teams(?:\/|$)/.test(location.pathname),
    },
    {
      key: "terminal",
      label: text("终端", "Terminal"),
      to: desktopOperationPath("/terminal", returnTo),
      icon: SquareTerminal,
      active: location.pathname === "/terminal",
    },
    {
      key: "files",
      label: text("文件", "Files"),
      to: desktopWorkspacePanelPath(returnTo, "files"),
      icon: FolderOpen,
      active: /^\/agents\/[^/]+\/workspace$/.test(location.pathname) && panel === "files",
    },
    {
      key: "changes",
      label: text("变更", "Changes"),
      to: desktopOperationPath("/changes", returnTo),
      icon: FileDiff,
      active: location.pathname === "/changes",
    },
    {
      key: "attention",
      label: text("待处理", "Attention"),
      to: desktopOperationPath("/attention", returnTo),
      icon: ListChecks,
      active: location.pathname === "/attention",
    },
    {
      key: "approvals",
      label: text("审批", "Approvals"),
      to: desktopWorkspacePanelPath(returnTo, "approvals"),
      icon: ShieldCheck,
      active: /^\/agents\/[^/]+\/workspace$/.test(location.pathname) && panel === "approvals",
    },
    {
      key: "runs",
      label: text("运行历史", "Run history"),
      to: desktopOperationPath("/runs", returnTo),
      icon: History,
      active: /^\/runs(?:\/|$)/.test(location.pathname),
    },
    {
      key: "automations",
      label: text("自动化", "Automations"),
      to: desktopOperationPath("/agents?desktop_panel=triggers", returnTo),
      icon: Workflow,
      active: location.pathname === "/agents" && panel === "triggers",
    },
  ];

  return (
    <div ref={menuRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label={text("工作台工具", "Workspace tools")}
        aria-haspopup="menu"
        aria-expanded={open}
        title={text("工作台工具", "Workspace tools")}
        className="glass-control inline-flex h-8 w-8 items-center justify-center rounded-xl border border-ui-border text-ui-muted transition-colors hover:bg-ui-subtle/90 hover:text-ui-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-border-strong"
      >
        <LayoutGrid aria-hidden="true" className="h-3.5 w-3.5" />
      </button>
      {open ? (
        <div
          role="menu"
          aria-label={text("工作台工具", "Workspace tools")}
          className="glass-surface-strong absolute right-0 top-full z-50 mt-1.5 grid w-48 gap-0.5 rounded-2xl border border-ui-border p-1.5 shadow-glass"
        >
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.key}
                to={item.to}
                role="menuitem"
                aria-current={item.active ? "page" : undefined}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex h-9 items-center gap-2 rounded-md px-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-border-strong",
                  item.active
                    ? "bg-ui-selected text-ui-ink"
                    : "text-ui-muted hover:bg-ui-subtle hover:text-ui-ink",
                )}
              >
                <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
