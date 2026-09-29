import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useConsoleStore } from "../../../stores/consoleStore";
import { ConversationHistoryPanel } from "../components/ConversationHistoryPanel";
import type { ConversationSummary } from "../lib/conversationHistory";

function conversation(id: string, title: string, updatedAt: string): ConversationSummary {
  return {
    id,
    title,
    created_at: updatedAt,
    updated_at: updatedAt,
    nodesById: {},
    rootNodeId: "root",
    activeLeafId: "root",
    pinnedNodeIds: [],
    dismissedPlanNodeIds: [],
    draft: "",
    contextWindowTurns: 6,
    contextCompressions: {},
  };
}

describe("ConversationHistoryPanel", () => {
  afterEach(() => {
    delete window.desktopApi;
  });

  it("keeps history controls reachable by accessible name", async () => {
    useConsoleStore.getState().setLocale("en-US");
    const user = userEvent.setup();
    const onNewConversation = vi.fn();
    const onSelectConversation = vi.fn();
    const onDeleteConversation = vi.fn();
    const onToggleCollapsed = vi.fn();

    render(
      <MemoryRouter initialEntries={["/agents/default/workspace"]}>
        <ConversationHistoryPanel
          collapsed={false}
          conversations={[
            conversation("one", "First workspace pass", "2026-05-11T20:00:00Z"),
            conversation("two", "Second workspace pass", "2026-05-11T20:10:00Z"),
          ]}
          currentConversationId="two"
          onNewConversation={onNewConversation}
          onSelectConversation={onSelectConversation}
          onDeleteConversation={onDeleteConversation}
          onToggleCollapsed={onToggleCollapsed}
        />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "新建对话" }));
    expect(onNewConversation).toHaveBeenCalledTimes(1);

    const active = screen.getByRole("button", { name: "Second workspace pass" });
    expect(active).toHaveAttribute("aria-current", "page");

    await user.click(screen.getByRole("button", { name: "First workspace pass" }));
    expect(onSelectConversation).toHaveBeenCalledWith("one");

    await user.click(screen.getAllByRole("button", { name: "删除对话" })[0]);
    expect(onDeleteConversation).toHaveBeenCalledWith("two");

    await user.click(screen.getByRole("button", { name: "收起历史对话" }));
    expect(onToggleCollapsed).toHaveBeenCalledTimes(1);
  });

  it("adds only the essential task and utility navigation in desktop runtime", () => {
    window.desktopApi = {};
    const onOpenSearch = vi.fn();

    render(
      <MemoryRouter initialEntries={["/agents/default/workspace"]}>
        <ConversationHistoryPanel
          collapsed={false}
          conversations={[conversation("one", "Inspect repository", "2026-05-11T20:00:00Z")]}
          currentConversationId="one"
          onNewConversation={vi.fn()}
          onSelectConversation={vi.fn()}
          onDeleteConversation={vi.fn()}
          onToggleCollapsed={vi.fn()}
          onOpenSearch={onOpenSearch}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("Harness")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "新建任务" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "搜索任务" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "待处理" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "运行历史" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "工具与插件" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "团队" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "终端" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "文件" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "审批" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "设置" })).toHaveAttribute("href", "/desktop");
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();

    screen.getByRole("button", { name: "搜索任务" }).click();
    expect(onOpenSearch).toHaveBeenCalledTimes(1);
  });

  it("keeps pinned conversations first and exposes an accessible toggle", async () => {
    window.desktopApi = {};
    const user = userEvent.setup();
    const onTogglePinnedConversation = vi.fn();

    render(
      <MemoryRouter initialEntries={["/agents/default/workspace"]}>
        <ConversationHistoryPanel
          collapsed={false}
          conversations={[
            conversation("recent", "Recent task", "2026-05-11T20:10:00Z"),
            conversation("pinned", "Pinned task", "2026-05-11T20:00:00Z"),
          ]}
          currentConversationId="recent"
          onNewConversation={vi.fn()}
          onSelectConversation={vi.fn()}
          onDeleteConversation={vi.fn()}
          onToggleCollapsed={vi.fn()}
          pinnedConversationIds={["pinned"]}
          onTogglePinnedConversation={onTogglePinnedConversation}
        />
      </MemoryRouter>,
    );

    const entries = screen.getAllByRole("button", { name: /task/ });
    expect(entries[0]).toHaveAccessibleName("Pinned task");
    await user.click(screen.getByRole("button", { name: "取消置顶" }));
    expect(onTogglePinnedConversation).toHaveBeenCalledWith("pinned");
  });
});
