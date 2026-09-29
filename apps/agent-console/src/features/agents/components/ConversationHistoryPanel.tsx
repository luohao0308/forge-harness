/**
 * ConversationHistoryPanel — left rail listing all conversations for the
 * current agent (v3 / Req 4).
 *
 * Pure presentational — the parent (`AgentWorkspacePage`) owns the store
 * and wires every callback. Collapsed mode renders a narrow strip with a
 * single expand-button (so the panel can be re-opened).
 *
 * Accessibility:
 *   - Every entry is a real `<button>` with `aria-current="page"` on the
 *     active item.
 *   - Delete buttons are icon-only with bilingual `aria-label`.
 *   - Focus rings via `focus-visible` (Req 7.2).
 */

import type { JSX } from "react";
import { useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  MessageSquarePlus,
  Pin,
  Pencil,
  Search,
  Settings2,
  Trash2,
} from "lucide-react";
import { Link } from "react-router-dom";

import { isDesktopRuntime } from "../../../lib/desktop-bridge";
import { useI18n } from "../../../lib/i18n";
import { cn } from "../../../lib/utils";
import type { ConversationSummary } from "../lib/conversationHistory";
import { sortConversationsByUpdatedAt } from "../lib/conversationHistory";
import { formatRelativeTime } from "../lib/relativeTime";

export type ConversationHistoryPanelProps = {
  collapsed: boolean;
  conversations: ConversationSummary[];
  currentConversationId: string;
  groupLabelForConversation?: (conversation: ConversationSummary) => string;
  onNewConversation: () => void;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  onRenameConversation?: (id: string) => void;
  onToggleCollapsed: () => void;
  onOpenSearch?: () => void;
  pinnedConversationIds?: string[];
  onTogglePinnedConversation?: (id: string) => void;
};

