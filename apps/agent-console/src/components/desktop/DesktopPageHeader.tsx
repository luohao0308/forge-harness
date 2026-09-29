import type { JSX, ReactNode } from "react";
import { ArrowLeft, type LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";

import { cn } from "../../lib/utils";
import { DesktopWorkspaceMenu } from "./DesktopWorkspaceMenu";
import { useDesktopWorkspaceReturnPath } from "./useDesktopWorkspaceReturnPath";

export function DesktopPageHeader({
  title,
  description,
  icon: Icon,
  actions,
  returnTo: returnToOverride,
  className,
}: {
  title: string;
  description?: ReactNode;
  icon?: LucideIcon;
  actions?: ReactNode;
  returnTo?: string;
  className?: string;
}): JSX.Element {
  const detectedReturnTo = useDesktopWorkspaceReturnPath();
  const returnTo = returnToOverride ?? detectedReturnTo;

  return (
    <header
      data-testid="desktop-page-header"
      className={cn(
        "glass-surface flex min-h-14 shrink-0 items-center gap-2 border-b border-ui-border/70 bg-ui-surface/70 px-3 py-2 sm:px-4",
        className,
      )}
    >
      <Link
        to={returnTo}
        aria-label="返回工作台"
        title="返回工作台"
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ui-muted transition-colors hover:bg-ui-subtle hover:text-ui-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-border-strong"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
      </Link>
      <div className="h-5 w-px shrink-0 bg-ui-border" aria-hidden="true" />
      {Icon ? <Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-ui-muted" /> : null}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-sm font-semibold text-ui-ink">{title}</h1>
        {description ? (
          <div className="truncate text-[11px] leading-4 text-ui-muted">{description}</div>
        ) : null}
      </div>
      {actions ? <div className="flex min-w-0 shrink-0 items-center gap-1.5">{actions}</div> : null}
      <DesktopWorkspaceMenu returnTo={returnTo} />
    </header>
  );
}
