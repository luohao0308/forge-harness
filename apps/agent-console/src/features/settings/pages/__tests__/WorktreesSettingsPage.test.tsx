import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../app/ConsoleShell", () => ({
  ConsoleShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import { WorktreesSettingsPage } from "../WorktreesSettingsPage";

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}><MemoryRouter initialEntries={["/settings/worktrees"]}><WorktreesSettingsPage /></MemoryRouter></QueryClientProvider>);
}

describe("WorktreesSettingsPage", () => {
  beforeEach(() => {
    window.desktopApi = {
      gitWorktree: {
        getStatus: vi.fn(async () => ({
          state: "ready" as const,
          branch: "main",
          worktrees: [
            { path: ".", branch: "main", head: "1234567890abcdef", current: true, main: true, dirty: false, prunable: false },
            { path: ".worktrees/review", branch: "review", head: "abcdef1234567890", current: false, main: false, dirty: false, prunable: false },
          ],
          errorCode: null,
          message: null,
        })),
        create: vi.fn(async () => ({ action: "create" as const, status: "completed" as const, path: ".worktrees/feature", auditId: "audit", eventId: null, operationId: "op" })),
        switch: vi.fn(async () => ({ action: "switch" as const, status: "completed" as const, path: ".worktrees/review", auditId: "audit", eventId: null, operationId: "op" })),
        remove: vi.fn(async () => ({ action: "remove" as const, status: "completed" as const, path: ".worktrees/review", auditId: "audit", eventId: null, operationId: "op" })),
        prune: vi.fn(async () => ({ action: "prune" as const, status: "completed" as const, path: null, auditId: "audit", eventId: null, operationId: "op" })),
      },
    };
  });

  afterEach(() => {
    delete window.desktopApi;
  });

  it("lists the current and isolated worktrees", async () => {
    renderPage();
    expect(await screen.findByText(".worktrees/review")).toBeInTheDocument();
    expect(screen.getByText("当前")).toBeInTheDocument();
    expect(screen.getByText("安全边界")).toBeInTheDocument();
  });

  it("requires an explicit confirmation before removing a worktree", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    renderPage();
    await screen.findByText(".worktrees/review");
    await userEvent.click(screen.getByRole("button", { name: "删除 .worktrees/review" }));
    expect(confirm).toHaveBeenCalledOnce();
    expect(window.desktopApi?.gitWorktree?.remove).not.toHaveBeenCalled();
    confirm.mockRestore();
  });

  it("creates a worktree through the trusted bridge", async () => {
    renderPage();
    await userEvent.type(screen.getByLabelText("新分支"), "feature/test");
    await userEvent.click(screen.getByRole("button", { name: "创建" }));
    await waitFor(() => expect(window.desktopApi?.gitWorktree?.create).toHaveBeenCalledWith({ branch: "feature/test", path: undefined }));
  });
});