export function ConversationHistoryPanel({
  collapsed,
  conversations,
  currentConversationId,
  groupLabelForConversation,
  onNewConversation,
  onSelectConversation,
  onDeleteConversation,
  onRenameConversation,
  onToggleCollapsed,
  onOpenSearch,
  pinnedConversationIds = [],
  onTogglePinnedConversation,
}: ConversationHistoryPanelProps): JSX.Element {
  const { text, isChinese } = useI18n();
  const grouped = useMemo(
    () => groupConversations(
      sortConversationsForSidebar(conversations, pinnedConversationIds),
      groupLabelForConversation ?? (() => text("当前智能体", "Current Agent")),
    ),
    [conversations, groupLabelForConversation, pinnedConversationIds, text],
  );
  const locale = isChinese ? "zh-CN" : "en";
  const nowMs = Date.now();
  const desktop = isDesktopRuntime();

  const toggleLabel = collapsed
    ? text("展开历史对话", "Expand history")
    : text("收起历史对话", "Collapse history");

  if (collapsed) {
    return (
      <aside
        aria-label={text("历史对话", "Conversation history")}
        className="flex w-12 shrink-0 flex-col items-center gap-2 border-r border-ui-border bg-ui-sidebar py-3"
      >
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label={toggleLabel}
          title={toggleLabel}
          className="rounded-lg p-2 text-ui-muted transition-colors hover:bg-ui-selected hover:text-ui-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-border-strong"
        >
          <ChevronRight aria-hidden="true" className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onNewConversation}
          aria-label={text("新建对话", "New conversation")}
          title={text("新建对话", "New conversation")}
          className="rounded-lg p-2 text-ui-muted transition-colors hover:bg-ui-selected hover:text-ui-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-border-strong"
        >
          <MessageSquarePlus aria-hidden="true" className="h-4 w-4" />
        </button>
        {onOpenSearch ? (
          <button
            type="button"
            onClick={onOpenSearch}
            aria-label={text("搜索任务", "Search tasks")}
            title={text("搜索任务", "Search tasks")}
            className="rounded-lg p-2 text-ui-muted transition-colors hover:bg-ui-selected hover:text-ui-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-border-strong"
          >
            <Search aria-hidden="true" className="h-4 w-4" />
          </button>
        ) : null}
        {desktop ? (
          <div className="mt-auto flex flex-col gap-1">
            <DesktopUtilityLink to="/desktop" label={text("设置", "Settings")} icon={<Settings2 className="h-4 w-4" />} />
          </div>
        ) : null}
      </aside>
    );
  }

  return (
    <aside
      aria-label={text("历史对话", "Conversation history")}
      className="flex w-[280px] shrink-0 flex-col border-r border-ui-border bg-ui-sidebar max-md:absolute max-md:inset-y-0 max-md:left-0 max-md:z-30 max-md:shadow-none"
    >
      {desktop ? (
        <header className="px-3 pb-2 pt-3">
          <div className="flex h-8 items-center gap-2 px-1">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-ui-ink font-mono text-xs font-semibold text-white">
              H
            </span>
            <span className="text-sm font-semibold text-ui-ink">Harness</span>
            {onOpenSearch ? (
              <button
                type="button"
                onClick={onOpenSearch}
                aria-label={text("搜索任务", "Search tasks")}
                title={text("搜索任务", "Search tasks")}
                className="ml-auto rounded-md p-1.5 text-ui-muted transition-colors hover:bg-ui-selected hover:text-ui-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-border-strong"
              >
                <Search aria-hidden="true" className="h-4 w-4" />
              </button>
            ) : null}
            <button
              type="button"
              onClick={onToggleCollapsed}
              aria-label={toggleLabel}
              title={toggleLabel}
              className="rounded-md p-1.5 text-ui-muted transition-colors hover:bg-ui-selected hover:text-ui-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-border-strong"
            >
              <ChevronLeft aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
          <button
            type="button"
            onClick={onNewConversation}
            aria-label={text("新建任务", "New task")}
            className="mt-3 flex h-9 w-full items-center gap-2 rounded-md border border-ui-border-strong bg-ui-surface px-3 text-sm font-medium text-ui-ink transition-colors hover:bg-ui-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-border-strong"
          >
            <MessageSquarePlus aria-hidden="true" className="h-4 w-4" />
            <span>{text("新建任务", "New task")}</span>
          </button>
          <div className="px-1 pb-1 pt-4 text-xs font-medium text-ui-muted">
            {text("最近", "Recent")}
          </div>
        </header>
      ) : (
        <header className="flex items-center justify-between gap-2 px-2 py-3">
          <span className="px-2 text-sm font-semibold text-ui-ink">
            {text("历史对话", "History")}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onNewConversation}
              aria-label={text("新建对话", "New conversation")}
              title={text("新建对话", "New conversation")}
              className="inline-flex h-9 items-center gap-2 rounded-lg px-2.5 text-sm text-ui-ink transition-colors hover:bg-ui-selected focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-border-strong"
            >
              <MessageSquarePlus aria-hidden="true" className="h-4 w-4" />
              <span>{text("新聊天", "New chat")}</span>
            </button>
            <button
              type="button"
              onClick={onToggleCollapsed}
              aria-label={toggleLabel}
              title={toggleLabel}
              className="rounded-lg p-2 text-ui-muted transition-colors hover:bg-ui-selected hover:text-ui-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-border-strong"
            >
              <ChevronLeft aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
        </header>
      )}

      {conversations.length === 0 ? (
        <p className="px-3 py-6 text-center text-xs text-ui-muted">
          {text("暂无历史对话", "No conversations yet")}
        </p>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          {grouped.map((group) => (
            <section key={group.label} className="pt-3">
              <div className="flex items-center gap-1.5 px-2 pb-1.5 text-xs font-semibold text-ui-muted">
                <FolderOpen aria-hidden="true" className="h-3.5 w-3.5 text-ui-faint" />
                <span className="truncate">{group.label}</span>
              </div>
              <ul className="flex flex-col gap-0.5">
                {group.conversations.map((c) => {
                  const active = c.id === currentConversationId;
                  const updatedMs = Date.parse(c.updated_at);
                  const title = c.title.length > 0
                    ? c.title
                    : text("新对话", "New conversation");
                  const updatedLabel = Number.isFinite(updatedMs)
                    ? formatRelativeTime(updatedMs, nowMs, locale)
                    : "";
                  return (
                    <li key={c.id}>
                      <div
                        className={cn(
                          "group flex items-center gap-1 rounded-lg transition-colors",
                          active ? "bg-ui-selected" : "hover:bg-ui-selected/70",
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => onSelectConversation(c.id)}
                          aria-current={active ? "page" : undefined}
                          title={updatedLabel}
                          className="flex min-w-0 flex-1 items-center rounded-lg px-2 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-border-strong"
                        >
                          <span className="truncate text-sm text-ui-ink">{title}</span>
                        </button>
                        {onTogglePinnedConversation ? (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              onTogglePinnedConversation(c.id);
                            }}
                            aria-label={pinnedConversationIds.includes(c.id)
                              ? text("取消置顶", "Unpin conversation")
                              : text("置顶对话", "Pin conversation")}
                            title={pinnedConversationIds.includes(c.id)
                              ? text("取消置顶", "Unpin conversation")
                              : text("置顶对话", "Pin conversation")}
                            className={cn(
                              "mr-0.5 rounded-md p-1 opacity-0 transition-opacity focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-border-strong group-hover:opacity-100",
                              pinnedConversationIds.includes(c.id)
                                ? "text-ui-ink"
                                : "text-ui-faint hover:bg-ui-surface/70 hover:text-ui-muted",
                            )}
                          >
                            <Pin aria-hidden="true" className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                        {onRenameConversation ? (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              onRenameConversation(c.id);
                            }}
                            aria-label={text("重命名对话", "Rename conversation")}
                            title={text("重命名对话", "Rename conversation")}
                            className="mr-0.5 rounded-md p-1 text-ui-faint opacity-0 transition-opacity hover:bg-ui-surface/70 hover:text-ui-ink focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-border-strong group-hover:opacity-100"
                          >
                            <Pencil aria-hidden="true" className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            onDeleteConversation(c.id);
                          }}
                          aria-label={text("删除对话", "Delete conversation")}
                          title={text("删除对话", "Delete conversation")}
                          className="mr-1 rounded-md p-1 text-ui-faint opacity-0 transition-opacity hover:bg-ui-surface/70 hover:text-red-500 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-border-strong group-hover:opacity-100"
                        >
                          <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
      {desktop ? (
        <nav aria-label={text("桌面快捷入口", "Desktop shortcuts")} className="border-t border-ui-border p-2">
          <DesktopUtilityLink to="/desktop" label={text("设置", "Settings")} icon={<Settings2 className="h-4 w-4" />} />
        </nav>
      ) : null}
    </aside>
  );
}

function sortConversationsForSidebar(
  conversations: ConversationSummary[],
  pinnedConversationIds: string[],
): ConversationSummary[] {
  const pinned = new Set(pinnedConversationIds);
  const pinOrder = new Map(pinnedConversationIds.map((id, index) => [id, index]));
  return sortConversationsByUpdatedAt(conversations).sort((left, right) => {
    const leftPinned = pinned.has(left.id);
    const rightPinned = pinned.has(right.id);
    if (leftPinned !== rightPinned) return leftPinned ? -1 : 1;
    if (leftPinned && rightPinned) {
      return (pinOrder.get(left.id) ?? Number.MAX_SAFE_INTEGER)
        - (pinOrder.get(right.id) ?? Number.MAX_SAFE_INTEGER);
    }
    return 0;
  });
}

function DesktopUtilityLink({
  to,
  label,
  icon,
}: {
  to: string;
  label: string;
  icon: JSX.Element;
}): JSX.Element {
  return (
    <Link
      to={to}
      aria-label={label}
      title={label}
      className="flex h-9 items-center gap-2 rounded-md px-2 text-sm text-ui-muted transition-colors hover:bg-ui-selected hover:text-ui-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-border-strong"
    >
      <span aria-hidden="true" className="shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
    </Link>
  );
}

function groupConversations(
  conversations: ConversationSummary[],
  labelFor: (conversation: ConversationSummary) => string,
): Array<{ label: string; conversations: ConversationSummary[] }> {
  const groups: Array<{ label: string; conversations: ConversationSummary[] }> = [];
  const groupByLabel = new Map<string, { label: string; conversations: ConversationSummary[] }>();
  for (const conversation of conversations) {
    const rawLabel = labelFor(conversation).trim();
    const label = rawLabel.length > 0 ? rawLabel : "Agent";
    let group = groupByLabel.get(label);
    if (group === undefined) {
      group = { label, conversations: [] };
      groupByLabel.set(label, group);
      groups.push(group);
    }
    group.conversations.push(conversation);
  }
  return groups;
}
